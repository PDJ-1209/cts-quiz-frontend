import { Injectable, signal, WritableSignal } from '@angular/core';
import { RankChangeEvent } from '../models/leaderboard-entry.model';
import { DEFAULT_GAME_CONFIG } from '../models/host-settings.model';

/**
 * Toast notification for game events
 */
export interface GameToast {
  id: string;
  type: 'rank-up' | 'champion' | 'top3-enter' | 'streak';
  message: string;
  playerName: string;
  duration: number;
  timestamp: number;
}

/**
 * MotionEffectsService
 * 
 * Manages special effects and celebrations:
 * - Confetti bursts
 * - Toast notifications
 * - Sound hooks (no-op by default, ready for audio implementation)
 * - Particle effects coordination
 * 
 * Respects prefers-reduced-motion setting.
 */
@Injectable({
  providedIn: 'root'
})
export class MotionEffectsService {
  private toastCounter = 0;
  private readonly toastsSignal: WritableSignal<GameToast[]> = signal([]);
  
  // Public readonly signal for components to subscribe
  public readonly toasts = this.toastsSignal.asReadonly();

  // Track if reduced motion is preferred
  private prefersReducedMotion = false;

  constructor() {
    this.checkReducedMotionPreference();
  }

  /**
   * Check system preference for reduced motion
   */
  private checkReducedMotionPreference(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;

      // Listen for changes
      mediaQuery.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    }
  }

  /**
   * Check if reduced motion is enabled
   */
  isReducedMotion(): boolean {
    return this.prefersReducedMotion;
  }

  /**
   * Trigger confetti burst
   * @param intensity - 0-100
   * @param position - {x, y} position for burst origin (optional, defaults to center)
   */
  triggerConfetti(intensity: number = 50, position?: { x: number; y: number }): void {
    if (this.prefersReducedMotion) {
      return; // Skip confetti in reduced motion mode
    }

    // Emit custom event for confetti component to handle
    const event = new CustomEvent('trigger-confetti', {
      detail: { intensity, position }
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle rank change events and trigger appropriate effects
   */
  processRankChange(change: RankChangeEvent): void {
    const { rankDelta, becameChampion, enteredTop3, nickname } = change;

    // Champion celebration
    if (becameChampion) {
      this.showToast('champion', `🏆 ${nickname} is now #1!`, nickname, 3000);
      this.triggerConfetti(80, { x: 50, y: 20 }); // Top center burst
      this.playChampionSound();
    }
    // Entered top 3
    else if (enteredTop3) {
      this.showToast('top3-enter', `🌟 ${nickname} entered Top 3!`, nickname, 2500);
      this.triggerConfetti(50, { x: 50, y: 30 });
      this.playTop3Sound();
    }
    // Big rank jump
    else if (rankDelta >= DEFAULT_GAME_CONFIG.rankJumpThreshold) {
      this.showToast('rank-up', `📈 ${nickname} jumped ${rankDelta} ranks!`, nickname, 2000);
      this.triggerConfetti(30);
      this.playRankUpSound();
    }
  }

  /**
   * Show toast notification
   */
  showToast(
    type: GameToast['type'],
    message: string,
    playerName: string,
    duration: number = 2000
  ): void {
    const toast: GameToast = {
      id: `toast-${++this.toastCounter}`,
      type,
      message,
      playerName,
      duration,
      timestamp: Date.now(),
    };

    // Add toast
    this.toastsSignal.update(toasts => [...toasts, toast]);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(toast.id);
    }, duration);
  }

  /**
   * Remove a toast by ID
   */
  removeToast(id: string): void {
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Trigger celebration for streak milestone
   */
  celebrateStreak(nickname: string, streak: number): void {
    if (streak >= 5 && streak % 5 === 0) {
      this.showToast('streak', `🔥 ${nickname} has a ${streak} streak!`, nickname, 2000);
      this.playStreakSound();
    }
  }

  /**
   * Trigger end-game cinematic confetti
   */
  triggerCinematicConfetti(): void {
    if (this.prefersReducedMotion) {
      return;
    }

    // Large burst for game end
    this.triggerConfetti(100, { x: 50, y: 50 });
    
    // Additional bursts with delay
    setTimeout(() => this.triggerConfetti(70, { x: 20, y: 40 }), 500);
    setTimeout(() => this.triggerConfetti(70, { x: 80, y: 40 }), 1000);
  }

  // ============================================
  // SOUND HOOKS (No-op by default)
  // Implement these methods when adding audio
  // ============================================

  /**
   * Play sound when player ranks up significantly
   * TODO: Implement audio playback
   */
  playRankUpSound(): void {
    // No-op: Ready for audio implementation
    // Example: this.audioService.play('rank-up.mp3');
    console.log('🔊 [Sound Hook] Rank Up');
  }

  /**
   * Play sound when player becomes #1
   * TODO: Implement audio playback
   */
  playChampionSound(): void {
    // No-op: Ready for audio implementation
    // Example: this.audioService.play('champion.mp3');
    console.log('🔊 [Sound Hook] Champion');
  }

  /**
   * Play sound when player enters top 3
   * TODO: Implement audio playback
   */
  playTop3Sound(): void {
    // No-op: Ready for audio implementation
    // Example: this.audioService.play('top3.mp3');
    console.log('🔊 [Sound Hook] Top 3 Enter');
  }

  /**
   * Play sound for streak milestone
   * TODO: Implement audio playback
   */
  playStreakSound(): void {
    // No-op: Ready for audio implementation
    // Example: this.audioService.play('streak.mp3');
    console.log('🔊 [Sound Hook] Streak');
  }

  /**
   * Clear all toasts
   */
  clearToasts(): void {
    this.toastsSignal.set([]);
  }

  /**
   * Reset service state
   */
  reset(): void {
    this.clearToasts();
    this.toastCounter = 0;
  }
}
