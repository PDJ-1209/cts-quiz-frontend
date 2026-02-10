import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  getItem(key: string): string | null {
    return this.getStorage()?.getItem(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.getStorage()?.setItem(key, value);
  }

  removeItem(key: string): void {
    this.getStorage()?.removeItem(key);
  }

  canUseStorage(): boolean {
    return !!this.getStorage();
  }

  canUseSessionStorage(): boolean {
    return !!this.getSessionStorage();
  }

  getSessionItem(key: string): string | null {
    return this.getSessionStorage()?.getItem(key) ?? null;
  }

  setSessionItem(key: string, value: string): void {
    this.getSessionStorage()?.setItem(key, value);
  }

  removeSessionItem(key: string): void {
    this.getSessionStorage()?.removeItem(key);
  }

  private getStorage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const storage = window?.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  }

  private getSessionStorage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const storage = window?.sessionStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  }
}
