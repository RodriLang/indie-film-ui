import { computed, Injectable, signal } from '@angular/core';

import { AuthResponse, CurrentUser } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly accessTokenState = signal<string | null>(null);
  private readonly userState = signal<CurrentUser | null>(null);

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(
    () => this.accessTokenState() !== null && this.userState() !== null,
  );

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
  }

  updateUser(patch: Partial<CurrentUser>): void {
    const current = this.userState();

    if (!current) {
      return;
    }

    this.userState.set({ ...current, ...patch });
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);
  }
}
