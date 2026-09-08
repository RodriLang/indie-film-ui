import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideChevronLeft, LucideChevronRight, LucideSearch, LucideUsers } from '@lucide/angular';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { USER_ROLE_OPTIONS, UserRole } from '../../../../core/auth/auth.models';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { UserAdminApi } from '../../data/user-admin.api';
import {
  USER_STATUS_OPTIONS,
  UserAdmin,
  userStatusLabel,
  UserStatus
} from '../../data/user-admin.models';

@Component({
  selector: 'app-user-admin-page',
  imports: [Avatar, LucideChevronLeft, LucideChevronRight, LucideSearch, LucideUsers],
  templateUrl: './user-admin-page.html',
  styleUrl: './user-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAdminPage implements OnInit {
  private readonly userAdminApi = inject(UserAdminApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly authStore = inject(AuthStore);

  readonly users = signal<UserAdmin[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly role = signal<UserRole | null>(null);
  readonly status = signal<UserStatus | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly updatingUserId = signal<number | null>(null);

  readonly roleOptions = USER_ROLE_OPTIONS;
  readonly statusOptions = USER_STATUS_OPTIONS;

  ngOnInit(): void {
    this.load();
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    this.page.set(0);
    this.load();
  }

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  changeRoleFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as UserRole | '';
    this.role.set(value || null);
    this.page.set(0);
    this.load();
  }

  changeStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as UserStatus | '';
    this.status.set(value || null);
    this.page.set(0);
    this.load();
  }

  changeUserRole(user: UserAdmin, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as UserRole;

    if (user.id === this.authStore.user()?.id || role === user.role || this.updatingUserId() !== null) {
      return;
    }

    this.updatingUserId.set(user.id);
    this.error.set(null);

    this.userAdminApi.updateRole(user.id, { role })
      .pipe(
        finalize(() => this.updatingUserId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (updated) => this.users.update((users) =>
          users.map((current) => current.id === updated.id ? updated : current)
        ),
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos actualizar el rol.'));
          this.load();
        }
      });
  }

  previousPage(): void {
    if (this.page() === 0 || this.loading()) {
      return;
    }

    this.page.update((page) => page - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() + 1 >= this.totalPages() || this.loading()) {
      return;
    }

    this.page.update((page) => page + 1);
    this.load();
  }

  statusLabel(status: UserStatus): string {
    return userStatusLabel(status);
  }

  createdLabel(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.userAdminApi.findAll(
      this.query(),
      this.role(),
      this.status(),
      this.page(),
      20
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.users.set(result.content);
          this.totalPages.set(result.totalPages);
          this.totalElements.set(result.totalElements);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos cargar los usuarios.'));
          this.loading.set(false);
        }
      });
  }
}
