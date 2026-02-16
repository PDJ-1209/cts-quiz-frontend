import { Injectable, signal, effect } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeType = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = signal<ThemeType>('light');
  private themeSubject = new BehaviorSubject<ThemeType>('light');
  public theme$: Observable<ThemeType> = this.themeSubject.asObservable();

  constructor() {
    this.initializeTheme();
    this.setupThemeEffect();
  }

  /**
   * Initialize theme from localStorage or system preference
   */
  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('app-theme') as ThemeType | null;
    
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      this.currentTheme.set(savedTheme);
      this.applyTheme(savedTheme);
    } else {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme: ThemeType = prefersDark ? 'dark' : 'light';
      this.currentTheme.set(defaultTheme);
      this.applyTheme(defaultTheme);
    }
  }

  /**
   * Setup effect to listen to theme changes
   */
  private setupThemeEffect(): void {
    effect(() => {
      const theme = this.currentTheme();
      this.themeSubject.next(theme);
      this.persistTheme(theme);
    });
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ThemeType {
    return this.currentTheme();
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Set specific theme
   */
  setTheme(theme: ThemeType): void {
    this.currentTheme.set(theme);
    this.applyTheme(theme);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: ThemeType): void {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  /**
   * Persist theme preference to localStorage
   */
  private persistTheme(theme: ThemeType): void {
    localStorage.setItem('app-theme', theme);
  }

  /**
   * Check if dark theme is active
   */
  isDarkTheme(): boolean {
    return this.currentTheme() === 'dark';
  }

  /**
   * Get theme signal for reactive updates
   */
  getThemeSignal() {
    return this.currentTheme.asReadonly();
  }
}
