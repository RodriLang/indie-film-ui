import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, finalize, switchMap, tap, of, map } from 'rxjs';
import {
  LucideEdit3,
  LucideLogOut,
  LucidePlus,
  LucideShieldCheck,
  LucideUsers,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { ProductionCard } from '../../../production/components/production-card/production-card';
import { ProductionApi } from '../../../production/data/production.api';
import {
  creditRoleLabel,
  OwnProductionSummary,
  ProductionSummary,
} from '../../../production/data/production.models';
import { CreatorApi } from '../../data/creator.api';
import {
  CREATOR_SPECIALTY_OPTIONS,
  CreatorParticipation,
  CreatorProfile,
  CreatorSpecialty,
} from '../../data/creator.models';
import { CurrentUserApi } from '../../../../core/auth/current-user.api';

@Component({
  selector: 'app-creator-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Avatar,
    ProductionCard,
    LucideEdit3,
    LucideLogOut,
    LucidePlus,
    LucideShieldCheck,
    LucideUsers,
  ],
  templateUrl: './creator-page.html',
  styleUrl: './creator-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly creatorApi = inject(CreatorApi);
  private readonly currentUserApi = inject(CurrentUserApi);
  private readonly productionApi = inject(ProductionApi);
  readonly authStore = inject(AuthStore);
  private readonly authSession = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly own = signal(false);
  readonly profile = signal<CreatorProfile | null>(null);
  readonly productions = signal<ProductionSummary[]>([]);
  readonly ownProductions = signal<OwnProductionSummary[]>([]);
  readonly participations = signal<CreatorParticipation[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editing = signal(false);
  readonly error = signal<string | null>(null);
  readonly specialties = signal<Set<CreatorSpecialty>>(new Set());
  readonly creatorUpgradeConfirming = signal(false);
  readonly activatingCreator = signal(false);

  readonly specialtyOptions = CREATOR_SPECIALTY_OPTIONS;

  readonly displayProfile = computed<CreatorProfile | null>(() => {
    const profile = this.profile();

    if (profile) {
      return profile;
    }

    if (!this.own()) {
      return null;
    }

    const user = this.authStore.user();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      specialties: user.specialties ?? [],
    };
  });

  readonly creatorEligibility = computed<
    'ELIGIBLE' | 'UNDERAGE' | 'MISSING_BIRTH_DATE' | 'NOT_APPLICABLE'
  >(() => {
    const user = this.authStore.user();

    if (!this.own() || user?.role !== 'USER') {
      return 'NOT_APPLICABLE';
    }

    if (!user.birthDate) {
      return 'MISSING_BIRTH_DATE';
    }

    const today = new Date();
    const birthDate = new Date(`${user.birthDate}T00:00:00`);

    const eighteenthBirthday = new Date(
      birthDate.getFullYear() + 18,
      birthDate.getMonth(),
      birthDate.getDate(),
    );

    return today >= eighteenthBirthday ? 'ELIGIBLE' : 'UNDERAGE';
  });

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    bio: ['', Validators.maxLength(2000)],
  });

  ngOnInit(): void {
    const own = this.route.snapshot.data['own'] === true;

    this.own.set(own);

    const user = this.authStore.user();

    if (own && user?.role === 'USER') {
      this.loading.set(false);
      return;
    }

    const username = own
      ? user?.username
      : this.route.snapshot.paramMap.get('username');

    if (!username) {
      this.error.set('No pudimos encontrar el perfil.');
      this.loading.set(false);
      return;
    }

    this.load(username);
  }

  toggleEdit(): void {
    const profile = this.displayProfile();

    if (!profile) {
      return;
    }

    if (!this.editing()) {
      this.profileForm.setValue({
        displayName: profile.displayName,
        bio: profile.bio ?? '',
      });

      this.specialties.set(new Set(profile.specialties));
    }

    this.editing.update((value) => !value);
  }

  toggleSpecialty(specialty: CreatorSpecialty): void {
    const next = new Set(this.specialties());
    next.has(specialty) ? next.delete(specialty) : next.add(specialty);
    this.specialties.set(next);
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.saving()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const currentUser = this.authStore.user();

    if (!currentUser) {
      return;
    }

    const value = this.profileForm.getRawValue();

    this.saving.set(true);
    this.error.set(null);

    this.currentUserApi
      .updateProfile({
        displayName: value.displayName.trim(),
        bio: value.bio.trim() || null,
        specialties: [...this.specialties()],
      })
      .pipe(
        tap((user) => {
          this.authStore.updateUser({
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            specialties: user.specialties,
            birthDate: user.birthDate,
            role: user.role,
          });
        }),
        switchMap((user) =>
          user.role === 'CREATOR'
            ? this.creatorApi.findByUsername(user.username)
            : of(null),
        ),
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          if (profile) {
            this.profile.set(profile);
          }

          this.editing.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos guardar el perfil.'),
          );
        },
      });
  }

  startCreatorUpgrade(): void {
    if (!this.own() || this.authStore.user()?.role !== 'USER') {
      return;
    }

    this.creatorUpgradeConfirming.set(true);
    this.error.set(null);
  }

  cancelCreatorUpgrade(): void {
    if (this.activatingCreator()) {
      return;
    }

    this.creatorUpgradeConfirming.set(false);
  }

  logout(): void {
    void this.authSession.logout().finally(() => {
      void this.router.navigateByUrl('/explore');
    });
  }

  statusLabel(production: OwnProductionSummary): string {
    if (production.moderationStatus === 'PENDING') {
      return 'En revisión';
    }

    if (production.moderationStatus === 'REJECTED') {
      return 'Requiere cambios';
    }

    return {
      DRAFT: 'Borrador',
      PUBLISHED: 'Publicada',
      HIDDEN: 'Oculta',
      REMOVED: 'Eliminada',
    }[production.status];
  }

  specialtyLabel(specialty: CreatorSpecialty): string {
    return (
      this.specialtyOptions.find((option) => option.value === specialty)
        ?.label ?? specialty
    );
  }

  roleLabel(role: CreatorParticipation['credits'][number]['role']): string {
    return creditRoleLabel(role);
  }

  private load(username: string): void {
    this.loading.set(true);

    const profile$ = this.creatorApi.findByUsername(username);
    const productions$ = this.creatorApi.findProductions(username, 0, 24);
    const participations$ = this.creatorApi.findParticipations(username, 0, 24);

    if (this.own() && this.authStore.canCreate()) {
      forkJoin({
        profile: profile$,
        productions: productions$,
        participations: participations$,
        ownProductions: this.productionApi.findOwn(null, 0, 50),
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.profile.set(data.profile);
            this.productions.set(data.productions.content);
            this.participations.set(data.participations.content);
            this.ownProductions.set(data.ownProductions.content);
            this.loading.set(false);
          },
          error: (error) => this.handleLoadError(error),
        });
      return;
    }

    forkJoin({
      profile: profile$,
      productions: productions$,
      participations: participations$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.profile.set(data.profile);
          this.productions.set(data.productions.content);
          this.participations.set(data.participations.content);
          this.loading.set(false);
        },
        error: (error) => this.handleLoadError(error),
      });
  }

  activateCreator(): void {
    const user = this.authStore.user();

    if (!this.own() || user?.role !== 'USER' || this.activatingCreator()) {
      return;
    }

    this.activatingCreator.set(true);
    this.error.set(null);

    this.currentUserApi
      .becomeCreator()
      .pipe(
        tap((updatedUser) => {
          this.authStore.updateUser({
            displayName: updatedUser.displayName,
            bio: updatedUser.bio,
            avatarUrl: updatedUser.avatarUrl,
            specialties: updatedUser.specialties,
            birthDate: updatedUser.birthDate,
            role: updatedUser.role,
          });
        }),

        switchMap((updatedUser) =>
          this.authSession.refresh().pipe(map(() => updatedUser)),
        ),

        finalize(() => this.activatingCreator.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updatedUser) => {
          this.creatorUpgradeConfirming.set(false);
          this.load(updatedUser.username);
        },

        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos activar tu perfil de creador.'),
          );
        },
      });
  }

  private handleLoadError(error: unknown): void {
    this.error.set(apiErrorMessage(error, 'No pudimos cargar este perfil.'));
    this.loading.set(false);
  }
}
