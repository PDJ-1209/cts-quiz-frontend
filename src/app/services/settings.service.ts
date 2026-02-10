
// src/app/core/settings.service.ts
import { Injectable, signal } from '@angular/core';

/**
 * Minimal settings service using Angular signals.
 * Persists to localStorage so the toggle survives page reloads.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly PROFANITY_KEY = 'settings.profanityFilter.enabled';

  // Signal state (initial value comes from localStorage)
  profanityFilterEnabled = signal<boolean>(this.loadProfanityEnabled());

  /** Load initial state from localStorage; default OFF (false) if not set. */
  private loadProfanityEnabled(): boolean {
    try {
      const raw = localStorage.getItem(this.PROFANITY_KEY);
      return raw === 'true'; // default false when raw is null/other
    } catch {
      // In case localStorage is unavailable (e.g., SSR), fallback to false
      return false;
    }
  }

  /** Update signal + persist to localStorage */
  setProfanityFilter(enabled: boolean): void {
    this.profanityFilterEnabled.set(enabled);
    try {
      localStorage.setItem(this.PROFANITY_KEY, String(enabled));
    } catch {
      // Ignore persistence errors (private browsing, SSR, etc.)
    }
  }

  /** Convenience method to flip the current value */
  toggleProfanityFilter(): void {
    this.setProfanityFilter(!this.profanityFilterEnabled());
  }
}