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
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, combineLatest, debounceTime } from 'rxjs';

import { LeaderboardEngineService } from '../../services/leaderboard-engine.service';
import { HostControlService } from '../../services/host-control.service';
import { MotionEffectsService } from '../../services/motion-effects.service';
import { RealtimeFeedService } from '../../services/realtime-feed.service';
import { SignalrService } from '../../services/signalr.service';
import { LeaderboardService, LeaderboardSnapshot, LeaderboardUpdate } from '../../services/leaderboard.service';

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
  sessionId: number = 0;
  isConnected = false;

  private destroy$ = new Subject<void>();
  private updateDebounce$ = new Subject<void>();
  private signalrService = inject(SignalrService);
  private leaderboardService = inject(LeaderboardService);
  private route = inject(ActivatedRoute);

  constructor(
    private engine: LeaderboardEngineService,
    private hostControl: HostControlService,
    private motionEffects: MotionEffectsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.engine.setConfig(this.config);

    // Get session ID from route params or localStorage
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const sessionIdFromRoute = params['sessionId'];
      const storedSessionId = localStorage.getItem('currentSessionId');
      
      if (sessionIdFromRoute) {
        this.sessionId = parseInt(sessionIdFromRoute, 10);
        localStorage.setItem('currentSessionId', this.sessionId.toString());
      } else if (storedSessionId) {
        this.sessionId = parseInt(storedSessionId, 10);
      }
      
      if (this.sessionId) {
        // Initialize LeaderboardHub connection
        this.signalrService.initLeaderboardHub(this.sessionId);
        // Load initial leaderboard data
        this.loadLeaderboard();
      }
    });

    // Track connection status
    this.signalrService.leaderboardConnectionEstablished$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected: boolean) => {
        this.isConnected = connected;
        console.log('[Leaderboard] Connection status:', connected ? 'Connected' : 'Disconnected');
        this.cdr.markForCheck();
      });

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

    // Subscribe to LeaderboardHub updates
    this.signalrService.leaderboardUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData: LeaderboardSnapshot) => {
        console.log('[Leaderboard] LeaderboardHub snapshot received:', leaderboardData);
        this.updateFromLeaderboardSnapshot(leaderboardData);
      });

    this.signalrService.scoreUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update: LeaderboardUpdate) => {
        console.log('[Leaderboard] Score update received:', update);
        this.handleScoreUpdate(update);
      });

    this.signalrService.showLeaderboard$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData: LeaderboardSnapshot) => {
        console.log('[Leaderboard] Show leaderboard event:', leaderboardData);
        this.updateFromLeaderboardSnapshot(leaderboardData);
        this.isVisible = true;
        this.cdr.markForCheck();
      });

    // Legacy QuizSessionHub events (kept for backward compatibility)
    this.signalrService.hostLeaderboardUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData) => {
        console.log('[Leaderboard] Real-time update received (legacy):', leaderboardData);
        this.updateFromSignalRData(leaderboardData);
      });

    this.signalrService.showHostLeaderboard$
      .pipe(takeUntil(this.destroy$))
      .subscribe((leaderboardData) => {
        console.log('[Leaderboard] Show leaderboard event (legacy):', leaderboardData);
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
    if (this.sessionId) {
      this.signalrService.leaveSessionLeaderboard(this.sessionId);
    }
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
   * Update leaderboard from SignalR data (legacy compatibility)
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

      const stats = this.engine.getPlayerStats(player.playerId) || this.engine.initializePlayer(player.playerId);
      stats.totalScore = entry.score || 0;
      stats.streakCorrect = entry.streak || 0;
      stats.averageSpeedMs = entry.averageTime || 0;
      stats.cumulativeSpeedMs = entry.totalTime || 0;
      stats.totalCorrect = entry.correctAnswers || 0;
      stats.currentRank = entry.rank || index + 1;
      stats.previousRank = entry.lastRank || index + 1;

      return {
        player: player,
        stats: stats,
        isHighlighted: false,
        showDeltaLabel: false,
        highlightType: 'rank-up',
        justEntered: false
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

  /**
   * Load initial leaderboard data from API
   */
  private loadLeaderboard(): void {
    if (!this.sessionId) return;

    this.leaderboardService.getLeaderboard(this.sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LeaderboardSnapshot) => {
          console.log('[Leaderboard] Initial data loaded:', response);
          this.updateFromHttpResponse(response);
        },
        error: (error: any) => {
          console.error('[Leaderboard] Failed to load initial data:', error);
        }
      });
  }

  /**
   * Update from HTTP API response
   */
  private updateFromHttpResponse(response: any): void {
    if (!response || !response.rankings) return;

    const newEntries: LeaderboardEntry[] = response.rankings.map((entry: any) => {
      const stats = this.engine.getPlayerStats(entry.participantId) || this.engine.initializePlayer(entry.participantId);
      
      // Update stats from API data
      stats.totalScore = entry.score;
      stats.totalCorrect = entry.correctAnswers;
      stats.totalAnswered = entry.totalQuestions;
      stats.cumulativeSpeedMs = entry.totalTimeInMs;
      stats.averageSpeedMs = entry.averageSpeedMs;
      stats.streakCorrect = entry.streakCorrect;
      stats.currentRank = entry.rank;
      stats.previousRank = entry.previousRank;
      stats.accuracyPercent = entry.totalQuestions > 0 ? Math.round((entry.correctAnswers / entry.totalQuestions) * 100) : 0;

      return {
        player: {
          playerId: entry.participantId,
          nickname: entry.participantName,
          color: this.generateColor(entry.participantId),
          avatarUrl: entry.avatarUrl || ''
        },
        stats: stats,
        isHighlighted: entry.hasRankChange,
        highlightType: entry.rankDelta > 0 ? 'rank-up' : (entry.rankDelta < 0 ? 'rank-down' : undefined),
        showDeltaLabel: entry.hasRankChange,
        justEntered: false
      };
    });

    this.entries = newEntries;
    this.isVisible = response.showToParticipants;
    this.cdr.markForCheck();
  }

  /**
   * Update from LeaderboardHub snapshot
   */
  private updateFromLeaderboardSnapshot(snapshot: LeaderboardSnapshot): void {
    if (!snapshot || !snapshot.rankings) return;

    const oldPositions = this.captureRowPositions();

    const newEntries: LeaderboardEntry[] = snapshot.rankings.map((entry: any) => {
      const stats = this.engine.getPlayerStats(entry.participantId) || this.engine.initializePlayer(entry.participantId);
      
      stats.totalScore = entry.score;
      stats.totalCorrect = entry.correctAnswers;
      stats.totalAnswered = entry.totalQuestions;
      stats.cumulativeSpeedMs = entry.totalTimeInMs;
      stats.averageSpeedMs = entry.averageSpeedMs;
      stats.streakCorrect = entry.streakCorrect;
      stats.currentRank = entry.rank;
      stats.previousRank = entry.previousRank;

      return {
        player: {
          playerId: entry.participantId,
          nickname: entry.participantName,
          color: this.generateColor(entry.participantId),
          avatarUrl: entry.avatarUrl || ''
        },
        stats: stats,
        isHighlighted: entry.hasRankChange,
        highlightType: entry.rankDelta > 0 ? 'rank-up' : (entry.rankDelta < 0 ? 'rank-down' : undefined),
        showDeltaLabel: entry.hasRankChange,
        justEntered: false
      };
    });

    this.entries = newEntries;
    this.cdr.detectChanges();

    // Apply FLIP animation
    setTimeout(() => {
      this.animateReorder(oldPositions);
    }, 0);
  }

  /**
   * Handle individual score update from LeaderboardHub
   */
  private handleScoreUpdate(update: LeaderboardUpdate): void {
    if (!update) return;

    const existingEntry = this.entries.find(e => e.player.playerId === update.participantId.toString());
    
    if (existingEntry) {
      // Update existing entry
      existingEntry.stats.totalScore = update.newTotalScore;
      existingEntry.stats.lastScoreDelta = update.scoreDelta;
      existingEntry.stats.previousRank = update.oldRank;
      existingEntry.stats.currentRank = update.newRank;
      existingEntry.stats.streakCorrect = update.streakCorrect;
      existingEntry.isHighlighted = true;
      existingEntry.showDeltaLabel = true;
      existingEntry.highlightType = update.rankDelta > 0 ? 'rank-up' : (update.rankDelta < 0 ? 'rank-down' : undefined);
    } else {
      // Add new entry
      const stats = this.engine.initializePlayer(update.participantId.toString());
      stats.totalScore = update.newTotalScore;
      stats.lastScoreDelta = update.scoreDelta;
      stats.currentRank = update.newRank;
      stats.previousRank = update.oldRank;
      stats.streakCorrect = update.streakCorrect;

      this.entries.push({
        player: {
          playerId: update.participantId.toString(),
          nickname: update.playerName,
          color: this.generateColor(update.participantId.toString()),
          avatarUrl: ''
        },
        stats: stats,
        isHighlighted: true,
        showDeltaLabel: true,
        highlightType: 'rank-up',
        justEntered: true
      });
    }

    // Re-sort by rank
    const oldPositions = this.captureRowPositions();
    this.entries = this.engine.sortByRank(this.entries);
    this.engine.updateRanks(this.entries);
    
    this.cdr.detectChanges();
    
    // Apply FLIP animation
    setTimeout(() => {
      this.animateReorder(oldPositions);
    }, 0);
  }

  /**
   * Set session ID (called by parent component)
   */
  public setSessionId(sessionId: number): void {
    this.sessionId = sessionId;
    localStorage.setItem('currentSessionId', sessionId.toString());
    
    // Initialize LeaderboardHub if not already connected
    if (!this.signalrService.leaderboardConnectionEstablished$.value) {
      this.signalrService.initLeaderboardHub(sessionId);
    }
    
    // Load initial data
    this.loadLeaderboard();
  }
}

