import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import {
  LucideCheck,
  LucideEdit3,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ProductionApi } from '../../data/production.api';
import {
  CONTENT_ADVISORY_OPTIONS,
  CONTENT_MATURITY_OPTIONS,
  CREDIT_ROLE_OPTIONS,
  ContentAdvisory,
  ContentMaturity,
  CreditRole,
  CreateProductionRequest,
  Genre,
  PRODUCTION_TYPE_OPTIONS,
  Production,
  ProductionCreditRequest,
  ProductionStructure,
  ProductionType,
  ProductionVideo,
  ProductionVideoKind,
  TitleArtPosition,
} from '../../data/production.models';

type DraftExternalCredit = {
  personName: string;
  role: CreditRole;
  roleDetail: string;
};

@Component({
  selector: 'app-publish-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideCheck,
    LucideEdit3,
    LucidePlus,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './publish-page.html',
  styleUrl: './publish-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productionApi = inject(ProductionApi);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly productionTypes = PRODUCTION_TYPE_OPTIONS;
  readonly creditRoles = CREDIT_ROLE_OPTIONS;
  readonly contentMaturities = CONTENT_MATURITY_OPTIONS;
  readonly contentAdvisories = CONTENT_ADVISORY_OPTIONS;
  readonly videoKinds: readonly ProductionVideoKind[] = [
    'MAIN',
    'EPISODE',
    'TRAILER',
    'EXTRA',
  ];
  readonly titlePositions: readonly TitleArtPosition[] = [
    'TOP',
    'CENTER',
    'BOTTOM',
  ];

  readonly production = signal<Production | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly externalCredits = signal<DraftExternalCredit[]>([]);
  readonly editingVideoId = signal<number | null>(null);
  readonly genres = signal<Genre[]>([]);
  readonly selectedGenreIds = signal<Set<number>>(new Set());

  readonly detailsForm = this.fb.group({
    title: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    description: this.fb.nonNullable.control('', Validators.maxLength(10000)),
    type: this.fb.nonNullable.control<ProductionType>(
      'SHORT_FILM',
      Validators.required,
    ),
    releaseYear: this.fb.control<number | null>(new Date().getFullYear(), [
      Validators.min(1888),
      Validators.max(9999),
    ]),
    structure: this.fb.nonNullable.control<ProductionStructure>(
      'SINGLE',
      Validators.required,
    ),
    ownRole: this.fb.nonNullable.control<CreditRole | ''>(''),
    ownRoleDetail: this.fb.nonNullable.control('', Validators.maxLength(100)),
  });

  readonly videoForm = this.fb.group({
    kind: this.fb.nonNullable.control<ProductionVideoKind>(
      'MAIN',
      Validators.required,
    ),
    videoUrl: this.fb.nonNullable.control('', Validators.required),
    title: this.fb.nonNullable.control('', Validators.maxLength(200)),
    episodeNumber: this.fb.control<number | null>(null, Validators.min(1)),
    displayOrder: this.fb.control<number | null>(null, Validators.min(0)),
    maturity: this.fb.nonNullable.control<ContentMaturity>(
      'GENERAL',
      Validators.required,
    ),
    advisories: this.fb.nonNullable.control<ContentAdvisory[]>([]),
  });

  readonly artworkForm = this.fb.group({
    posterUrl: this.fb.nonNullable.control('', Validators.maxLength(1000)),
    posterFocalX: this.fb.nonNullable.control(0.5, [
      Validators.min(0),
      Validators.max(1),
    ]),
    posterFocalY: this.fb.nonNullable.control(0.5, [
      Validators.min(0),
      Validators.max(1),
    ]),
    landscapeArtworkUrl: this.fb.nonNullable.control(
      '',
      Validators.maxLength(1000),
    ),
    titleArtUrl: this.fb.nonNullable.control('', Validators.maxLength(1000)),
    titleArtPosition: this.fb.nonNullable.control<TitleArtPosition>('BOTTOM'),
  });

  ngOnInit(): void {
    this.loadGenres();

    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug) {
      this.loadProduction(slug);
    }
  }

  advisoryLabel(advisory: ContentAdvisory): string {
    return (
      CONTENT_ADVISORY_OPTIONS.find((option) => option.value === advisory)
        ?.label ?? advisory
    );
  }

  createDraft(): void {
    if (this.detailsForm.invalid || this.busy()) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    const value = this.detailsForm.getRawValue();
    const request: CreateProductionRequest = {
      title: value.title.trim(),
      description: value.description.trim() || null,
      type: value.type,
      releaseYear: value.releaseYear,
      structure: value.structure,
      genreIds: [...this.selectedGenreIds()],
      credits: this.buildCredits(value.ownRole, value.ownRoleDetail),
    };

    this.runRequest(
      this.productionApi.create(request),
      (production) => {
        this.applyProduction(production);
        void this.router.navigate(['/studio', production.slug], {
          replaceUrl: true,
        });
        this.notice.set('Borrador creado.');
      },
      'No pudimos crear la producción.',
    );
  }

  saveDetails(): void {
    const production = this.production();
    if (!production || !this.canEdit() || this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    const value = this.detailsForm.getRawValue();
    this.runRequest(
      this.productionApi.update(production.slug, {
        title: value.title.trim(),
        description: value.description.trim() || null,
        type: value.type,
        releaseYear: value.releaseYear,
        genreIds: [...this.selectedGenreIds()],
      }),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('Datos guardados.');
      },
      'No pudimos guardar los datos.',
    );
  }

  addExternalCredit(): void {
    this.externalCredits.update((credits) => [
      ...credits,
      { personName: '', role: 'OTHER', roleDetail: '' },
    ]);
  }

  removeExternalCredit(index: number): void {
    this.externalCredits.update((credits) =>
      credits.filter((_, current) => current !== index),
    );
  }

  updateExternalCredit(
    index: number,
    field: keyof DraftExternalCredit,
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;

    this.externalCredits.update((credits) =>
      credits.map((credit, current) => {
        if (current !== index) {
          return credit;
        }

        if (field === 'role') {
          return { ...credit, role: value as CreditRole };
        }

        if (field === 'personName') {
          return { ...credit, personName: value };
        }

        return { ...credit, roleDetail: value };
      }),
    );
  }

  genreSelected(genreId: number): boolean {
    return this.selectedGenreIds().has(genreId);
  }

  toggleGenre(genreId: number): void {
    if (this.production() && !this.canEdit()) {
      return;
    }

    this.selectedGenreIds.update((current) => {
      const next = new Set(current);

      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }

      return next;
    });
  }

  advisorySelected(advisory: ContentAdvisory): boolean {
    return this.videoForm.controls.advisories.value.includes(advisory);
  }

  toggleAdvisory(advisory: ContentAdvisory): void {
    if (!this.canEdit()) {
      return;
    }

    const current = this.videoForm.controls.advisories.value;

    const next = current.includes(advisory)
      ? current.filter((item) => item !== advisory)
      : [...current, advisory];

    this.videoForm.controls.advisories.setValue(next);
  }

  submitVideo(): void {
    const production = this.production();
    if (!production || !this.canEdit() || this.videoForm.invalid) {
      this.videoForm.markAllAsTouched();
      return;
    }

    const value = this.videoForm.getRawValue();

    if (value.kind === 'EPISODE' && value.episodeNumber == null) {
      this.error.set('Indicá el número de episodio.');
      return;
    }

    const editingId = this.editingVideoId();

    if (editingId) {
      this.runRequest(
        this.productionApi.updateVideo(production.slug, editingId, {
          title: value.title.trim() || null,
          episodeNumber: value.kind === 'EPISODE' ? value.episodeNumber : null,
          displayOrder: value.displayOrder,
          maturity: value.maturity,
          advisories: value.advisories,
        }),
        (updated) => {
          this.applyProduction(updated);
          this.cancelVideoEdit();
          this.notice.set('Video actualizado.');
        },
        'No pudimos actualizar el video.',
      );
      return;
    }

    this.runRequest(
      this.productionApi.addVideo(production.slug, {
        kind: value.kind,
        videoUrl: value.videoUrl.trim(),
        title: value.title.trim() || null,
        episodeNumber: value.kind === 'EPISODE' ? value.episodeNumber : null,
        displayOrder: value.displayOrder,
        maturity: value.maturity,
        advisories: value.advisories,
      }),
      (updated) => {
        this.applyProduction(updated);
        this.resetVideoForm(updated);
        this.notice.set('Video agregado.');
      },
      'No pudimos agregar el video.',
    );
  }

  editVideo(video: ProductionVideo): void {
    if (!this.canEdit()) {
      return;
    }

    this.editingVideoId.set(video.id);

    this.videoForm.controls.videoUrl.disable();

    this.videoForm.setValue({
      kind: video.kind,
      videoUrl: '',
      title: video.title ?? '',
      episodeNumber: video.episodeNumber ?? null,
      displayOrder: video.displayOrder,
      maturity: video.maturity,
      advisories: [...video.advisories],
    });
  }

  cancelVideoEdit(): void {
    this.editingVideoId.set(null);
    this.videoForm.controls.videoUrl.enable();

    const production = this.production();

    if (production) {
      this.resetVideoForm(production);
    }
  }

  removeVideo(video: ProductionVideo): void {
    const production = this.production();
    if (!production || !this.canEdit() || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.productionApi
      .removeVideo(production.slug, video.id)
      .pipe(
        switchMap(() => this.productionApi.findOwnBySlug(production.slug)),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.applyProduction(updated);
          this.notice.set('Video eliminado.');
        },
        error: (error) =>
          this.error.set(
            apiErrorMessage(error, 'No pudimos eliminar el video.'),
          ),
      });
  }

  saveArtwork(): void {
    const production = this.production();
    if (!production || !this.canEdit() || this.artworkForm.invalid) {
      this.artworkForm.markAllAsTouched();
      return;
    }

    const value = this.artworkForm.getRawValue();
    this.runRequest(
      this.productionApi.updateArtwork(production.slug, {
        posterUrl: value.posterUrl.trim() || null,
        posterFocalX: value.posterFocalX,
        posterFocalY: value.posterFocalY,
        landscapeArtworkUrl: value.landscapeArtworkUrl.trim() || null,
        titleArtUrl: value.titleArtUrl.trim() || null,
        titleArtPosition: value.titleArtUrl.trim()
          ? value.titleArtPosition
          : null,
      }),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('Artwork guardado.');
      },
      'No pudimos guardar el artwork.',
    );
  }

  canEdit(): boolean {
    const production = this.production();
    if (!production) {
      return true;
    }

    return (
      production.status !== 'PUBLISHED' &&
      production.status !== 'REMOVED' &&
      production.moderationStatus !== 'PENDING'
    );
  }

  hasPlayableContent(): boolean {
    const production = this.production();

    if (!production) {
      return false;
    }

    if (production.structure === 'SINGLE') {
      return production.videos.some(
        (video) =>
          video.kind === 'MAIN' && video.videoAsset.status === 'AVAILABLE',
      );
    }

    return production.videos.some(
      (video) =>
        video.kind === 'EPISODE' && video.videoAsset.status === 'AVAILABLE',
    );
  }

  canSubmitForReview(): boolean {
    const production = this.production();
    return (
      !!production &&
      production.status === 'DRAFT' &&
      production.moderationStatus === 'NOT_SUBMITTED' &&
      this.hasPlayableContent()
    );
  }

  reviewHint(): string {
    const production = this.production();
    if (!production) {
      return '';
    }

    if (production.moderationStatus === 'PENDING') {
      return 'La obra está siendo revisada.';
    }

    if (production.moderationStatus === 'REJECTED') {
      return 'Hacé una corrección antes de volver a enviarla.';
    }

    if (!this.hasPlayableContent()) {
      return production.structure === 'SINGLE'
        ? 'Agregá el video principal antes de enviarla.'
        : 'Agregá al menos un episodio antes de enviarla.';
    }

    if (
      production.status === 'HIDDEN' &&
      production.moderationStatus === 'APPROVED'
    ) {
      return 'La obra sigue aprobada. Si la editás, deberá revisarse nuevamente.';
    }

    return '';
  }

  submitForReview(): void {
    const production = this.production();
    if (!production || this.busy()) {
      return;
    }

    if (!this.canSubmitForReview()) {
      this.error.set(
        this.reviewHint() ||
          'La producción todavía no está lista para revisión.',
      );
      return;
    }

    this.runRequest(
      this.productionApi.submitForReview(production.slug),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('Producción enviada a revisión.');
      },
      'No pudimos enviar la producción a revisión.',
    );
  }

  hide(): void {
    const production = this.production();
    if (!production) {
      return;
    }

    this.runRequest(
      this.productionApi.hide(production.slug),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('Producción oculta.');
      },
      'No pudimos ocultar la producción.',
    );
  }

  restorePublication(): void {
    const production = this.production();
    if (!production) {
      return;
    }

    this.runRequest(
      this.productionApi.restorePublication(production.slug),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('Producción publicada nuevamente.');
      },
      'No pudimos volver a publicar la producción.',
    );
  }

  removeProduction(): void {
    const production = this.production();
    if (!production || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.productionApi
      .remove(production.slug)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/profile'),
        error: (error) =>
          this.error.set(
            apiErrorMessage(error, 'No pudimos eliminar la producción.'),
          ),
      });
  }

  videoKindLabel(kind: ProductionVideoKind): string {
    return {
      MAIN: 'Video principal',
      EPISODE: 'Episodio',
      TRAILER: 'Trailer',
      EXTRA: 'Extra',
    }[kind];
  }

  titlePositionLabel(position: TitleArtPosition): string {
    return { TOP: 'Arriba', CENTER: 'Centro', BOTTOM: 'Abajo' }[position];
  }

  statusLabel(): string {
    const production = this.production();
    if (!production) {
      return 'Borrador';
    }

    if (production.moderationStatus === 'PENDING') {
      return 'En revisión';
    }

    if (production.moderationStatus === 'REJECTED') {
      return 'Requiere cambios';
    }

    return (
      {
        DRAFT: 'Borrador',
        PUBLISHED: 'Publicada',
        HIDDEN: 'Oculta',
        REMOVED: 'Eliminada',
      } as const
    )[production.status];
  }

  allowedVideoKinds(): readonly ProductionVideoKind[] {
    const production = this.production();
    if (!production || this.editingVideoId()) {
      return this.videoKinds;
    }

    const allowed: ProductionVideoKind[] =
      production.structure === 'EPISODIC'
        ? ['EPISODE', 'TRAILER', 'EXTRA']
        : ['MAIN', 'TRAILER', 'EXTRA'];

    return allowed.filter((kind) => {
      if (kind === 'MAIN') {
        return !production.videos.some((video) => video.kind === 'MAIN');
      }

      if (kind === 'TRAILER') {
        return !production.videos.some((video) => video.kind === 'TRAILER');
      }

      return true;
    });
  }

  private loadProduction(slug: string): void {
    this.loading.set(true);
    this.productionApi
      .findOwnBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (production) => {
          this.applyProduction(production);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos cargar el borrador.'),
          );
          this.loading.set(false);
        },
      });
  }

  private applyProduction(production: Production): void {
    this.production.set(production);
    this.selectedGenreIds.set(
      new Set(production.genres.map((genre) => genre.id)),
    );
    this.detailsForm.patchValue({
      title: production.title,
      description: production.description ?? '',
      type: production.type,
      releaseYear: production.releaseYear ?? null,
      structure: production.structure,
    });
    this.artworkForm.setValue({
      posterUrl: production.posterUrl ?? '',
      posterFocalX: production.posterFocalX,
      posterFocalY: production.posterFocalY,
      landscapeArtworkUrl: production.landscapeArtworkUrl ?? '',
      titleArtUrl: production.titleArtUrl ?? '',
      titleArtPosition: production.titleArtPosition ?? 'BOTTOM',
    });
    this.resetVideoForm(production);
    this.syncFormState(production);
  }

  private syncFormState(production: Production): void {
    const editable = this.canEdit();

    if (editable) {
      this.detailsForm.enable({ emitEvent: false });
      this.videoForm.enable({ emitEvent: false });
      this.artworkForm.enable({ emitEvent: false });
      this.detailsForm.controls.structure.disable({ emitEvent: false });
      return;
    }

    this.detailsForm.disable({ emitEvent: false });
    this.videoForm.disable({ emitEvent: false });
    this.artworkForm.disable({ emitEvent: false });
  }

  private resetVideoForm(production: Production): void {
    this.videoForm.controls.videoUrl.enable();

    const episodeCount = production.videos.filter(
      (video) => video.kind === 'EPISODE',
    ).length;
    const hasMain = production.videos.some((video) => video.kind === 'MAIN');
    const hasTrailer = production.videos.some(
      (video) => video.kind === 'TRAILER',
    );
    const defaultKind: ProductionVideoKind =
      production.structure === 'EPISODIC'
        ? 'EPISODE'
        : !hasMain
          ? 'MAIN'
          : !hasTrailer
            ? 'TRAILER'
            : 'EXTRA';

    this.videoForm.setValue({
      kind: defaultKind,
      videoUrl: '',
      title: '',
      episodeNumber: defaultKind === 'EPISODE' ? episodeCount + 1 : null,
      displayOrder:
        defaultKind === 'EPISODE' ? episodeCount + 1 : production.videos.length,
      maturity: 'GENERAL',
      advisories: [],
    });
  }

  private buildCredits(
    ownRole: CreditRole | '',
    ownRoleDetail: string,
  ): ProductionCreditRequest[] {
    const credits: ProductionCreditRequest[] = [];
    const user = this.authStore.user();

    if (ownRole && user) {
      credits.push({
        userId: user.id,
        role: ownRole,
        roleDetail: ownRoleDetail.trim() || null,
        displayOrder: credits.length,
      });
    }

    for (const credit of this.externalCredits()) {
      if (!credit.personName.trim()) {
        continue;
      }

      credits.push({
        personName: credit.personName.trim(),
        role: credit.role,
        roleDetail: credit.roleDetail.trim() || null,
        displayOrder: credits.length,
      });
    }

    return credits;
  }

  private loadGenres(): void {
    this.productionApi
      .findGenres()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (genres) => this.genres.set(genres),
        error: (error) =>
          this.error.set(
            apiErrorMessage(error, 'No pudimos cargar los géneros.'),
          ),
      });
  }

  private runRequest(
    request: ReturnType<ProductionApi['update']>,
    success: (production: Production) => void,
    fallbackError: string,
  ): void {
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: success,
        error: (error) => this.error.set(apiErrorMessage(error, fallbackError)),
      });
  }
}
