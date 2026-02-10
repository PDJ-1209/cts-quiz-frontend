import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardEntry } from '../../models/leaderboard-entry.model';
import { leaderboardAnimations } from '../leaderboard/leaderboard.animations';

/**
 * LeaderboardRowComponent
 * 
 * Individual leaderboard row with:
 * - Rank badge
 * - Player info
 * - Score with count-up animation
 * - Accuracy bar
 * - Speed badge
 * - Streak indicator
 * - Delta label for rank changes
 * - Special styling for top 3
 */
@Component({
  selector: 'app-leaderboard-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-row.component.html',
  styleUrls: ['./leaderboard-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: leaderboardAnimations
})
export class LeaderboardRowComponent implements OnChanges {
  @Input() entry!: LeaderboardEntry;
  @Input() config: any;
  @Input() cinematicDelay: number = 0;

  displayedScore: number = 0;
  private scoreAnimationFrame: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entry']) {
      // Trigger score count-up animation
      if (changes['entry'].previousValue) {
        const oldScore = changes['entry'].previousValue.stats.totalScore;
        const newScore = this.entry.stats.totalScore;
        
        if (oldScore !== newScore) {
          this.animateScoreChange(oldScore, newScore);
        } else {
          this.displayedScore = newScore;
        }
      } else {
        this.displayedScore = this.entry.stats.totalScore;
      }
    }
  }

  /**
   * Animate score count-up
   */
  private animateScoreChange(from: number, to: number): void {
    if (this.scoreAnimationFrame) {
      cancelAnimationFrame(this.scoreAnimationFrame);
    }

    const duration = 800; // ms
    const startTime = performance.now();
    const diff = to - from;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.displayedScore = Math.round(from + diff * eased);

      if (progress < 1) {
        this.scoreAnimationFrame = requestAnimationFrame(animate);
      }
    };

    this.scoreAnimationFrame = requestAnimationFrame(animate);
  }

  /**
   * Get rank badge class
   */
  getRankClass(): string {
    const rank = this.entry.stats.currentRank;
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }

  /**
   * Get speed badge
   */
  getSpeedBadge(): { icon: string; class: string } | null {
    const avgSpeed = this.entry.stats.averageSpeedMs;
    if (this.entry.stats.totalAnswered === 0) return null;

    const fastThreshold = this.config?.fastThresholdMs || 5000;
    const slowThreshold = this.config?.slowThresholdMs || 15000;

    if (avgSpeed <= fastThreshold) {
      return { icon: '⚡', class: 'fast' };
    } else if (avgSpeed >= slowThreshold) {
      return { icon: '🐢', class: 'slow' };
    }
    return null;
  }

  /**
   * Check if has active streak
   */
  hasStreak(): boolean {
    const threshold = this.config?.streakThreshold || 3;
    return this.entry.stats.streakCorrect >= threshold;
  }

  /**
   * Get delta label text
   */
  getDeltaLabel(): string {
    const delta = this.entry.stats.lastDeltaRank;
    if (delta === 0) return '';
    
    const sign = delta > 0 ? '+' : '';
    const arrow = delta > 0 ? '↑' : '↓';
    return `${sign}${delta} ${arrow}`;
  }

  /**
   * Get highlight animation state
   */
  getHighlightState(): string {
    if (!this.entry.isHighlighted) return 'none';
    return this.entry.highlightType || 'none';
  }

  /**
   * Format time in seconds
   */
  formatTime(ms: number): string {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  }
}
