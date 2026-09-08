import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const MUTED_KEY = 'indie-film.playback-muted';

@Injectable({ providedIn: 'root' })
export class PlaybackPreferences {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private readonly mutedState = signal(this.readMuted());

  readonly muted = this.mutedState.asReadonly();

  setMuted(muted: boolean): void {
    this.mutedState.set(muted);

    if (!this.browser) {
      return;
    }

    try {
      localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      // La reproducción sigue funcionando aunque storage no esté disponible.
    }
  }

  private readMuted(): boolean {
    if (!this.browser) {
      return true;
    }

    try {
      const value = localStorage.getItem(MUTED_KEY);
      return value === null ? true : value === 'true';
    } catch {
      return true;
    }
  }
}
