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
import { CurrentUser } from '../../../../core/auth/auth.models';
import {
  ImageFocalEditor,
  ImageFocalPoint,
} from '../../../shared/components/image-focal-editor/image-focal-editor';

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
    ImageFocalEditor,
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
  readonly avatarBusy = signal(false);
  readonly editing = signal(false);
  readonly error = signal<string | null>(null);
  readonly specialties = signal<Set<CreatorSpecialty>>(new Set());
  readonly creatorUpgradeConfirming = signal(false);
  readonly activatingCreator = signal(false);

  readonly avatarFocalX = signal(0.5);
  readonly avatarFocalY = signal(0.5);
  readonly avatarFocalDirty = signal(false);

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
      avatarFocalX: user.avatarFocalX ?? 0.5,
      avatarFocalY: user.avatarFocalY ?? 0.5,
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

      this.avatarFocalX.set(profile.avatarFocalX ?? 0.5);
      this.avatarFocalY.set(profile.avatarFocalY ?? 0.5);
      this.avatarFocalDirty.set(false);
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
        switchMap((user) => {
          if (!this.avatarFocalDirty() || !user.avatarUrl) {
            return of(user);
          }

          return this.currentUserApi.updateAvatarFocalPoint(
            this.avatarFocalX(),
            this.avatarFocalY(),
          );
        }),

        tap((user) => {
          this.applyCurrentUser(user);
          this.avatarFocalDirty.set(false);
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

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';

    if (!file || this.avatarBusy()) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error.set('La foto de perfil debe ser JPEG, PNG o WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error.set('La foto de perfil no puede superar los 5 MB.');
      return;
    }

    this.avatarBusy.set(true);
    this.error.set(null);

    this.currentUserApi
      .updateAvatar(file)
      .pipe(
        finalize(() => this.avatarBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => {
          this.applyCurrentUser(user);

          this.avatarFocalX.set(user.avatarFocalX ?? 0.5);
          this.avatarFocalY.set(user.avatarFocalY ?? 0.5);
          this.avatarFocalDirty.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos actualizar la foto de perfil.'),
          );
        },
      });
  }

  onAvatarFocalChange(focal: ImageFocalPoint): void {
    this.avatarFocalX.set(focal.x);
    this.avatarFocalY.set(focal.y);
    this.avatarFocalDirty.set(true);
  }

  removeAvatar(): void {
    if (this.avatarBusy() || !this.authStore.user()?.avatarUrl) {
      return;
    }

    this.avatarBusy.set(true);
    this.error.set(null);

    this.currentUserApi
      .removeAvatar()
      .pipe(
        finalize(() => this.avatarBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => {
          this.applyCurrentUser(user);

          this.avatarFocalX.set(0.5);
          this.avatarFocalY.set(0.5);
          this.avatarFocalDirty.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos eliminar la foto de perfil.'),
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

  private applyCurrentUser(user: CurrentUser): void {
    const currentUser = this.authStore.user();

    const normalizedUser = {
      displayName: user.displayName ?? currentUser?.displayName,
      bio: user.bio ?? currentUser?.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      avatarFocalX: user.avatarFocalX ?? currentUser?.avatarFocalX ?? 0.5,
      avatarFocalY: user.avatarFocalY ?? currentUser?.avatarFocalY ?? 0.5,
      specialties: user.specialties ?? currentUser?.specialties ?? [],
      birthDate: user.birthDate ?? currentUser?.birthDate ?? null,
      role: user.role ?? currentUser?.role,
    };

    this.authStore.updateUser(normalizedUser);

    this.profile.update((profile) =>
      profile
        ? {
            ...profile,
            displayName: normalizedUser.displayName ?? profile.displayName,
            bio: normalizedUser.bio,
            avatarUrl: normalizedUser.avatarUrl,
            avatarFocalX: normalizedUser.avatarFocalX,
            avatarFocalY: normalizedUser.avatarFocalY,
            specialties: normalizedUser.specialties,
          }
        : profile,
    );
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
            this.avatarFocalX.set(data.profile.avatarFocalX ?? 0.5);
            this.avatarFocalY.set(data.profile.avatarFocalY ?? 0.5);
            this.avatarFocalDirty.set(false);
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
          this.avatarFocalX.set(data.profile.avatarFocalX ?? 0.5);
          this.avatarFocalY.set(data.profile.avatarFocalY ?? 0.5);
          this.avatarFocalDirty.set(false);
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
        tap((updatedUser) => this.applyCurrentUser(updatedUser)),

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
