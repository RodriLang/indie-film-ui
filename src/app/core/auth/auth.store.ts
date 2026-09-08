import { PLATFORM_ID, computed, inject, Injectable, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthResponse, AuthUser } from './auth.models';

const TOKEN_KEY = 'indie-film.access-token';
const USER_KEY = 'indie-film.auth-user';

@Injectable({ providedIn: 'root' })
export class AuthStore {

  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private readonly accessTokenState = signal<string | null>(this.readToken());
  private readonly userState = signal<AuthUser | null>(this.readUser());

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(() => this.accessTokenState() !== null);
  readonly canCreate = computed(() => {
    const role = this.userState()?.role;
    return role === 'CREATOR' || role === 'MODERATOR' || role === 'ADMIN';
  });

  readonly canModerate = computed(() => {
    const role = this.userState()?.role;
    return role === 'MODERATOR' || role === 'ADMIN';
  });

  readonly canAdministerUsers = computed(() => this.userState()?.role === 'ADMIN');

  setSession(response: AuthResponse): void {
    this.accessTokenState.set(response.accessToken);
    this.userState.set(response.user);

    if (this.browser) {
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
  }

  updateUser(patch: Partial<AuthUser>): void {
    const current = this.userState();

    if (!current) {
      return;
    }

    const updated = { ...current, ...patch };
    this.userState.set(updated);

    if (this.browser) {
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);

    if (this.browser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private readToken(): string | null {
    return this.browser ? localStorage.getItem(TOKEN_KEY) : null;
  }

  private readUser(): AuthUser | null {
    if (!this.browser) {
      return null;
    }

    const value = localStorage.getItem(USER_KEY);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
