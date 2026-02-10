import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, combineLatest, debounceTime } from 'rxjs';

import { LeaderboardEngineService } from '../../services/leaderboard-engine.service';
import { HostControlService } from '../../services/host-control.service';
import { MotionEffectsService } from '../../services/motion-effects.service';
import { RealtimeFeedService } from '../../services/realtime-feed.service';
import { SignalrService } from '../../services/signalr.service';

import { LeaderboardEntry } from '../../models/leaderboard-entry.model';
import { Player } from '../../models/player.model';
import { DEFAULT_GAME_CONFIG } from '../../models/host-settings.model';

import { LeaderboardRowComponent } from '../leaderboard-row/leaderboard-row.component';
import { leaderboardAnimations } from './leaderboard.animations';

import { capturePositions, animatePositionChanges } from '../../utils/flip-animation.util';

/**
 * LeaderboardComponent
 * 
 * Main leaderboard container:
 * - Subscribes to realtime answer events
 * - Updates scores and rankings
 * - Manages FLIP animations for smooth reordering
 * - Triggers celebrations and effects
 * - Respects host visibility controls
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, LeaderboardRowComponent],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: leaderboardAnimations
})
export class LeaderboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('leaderboardList', { read: ElementRef }) leaderboardList?: ElementRef<HTMLElement>;

  entries: LeaderboardEntry[] = [];
  isVisible = true;
  isCinematicReveal = false;
  config = DEFAULT_GAME_CONFIG;

  private destroy$ = new Subject<void>();
  private updateDebounce$ = new Subject<void>();
  private signalrService = inject(SignalrService);

  constructor(
    private engine: LeaderboardEngineService,
    private hostControl: HostControlService,
    private motionEffects: MotionEffectsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.engine.setConfig(this.config);

    // Watch host settings for visibility
    this.hostControl.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isVisible = this.hostControl.isLeaderboardVisible();
        this.isCinematicReveal = this.hostControl.shouldShowCinematicReveal();

        if (this.isCinematicReveal) {
          this.triggerCinematicReveal();
        }

        this.cdr.markForCheck();
      });

    // Subscribe to real-time SignalR leaderboard updates
    this.signalrService.hostLeaderboardUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData) => {
        console.log('[Leaderboard] Real-time update received:', leaderboardData);
        this.updateFromSignalRData(leaderboardData);
      });

    this.signalrService.showHostLeaderboard$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData) => {
        console.log('[Leaderboard] Show leaderboard event:', leaderboardData);
        this.updateFromSignalRData(leaderboardData);
        this.triggerCinematicReveal();
      });

    this.signalrService.participantCountUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        console.log('[Leaderboard] Participant count updated:', count);
        // Update participant count display if needed
      });

    // Debounce rapid updates for smoother animations
    this.updateDebounce$
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  ngAfterViewInit(): void {
    // Component is ready for FLIP animations
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Process incoming answer event
   * Called by parent component
   */
  processAnswer(event: any): void {
    // Capture old positions for FLIP
    const oldPositions = this.captureRowPositions();
    const oldEntries = [...this.entries];

    // Process answer through engine
    const updatedStats = this.engine.processAnswer(event);

    // Rebuild entries array
    this.rebuildEntries();

    // Sort by rank
    const sortedEntries = this.engine.sortByRank(this.entries);
    
    // Update ranks
    this.engine.updateRanks(sortedEntries);

    // Detect rank changes
    const changes = this.engine.computeRankChanges(oldEntries, sortedEntries);

    // Apply highlights and deltas
    this.applyHighlights(sortedEntries, changes);

    // Update entries
    this.entries = sortedEntries;

    // Trigger effects for significant changes
    changes.forEach(change => {
      if (change.becameChampion || change.enteredTop3 || 
          Math.abs(change.rankDelta) >= this.config.rankJumpThreshold) {
        this.motionEffects.processRankChange(change);
      }
    });

    // Check for streak milestones
    if (updatedStats.lastAnswerWasCorrect && updatedStats.streakCorrect >= this.config.streakThreshold) {
      const player = this.entries.find(e => e.stats.playerId === event.playerId)?.player;
      if (player && updatedStats.streakCorrect % 5 === 0) {
        this.motionEffects.celebrateStreak(player.nickname, updatedStats.streakCorrect);
      }
    }

    // Trigger change detection
    this.updateDebounce$.next();

    // Apply FLIP animation after DOM update
    setTimeout(() => {
      this.animateReorder(oldPositions);
    }, 0);
  }

  /**
   * Initialize players
   * Called by parent component
   */
  initializePlayers(players: Player[]): void {
    players.forEach(player => {
      this.engine.initializePlayer(player.playerId);
    });
    this.rebuildEntries();
    this.cdr.markForCheck();
  }

  /**
   * Rebuild entries array from current stats
   */
  private rebuildEntries(): void {
    const stats = this.engine.getAllStats();
    
    this.entries = stats.map(stat => {
      const existingEntry = this.entries.find(e => e.stats.playerId === stat.playerId);
      
      return {
        player: existingEntry?.player || { 
          playerId: stat.playerId, 
          nickname: stat.playerId,
          color: this.generateColor(stat.playerId)
        },
        stats: stat,
        isHighlighted: existingEntry?.isHighlighted || false,
        highlightType: existingEntry?.highlightType,
        showDeltaLabel: existingEntry?.showDeltaLabel || false,
        justEntered: false
      };
    });
  }

  /**
   * Apply highlights and delta labels based on rank changes
   */
  private applyHighlights(entries: LeaderboardEntry[], changes: any[]): void {
    // Clear all highlights first
    entries.forEach(entry => {
      entry.isHighlighted = false;
      entry.showDeltaLabel = false;
    });

    changes.forEach(change => {
      const entry = entries.find(e => e.player.playerId === change.playerId);
      if (!entry) return;

      entry.isHighlighted = true;
      entry.showDeltaLabel = true;

      // Determine highlight type
      if (change.becameChampion) {
        entry.highlightType = 'champion';
      } else if (change.enteredTop3) {
        entry.highlightType = 'top3-enter';
      } else if (change.rankDelta > 0) {
        entry.highlightType = 'rank-up';
      } else {
        entry.highlightType = 'rank-down';
      }

      // Auto-clear highlight after duration
      setTimeout(() => {
        entry.isHighlighted = false;
        entry.showDeltaLabel = false;
        this.cdr.markForCheck();
      }, this.config.highlightDurationMs);
    });
  }

  /**
   * Capture current row positions for FLIP
   */
  private captureRowPositions(): Map<HTMLElement, DOMRect> {
    if (!this.leaderboardList) return new Map();

    const rows = Array.from(
      this.leaderboardList.nativeElement.querySelectorAll('.leaderboard-row')
    ) as HTMLElement[];

    return capturePositions(rows);
  }

  /**
   * Animate row reordering with FLIP
   */
  private animateReorder(oldPositions: Map<HTMLElement, DOMRect>): void {
    if (!this.leaderboardList || oldPositions.size === 0) return;

    const rows = Array.from(
      this.leaderboardList.nativeElement.querySelectorAll('.leaderboard-row')
    ) as HTMLElement[];

    if (rows.length === 0) return;

    animatePositionChanges(rows, oldPositions, {
      duration: 400,
      easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
    });
  }

  /**
   * Trigger cinematic reveal animation
   */
  private triggerCinematicReveal(): void {
    // Mark all entries for cinematic entrance
    this.entries.forEach((entry, index) => {
      entry.justEntered = true;
    });

    // Trigger confetti
    this.motionEffects.triggerCinematicConfetti();

    this.cdr.markForCheck();
  }

  /**
   * Get cinematic delay for staggered entrance
   */
  getCinematicDelay(index: number): number {
    return this.isCinematicReveal ? index * this.config.cinematicStaggerDelayMs : 0;
  }

  /**
   * TrackBy function for ngFor
   */
  trackByPlayerId(index: number, entry: LeaderboardEntry): string {
    return entry.player.playerId;
  }

  /**
   * Generate consistent color for player
   */
  private generateColor(playerId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#EF476F', '#118AB2'
    ];
    
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Get visibility state for animation
   */
  getVisibilityState(): string {
    return this.isVisible ? 'visible' : 'hidden';
  }

  /**
   * Update leaderboard from SignalR data
   */
  private updateFromSignalRData(leaderboardData: any): void {
    if (!leaderboardData || !leaderboardData.entries) {
      return;
    }

    // Convert SignalR data to LeaderboardEntry format
    const newEntries: LeaderboardEntry[] = leaderboardData.entries.map((entry: any, index: number) => {
      const player: Player = {
        playerId: entry.participantId || entry.playerId || `player_${index}`,
        nickname: entry.participantName || entry.displayName || `Player ${index + 1}`,
        color: this.generateColor(entry.participantId || `player_${index}`),
        avatarUrl: entry.avatar || ''
      };

      return {
        rank: entry.rank || index + 1,
        player: player,
        score: entry.score || 0,
        streak: entry.streak || 0,
        averageTime: entry.averageTime || 0,
        totalTime: entry.totalTime || 0,
        correctAnswers: entry.correctAnswers || 0,
        isHighlighted: false,
        showDeltaLabel: false,
        highlightType: 'rank-up',
        lastRank: entry.lastRank || index + 1,
        rankDelta: (entry.lastRank || index + 1) - (entry.rank || index + 1)
      };
    });

    // Apply FLIP animation if we have existing entries
    if (this.entries.length > 0 && this.leaderboardList?.nativeElement) {
      const beforePositions = capturePositions(Array.from(this.leaderboardList.nativeElement.children) as HTMLElement[]);
      this.entries = newEntries;
      this.cdr.detectChanges();
      
      setTimeout(() => {
        if (this.leaderboardList?.nativeElement) {
          animatePositionChanges(Array.from(this.leaderboardList.nativeElement.children) as HTMLElement[], beforePositions);
        }
      });
    } else {
      this.entries = newEntries;
      this.cdr.markForCheck();
    }
  }
}
