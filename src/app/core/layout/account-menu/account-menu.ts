import { ChangeDetectionStrategy, Component, HostListener, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideLogIn,
  LucideLogOut,
  LucidePlus,
  LucideShieldCheck,
  LucideUser,
  LucideUsers
} from '@lucide/angular';

import { Avatar } from '../../../shared/ui/avatar/avatar';
import { userRoleLabel } from '../../auth/auth.models';
import { AuthStore } from '../../auth/auth.store';

@Component({
  selector: 'app-account-menu',
  imports: [
    RouterLink,
    Avatar,
    LucideLogIn,
    LucideLogOut,
    LucidePlus,
    LucideShieldCheck,
    LucideUser,
    LucideUsers
  ],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountMenu {
  private readonly router = inject(Router);

  readonly authStore = inject(AuthStore);
  readonly open = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  roleLabel(): string {
    const role = this.authStore.user()?.role;
    return role ? userRoleLabel(role) : '';
  }

  logout(): void {
    this.close();
    this.authStore.clear();
    void this.router.navigateByUrl('/explore');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
