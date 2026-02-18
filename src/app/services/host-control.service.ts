import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HostSettings, VisibilityMode } from '../models/host-settings.model';

/**
 * HostControlService
 * 
 * Manages host controls for leaderboard visibility and game state.
 * 
 * Visibility modes:
 * - OFF: Leaderboard hidden from players
 * - ON: Leaderboard visible and updating in real-time
 * - END_ONLY: Hidden during game, revealed only when game ends
 * 
 * Host can change mode anytime. When game ends, triggers final reveal.
 */
@Injectable({
  providedIn: 'root'
})
export class HostControlService {
  private settingsSubject = new BehaviorSubject<HostSettings>({
    visibilityMode: 'ON',
    gameEnded: false,
  });

  public readonly settings$: Observable<HostSettings> = this.settingsSubject.asObservable();

  constructor() {}

  /**
   * Get current settings
   */
  getSettings(): HostSettings {
    return this.settingsSubject.value;
  }

  /**
   * Set visibility mode
   */
  setVisibilityMode(mode: VisibilityMode): void {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({
      ...current,
      visibilityMode: mode,
    });
  }

  /**
   * End the game - triggers final reveal if in END_ONLY mode
   */
  endGame(): void {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({
      ...current,
      gameEnded: true,
    });
  }

  /**
   * Start new game - resets game state
   */
  startNewGame(): void {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({
      ...current,
      gameEnded: false,
    });
  }

  /**
   * Check if leaderboard should be visible
   */
  isLeaderboardVisible(): boolean {
    const settings = this.settingsSubject.value;
    
    if (settings.visibilityMode === 'OFF') {
      return false;
    }
    
    if (settings.visibilityMode === 'END_ONLY') {
      return settings.gameEnded;
    }
    
    // Mode is 'ON'
    return true;
  }

  /**
   * Check if in cinematic reveal mode
   */
  shouldShowCinematicReveal(): boolean {
    const settings = this.settingsSubject.value;
    return settings.visibilityMode === 'END_ONLY' && settings.gameEnded;
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.settingsSubject.next({
      visibilityMode: 'ON',
      gameEnded: false,
    });
  }
}
