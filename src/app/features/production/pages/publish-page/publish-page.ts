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
import { finalize, of, switchMap } from 'rxjs';
import {
  LucideCheck,
  LucideLink,
  LucidePlus,
  LucideSquarePen,
  LucideTrash,
  LucideUnlink,
  LucideUserRound,
  LucideX,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CreatorApi } from '../../../user/data/creator.api';
import {
  CreatorCreditSuggestion,
  CREATOR_SPECIALTY_OPTIONS,
} from '../../../user/data/creator.models';
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
  ProductionVideoPlayback,
  TitleArtPosition,
} from '../../data/production.models';
import { ArtworkPreviewPanel } from '../../components/artwork-preview-panel/artwork-preview-panel';

type DraftExternalCredit = {
  id: number;
  personName: string;
  role: CreditRole;
  roleDetail: string;
  requestedCreator: CreatorCreditSuggestion | null;
  suggestions: CreatorCreditSuggestion[];
  suggestionsOpen: boolean;
  suggestionsLoading: boolean;
};

@Component({
  selector: 'app-publish-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ArtworkPreviewPanel,
    LucideCheck,
    LucideLink,
    LucidePlus,
    LucideSquarePen,
    LucideTrash,
    LucideUnlink,
    LucideUserRound,
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
  private readonly creatorApi = inject(CreatorApi);
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

  readonly trailerPreviewPlayback = signal<ProductionVideoPlayback | null>(
    null,
  );

  readonly trailerPreviewLoading = signal(false);
  readonly trailerPreviewFailed = signal(false);

  private trailerPreviewVideoId: number | null = null;
  private trailerPreviewRequestVersion = 0;

  private externalCreditSequence = 0;
  private readonly suggestionTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

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

  previewTitle(): string {
    return (
      this.detailsForm.controls.title.value.trim() ||
      this.production()?.title ||
      ''
    );
  }

  previewPosterUrl(): string {
    return this.artworkForm.controls.posterUrl.value.trim();
  }

  previewTitleArtUrl(): string {
    return this.artworkForm.controls.titleArtUrl.value.trim();
  }

  previewFocalX(): number {
    return this.artworkForm.controls.posterFocalX.value;
  }

  previewFocalY(): number {
    return this.artworkForm.controls.posterFocalY.value;
  }

  previewTitleArtPosition(): TitleArtPosition {
    return this.artworkForm.controls.titleArtPosition.value;
  }

  hasTrailerPreview(): boolean {
    return (
      this.production()?.videos.some((video) => video.kind === 'TRAILER') ??
      false
    );
  }

  trailerPreviewThumbnailUrl(): string {
    const trailer = this.production()?.videos.find(
      (video) => video.kind === 'TRAILER',
    );

    return trailer?.videoAsset.thumbnailUrl?.trim() ?? '';
  }

  onTrailerPreviewPlayerUnavailable(): void {
    this.trailerPreviewPlayback.set(null);
    this.trailerPreviewLoading.set(false);
    this.trailerPreviewFailed.set(true);
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

  saveChanges(): void {
    const production = this.production();

    if (
      !production ||
      !this.canEdit() ||
      this.busy() ||
      !this.hasUnsavedChanges()
    ) {
      return;
    }

    if (this.detailsForm.invalid || this.artworkForm.invalid) {
      this.detailsForm.markAllAsTouched();
      this.artworkForm.markAllAsTouched();
      return;
    }

    const details = this.detailsForm.getRawValue();
    const artwork = this.artworkForm.getRawValue();

    const videoDraft = this.videoForm.dirty
      ? {
          value: this.videoForm.getRawValue(),
          editingId: this.editingVideoId(),
          videoUrlDisabled: this.videoForm.controls.videoUrl.disabled,
        }
      : null;

    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);

    let request$ = of(production);

    if (this.detailsForm.dirty) {
      request$ = request$.pipe(
        switchMap(() =>
          this.productionApi.update(production.slug, {
            title: details.title.trim(),
            description: details.description.trim() || null,
            type: details.type,
            releaseYear: details.releaseYear,
            genreIds: [...this.selectedGenreIds()],
          }),
        ),
      );
    }

    if (this.artworkForm.dirty) {
      request$ = request$.pipe(
        switchMap(() =>
          this.productionApi.updateArtwork(production.slug, {
            posterUrl: artwork.posterUrl.trim() || null,
            posterFocalX: artwork.posterFocalX,
            posterFocalY: artwork.posterFocalY,
            landscapeArtworkUrl: artwork.landscapeArtworkUrl.trim() || null,
            titleArtUrl: artwork.titleArtUrl.trim() || null,
            titleArtPosition: artwork.titleArtUrl.trim()
              ? artwork.titleArtPosition
              : null,
          }),
        ),
      );
    }

    request$
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.applyProduction(updated);

          this.detailsForm.markAsPristine();
          this.artworkForm.markAsPristine();

          if (videoDraft) {
            this.editingVideoId.set(videoDraft.editingId);

            if (videoDraft.videoUrlDisabled) {
              this.videoForm.controls.videoUrl.disable({ emitEvent: false });
            } else {
              this.videoForm.controls.videoUrl.enable({ emitEvent: false });
            }

            this.videoForm.setValue(videoDraft.value, { emitEvent: false });
            this.videoForm.markAsDirty();
          }

          this.notice.set('Cambios guardados.');
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos guardar los cambios.'),
          );
        },
      });
  }

  discardChanges(): void {
    const production = this.production();

    if (!production || this.busy() || !this.hasLocalChanges()) {
      return;
    }

    this.editingVideoId.set(null);
    this.applyProduction(production);

    this.error.set(null);
    this.notice.set('Cambios descartados.');
  }

  hasUnsavedChanges(): boolean {
    return this.detailsForm.dirty || this.artworkForm.dirty;
  }

  hasLocalChanges(): boolean {
    return this.hasUnsavedChanges() || this.videoForm.dirty;
  }

  canSaveChanges(): boolean {
    return (
      this.canEdit() &&
      this.hasUnsavedChanges() &&
      this.detailsForm.valid &&
      this.artworkForm.valid &&
      !this.busy()
    );
  }

  addExternalCredit(): void {
    this.externalCredits.update((credits) => [
      ...credits,
      {
        id: ++this.externalCreditSequence,
        personName: '',
        role: 'OTHER',
        roleDetail: '',
        requestedCreator: null,
        suggestions: [],
        suggestionsOpen: false,
        suggestionsLoading: false,
      },
    ]);
  }

  removeExternalCredit(index: number): void {
    const credit = this.externalCredits()[index];

    if (credit) {
      const timer = this.suggestionTimers.get(credit.id);
      if (timer) {
        clearTimeout(timer);
        this.suggestionTimers.delete(credit.id);
      }
    }

    this.externalCredits.update((credits) =>
      credits.filter((_, current) => current !== index),
    );
  }

  useOnlyPersonName(index: number): void {
    const credit = this.externalCredits()[index];

    if (!credit) {
      return;
    }

    const timer = this.suggestionTimers.get(credit.id);

    if (timer) {
      clearTimeout(timer);
      this.suggestionTimers.delete(credit.id);
    }

    this.externalCredits.update((credits) =>
      credits.map((item, current) =>
        current === index
          ? {
              ...item,
              requestedCreator: null,
              suggestions: [],
              suggestionsOpen: false,
              suggestionsLoading: false,
            }
          : item,
      ),
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

    if (field === 'personName') {
      this.scheduleCreatorSuggestions(index, value);
    }
  }

  selectCreatorSuggestion(
    index: number,
    suggestion: CreatorCreditSuggestion,
  ): void {
    this.externalCredits.update((credits) =>
      credits.map((credit, current) =>
        current === index
          ? {
              ...credit,
              personName: suggestion.displayName,
              requestedCreator: suggestion,
              suggestions: [],
              suggestionsOpen: false,
              suggestionsLoading: false,
            }
          : credit,
      ),
    );
  }

  clearCreatorSelection(index: number): void {
    this.externalCredits.update((credits) =>
      credits.map((credit, current) =>
        current === index
          ? {
              ...credit,
              requestedCreator: null,
              suggestions: [],
              suggestionsOpen: false,
            }
          : credit,
      ),
    );

    const query = this.externalCredits()[index]?.personName ?? '';
    this.scheduleCreatorSuggestions(index, query);
  }

  closeCreatorSuggestions(index: number): void {
    setTimeout(() => {
      this.externalCredits.update((credits) =>
        credits.map((credit, current) =>
          current === index ? { ...credit, suggestionsOpen: false } : credit,
        ),
      );
    }, 120);
  }

  creatorSpecialties(suggestion: CreatorCreditSuggestion): string {
    return suggestion.specialties
      .slice(0, 3)
      .map(
        (specialty) =>
          CREATOR_SPECIALTY_OPTIONS.find((option) => option.value === specialty)
            ?.label ?? specialty,
      )
      .join(' · ');
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

    if (this.production()) {
      this.detailsForm.markAsDirty();
    }
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
    this.videoForm.controls.advisories.markAsDirty();
  }

  submitVideo(): void {
    const production = this.production();

    if (!production || !this.canEdit() || this.busy()) {
      return;
    }

    if (this.hasUnsavedChanges()) {
      this.error.set(
        'Guardá primero los cambios generales de la producción antes de modificar los videos.',
      );
      return;
    }

    if (this.videoForm.invalid) {
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
        this.notice.set('Video agregado.');
      },
      'No pudimos agregar el video.',
    );
  }

  editVideo(video: ProductionVideo): void {
    if (!this.canEdit() || this.busy()) {
      return;
    }

    if (this.hasUnsavedChanges()) {
      this.error.set(
        'Guardá primero los cambios generales de la producción antes de editar un video.',
      );
      return;
    }

    if (this.videoForm.dirty) {
      this.error.set(
        'Terminá o cancelá los cambios del video actual antes de editar otro.',
      );
      return;
    }

    this.error.set(null);
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

    this.videoForm.markAsPristine();
    this.videoForm.markAsUntouched();
  }

  cancelVideoEdit(): void {
    this.editingVideoId.set(null);
    this.videoForm.controls.videoUrl.enable();

    const production = this.production();

    if (production) {
      this.resetVideoForm(production);
    }
  }

  clearVideoDraft(): void {
    const production = this.production();

    if (!production || this.busy()) {
      return;
    }

    this.resetVideoForm(production);
    this.error.set(null);
  }

  removeVideo(video: ProductionVideo): void {
    const production = this.production();

    if (!production || !this.canEdit() || this.busy()) {
      return;
    }

    if (this.hasUnsavedChanges()) {
      this.error.set(
        'Guardá primero los cambios generales de la producción antes de eliminar un video.',
      );
      return;
    }

    if (this.videoForm.dirty) {
      this.error.set(
        'Terminá o cancelá los cambios del video actual antes de eliminar otro.',
      );
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
      !this.hasUnsavedChanges() &&
      !this.videoForm.dirty &&
      this.hasPlayableContent()
    );
  }

  reviewHint(): string {
    const production = this.production();

    if (!production) {
      return '';
    }

    if (production.moderationStatus === 'PENDING') {
      return 'La producción está siendo revisada. Si necesitás hacer cambios, podés volver a editarla y retirarla de la revisión actual.';
    }

    if (production.moderationStatus === 'REJECTED') {
      return 'Realizá las correcciones solicitadas, guardá los cambios y volvé a enviarla a revisión.';
    }

    if (this.hasUnsavedChanges()) {
      return 'Tenés cambios generales sin guardar.';
    }

    if (this.videoForm.dirty) {
      return 'Tenés cambios de video sin guardar.';
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
      return 'La producción está oculta y conserva su aprobación mientras no guardes modificaciones.';
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

  returnToEditing(): void {
    const production = this.production();

    if (
      !production ||
      production.moderationStatus !== 'PENDING' ||
      this.busy()
    ) {
      return;
    }

    this.runRequest(
      this.productionApi.withdrawFromReview(production.slug),
      (updated) => {
        this.applyProduction(updated);
        this.notice.set('La producción volvió a edición.');
      },
      'No pudimos retirar la producción de revisión.',
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

    if (
      !production ||
      this.busy() ||
      this.hasUnsavedChanges() ||
      this.videoForm.dirty
    ) {
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

  updatePreviewFocalX(value: number): void {
    const control = this.artworkForm.controls.posterFocalX;

    control.setValue(value);
    control.markAsDirty();
  }

  updatePreviewFocalY(value: number): void {
    const control = this.artworkForm.controls.posterFocalY;

    control.setValue(value);
    control.markAsDirty();
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

    this.detailsForm.markAsPristine();
    this.artworkForm.markAsPristine();

    this.resetVideoForm(production);
    this.syncFormState(production);
    this.syncTrailerPreview(production);
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

    this.videoForm.markAsPristine();
    this.videoForm.markAsUntouched();
  }

  private buildCredits(
    ownRole: CreditRole | '',
    ownRoleDetail: string,
  ): ProductionCreditRequest[] {
    const credits: ProductionCreditRequest[] = [];
    const user = this.authStore.user();

    if (ownRole && user) {
      credits.push({
        personName: user.displayName,
        role: ownRole,
        roleDetail: ownRoleDetail.trim() || null,
        displayOrder: credits.length,
        requestedCreatorId: user.role === 'CREATOR' ? user.id : null,
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
        requestedCreatorId: credit.requestedCreator?.id ?? null,
      });
    }

    return credits;
  }

  private scheduleCreatorSuggestions(index: number, query: string): void {
    const credit = this.externalCredits()[index];
    if (!credit || credit.requestedCreator) {
      return;
    }

    const previousTimer = this.suggestionTimers.get(credit.id);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      this.externalCredits.update((credits) =>
        credits.map((item, current) =>
          current === index
            ? {
                ...item,
                suggestions: [],
                suggestionsOpen: false,
                suggestionsLoading: false,
              }
            : item,
        ),
      );
      return;
    }

    const timer = setTimeout(() => {
      this.externalCredits.update((credits) =>
        credits.map((item) =>
          item.id === credit.id
            ? { ...item, suggestionsLoading: true, suggestionsOpen: true }
            : item,
        ),
      );

      this.creatorApi
        .findCreditSuggestions(normalizedQuery)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (suggestions) => {
            this.externalCredits.update((credits) =>
              credits.map((item) =>
                item.id === credit.id &&
                !item.requestedCreator &&
                item.personName.trim() === normalizedQuery
                  ? {
                      ...item,
                      suggestions,
                      suggestionsOpen: true,
                      suggestionsLoading: false,
                    }
                  : item,
              ),
            );
          },
          error: () => {
            this.externalCredits.update((credits) =>
              credits.map((item) =>
                item.id === credit.id &&
                item.personName.trim() === normalizedQuery
                  ? {
                      ...item,
                      suggestions: [],
                      suggestionsOpen: false,
                      suggestionsLoading: false,
                    }
                  : item,
              ),
            );
          },
        });
    }, 250);

    this.suggestionTimers.set(credit.id, timer);
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

  private syncTrailerPreview(production: Production): void {
    const trailer =
      production.videos.find(
        (video) =>
          video.kind === 'TRAILER' && video.videoAsset.status === 'AVAILABLE',
      ) ??
      production.videos.find((video) => video.kind === 'TRAILER') ??
      null;

    if (!trailer) {
      this.trailerPreviewRequestVersion++;
      this.trailerPreviewVideoId = null;
      this.trailerPreviewPlayback.set(null);
      this.trailerPreviewLoading.set(false);
      this.trailerPreviewFailed.set(false);
      return;
    }

    if (
      this.trailerPreviewVideoId === trailer.id &&
      (this.trailerPreviewPlayback() ||
        this.trailerPreviewLoading() ||
        this.trailerPreviewFailed())
    ) {
      return;
    }

    this.trailerPreviewVideoId = trailer.id;

    if (trailer.videoAsset.status === 'UNAVAILABLE') {
      this.trailerPreviewPlayback.set(null);
      this.trailerPreviewLoading.set(false);
      this.trailerPreviewFailed.set(true);
      return;
    }

    const requestVersion = ++this.trailerPreviewRequestVersion;

    this.trailerPreviewPlayback.set(null);
    this.trailerPreviewLoading.set(true);
    this.trailerPreviewFailed.set(false);

    this.productionApi
      .getPlayback(production.slug, trailer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playback) => {
          if (requestVersion !== this.trailerPreviewRequestVersion) {
            return;
          }

          this.trailerPreviewPlayback.set(playback);
          this.trailerPreviewLoading.set(false);
          this.trailerPreviewFailed.set(false);
        },
        error: () => {
          if (requestVersion !== this.trailerPreviewRequestVersion) {
            return;
          }

          /*
           * La preview del trailer es complementaria.
           * Si playback no está permitido para este estado de la producción,
           * no ensuciamos el error general de Studio: mostramos la portada.
           */
          this.trailerPreviewPlayback.set(null);
          this.trailerPreviewLoading.set(false);
          this.trailerPreviewFailed.set(true);
        },
      });
  }
}
