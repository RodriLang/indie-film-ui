import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { LucideEdit3, LucideLogOut, LucidePlus, LucideShieldCheck, LucideUsers } from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { ProductionCard } from '../../../production/components/production-card/production-card';
import { ProductionApi } from '../../../production/data/production.api';
import { creditRoleLabel, OwnProductionSummary, ProductionSummary } from '../../../production/data/production.models';
import { CreatorApi } from '../../data/creator.api';
import {
  CREATOR_SPECIALTY_OPTIONS,
  CreatorParticipation,
  CreatorProfile,
  CreatorSpecialty
} from '../../data/creator.models';

@Component({
  selector: 'app-creator-page',
  imports: [ReactiveFormsModule, RouterLink, Avatar, ProductionCard, LucideEdit3, LucideLogOut, LucidePlus, LucideShieldCheck, LucideUsers],
  templateUrl: './creator-page.html',
  styleUrl: './creator-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreatorPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly creatorApi = inject(CreatorApi);
  private readonly productionApi = inject(ProductionApi);
  readonly authStore = inject(AuthStore);
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
  readonly specialtyOptions = CREATOR_SPECIALTY_OPTIONS;

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    bio: ['', Validators.maxLength(2000)],
    avatarUrl: ['', Validators.maxLength(1000)]
  });

  ngOnInit(): void {
    const own = this.route.snapshot.data['own'] === true;
    this.own.set(own);

    const username = own ? this.authStore.user()?.username : this.route.snapshot.paramMap.get('username');
    if (!username) {
      this.error.set('No pudimos encontrar el perfil.');
      this.loading.set(false);
      return;
    }

    this.load(username);
  }

  toggleEdit(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }

    if (!this.editing()) {
      this.profileForm.setValue({
        displayName: profile.displayName,
        bio: profile.bio ?? '',
        avatarUrl: profile.avatarUrl ?? ''
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

    const value = this.profileForm.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.creatorApi.updateMe({
      displayName: value.displayName.trim(),
      bio: value.bio.trim() || null,
      avatarUrl: value.avatarUrl.trim() || null,
      specialties: [...this.specialties()]
    })
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.authStore.updateUser({ displayName: profile.displayName, avatarUrl: profile.avatarUrl });
          this.editing.set(false);
        },
        error: (error) => this.error.set(apiErrorMessage(error, 'No pudimos guardar el perfil.'))
      });
  }

  logout(): void {
    this.authStore.clear();
    void this.router.navigateByUrl('/explore');
  }

  statusLabel(production: OwnProductionSummary): string {
    if (production.moderationStatus === 'PENDING') {
      return 'En revisión';
    }

    if (production.moderationStatus === 'REJECTED') {
      return 'Requiere cambios';
    }

    return ({ DRAFT: 'Borrador', PUBLISHED: 'Publicada', HIDDEN: 'Oculta', REMOVED: 'Eliminada' })[production.status];
  }

  specialtyLabel(specialty: CreatorSpecialty): string {
    return this.specialtyOptions.find((option) => option.value === specialty)?.label ?? specialty;
  }

  roleLabel(role: CreatorParticipation['credits'][number]['role']): string {
    return creditRoleLabel(role);
  }


  private load(username: string): void {
    const profile$ = this.creatorApi.findByUsername(username);
    const productions$ = this.creatorApi.findProductions(username, 0, 24);
    const participations$ = this.creatorApi.findParticipations(username, 0, 24);

    if (this.own() && this.authStore.canCreate()) {
      forkJoin({ profile: profile$, productions: productions$, participations: participations$, ownProductions: this.productionApi.findOwn(null, 0, 50) })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.profile.set(data.profile);
            this.productions.set(data.productions.content);
            this.participations.set(data.participations.content);
            this.ownProductions.set(data.ownProductions.content);
            this.loading.set(false);
          },
          error: (error) => this.handleLoadError(error)
        });
      return;
    }

    forkJoin({ profile: profile$, productions: productions$, participations: participations$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.profile.set(data.profile);
          this.productions.set(data.productions.content);
          this.participations.set(data.participations.content);
          this.loading.set(false);
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  private handleLoadError(error: unknown): void {
    this.error.set(apiErrorMessage(error, 'No pudimos cargar este perfil.'));
    this.loading.set(false);
  }
}
