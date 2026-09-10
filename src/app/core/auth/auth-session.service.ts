import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { firstValueFrom, from, Observable, tap } from 'rxjs';

import { AuthApi } from './auth.api';
import { AuthResponse, LoginRequest } from './auth.models';
import { AuthStore } from './auth.store';

const REFRESH_LOCK_NAME = 'indie-film-refresh-token';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly authApi = inject(AuthApi);
  private readonly authStore = inject(AuthStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private refreshPromise: Promise<AuthResponse> | null = null;

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.authApi.login(request).pipe(
      tap((response) => this.authStore.setSession(response)),
    );
  }

  refresh(): Observable<AuthResponse> {
    return from(this.refreshSession());
  }

  async restoreSession(): Promise<void> {
    if (!this.browser) {
      return;
    }

    try {
      await this.refreshSession();
    } catch {
      this.authStore.clear();
    }
  }

  async logout(): Promise<void> {
    if (!this.browser) {
      this.authStore.clear();
      return;
    }

    try {
      await firstValueFrom(this.authApi.logout());
    } finally {
      this.authStore.clear();
    }
  }

  private refreshSession(): Promise<AuthResponse> {
    if (!this.browser) {
      return Promise.reject(new Error('Refresh is only available in the browser'));
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshPromise = this.withRefreshLock();
    this.refreshPromise = refreshPromise;

    void refreshPromise.then(
      () => this.clearRefreshPromise(refreshPromise),
      () => this.clearRefreshPromise(refreshPromise),
    );

    return refreshPromise;
  }

  private async withRefreshLock(): Promise<AuthResponse> {
    if ('locks' in navigator && navigator.locks) {
      return navigator.locks.request(
        REFRESH_LOCK_NAME,
        async () => this.executeRefresh(),
      );
    }

    return this.executeRefresh();
  }

  private async executeRefresh(): Promise<AuthResponse> {
    try {
      const response = await firstValueFrom(this.authApi.refresh());
      this.authStore.setSession(response);
      return response;
    } catch (error) {
      this.authStore.clear();
      throw error;
    }
  }

  private clearRefreshPromise(promise: Promise<AuthResponse>): void {
    if (this.refreshPromise === promise) {
      this.refreshPromise = null;
    }
  }
}
