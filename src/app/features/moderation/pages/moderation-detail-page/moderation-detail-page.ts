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
import {
  LucideArrowLeft,
  LucideCheck,
  LucideClock3,
  LucideX,
} from '@lucide/angular';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { VideoPlayer } from '../../../production/components/video-player/video-player';
import {
  CONTENT_ADVISORY_OPTIONS,
  CONTENT_MATURITY_OPTIONS,
  ContentAdvisory,
  ContentMaturity,
  creditRoleLabel,
  Production,
  productionTypeLabel,
  ProductionVideo,
  ProductionVideoKind,
  ProductionVideoPlayback,
} from '../../../production/data/production.models';
import { ProductionModerationApi } from '../../data/production-moderation.api';
import { ProductionModerationReview } from '../../data/production-moderation.models';
import { ProductionApi } from '../../../production/data/production.api';

type VideoClassificationDraft = {
  maturity: ContentMaturity;
  advisories: ContentAdvisory[];
};

@Component({
  selector: 'app-moderation-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Avatar,
    VideoPlayer,
    LucideArrowLeft,
    LucideCheck,
    LucideClock3,
    LucideX,
  ],
  templateUrl: './moderation-detail-page.html',
  styleUrl: './moderation-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly moderationApi = inject(ProductionModerationApi);
  private readonly productionApi = inject(ProductionApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly contentMaturities = CONTENT_MATURITY_OPTIONS;
  readonly contentAdvisories = CONTENT_ADVISORY_OPTIONS;

  readonly classificationDrafts = signal<
    Record<number, VideoClassificationDraft>
  >({});

  readonly production = signal<Production | null>(null);
  readonly reviews = signal<ProductionModerationReview[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly videoPlaybacks = signal<
    Record<number, ProductionVideoPlayback | null>
  >({});

  readonly videoPlaybackErrors = signal<Record<number, string>>({});

  readonly rejectForm = this.fb.nonNullable.group({
    note: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.error.set('Producción no encontrada.');
      this.loading.set(false);
      return;
    }

    forkJoin({
      production: this.moderationApi.findBySlug(slug),
      reviews: this.moderationApi
        .findReviews(slug)
        .pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ production, reviews }) => {
          this.production.set(production);
          this.reviews.set(reviews);
          this.initializeClassificationDrafts(production);
          this.loadVideoPlaybacks(production);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos cargar la producción.'),
          );
          this.loading.set(false);
        },
      });
  }

  approve(): void {
    const production = this.production();

    if (
      !production ||
      production.moderationStatus !== 'PENDING' ||
      this.busy()
    ) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.moderationApi
      .approve(production.slug, {
        videos: production.videos.map((video) => {
          const classification = this.classificationFor(video);

          return {
            videoId: video.id,
            maturity: classification.maturity,
            advisories: classification.advisories,
          };
        }),
      })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          void this.router.navigate(['/moderation'], {
            queryParams: { status: 'APPROVED' },
          }),
        error: (error) =>
          this.error.set(
            apiErrorMessage(error, 'No pudimos aprobar la producción.'),
          ),
      });
  }

  reject(): void {
    const production = this.production();

    if (
      !production ||
      production.moderationStatus !== 'PENDING' ||
      this.busy() ||
      this.rejectForm.invalid
    ) {
      this.rejectForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.moderationApi
      .reject(production.slug, {
        note: this.rejectForm.getRawValue().note.trim(),
      })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          void this.router.navigate(['/moderation'], {
            queryParams: { status: 'REJECTED' },
          }),
        error: (error) =>
          this.error.set(
            apiErrorMessage(error, 'No pudimos rechazar la producción.'),
          ),
      });
  }

  classificationFor(video: ProductionVideo): VideoClassificationDraft {
    return (
      this.classificationDrafts()[video.id] ?? {
        maturity: video.maturity,
        advisories: [...video.advisories],
      }
    );
  }

  setMaturity(videoId: number, event: Event): void {
    const maturity = (event.target as HTMLSelectElement)
      .value as ContentMaturity;

    this.classificationDrafts.update((current) => ({
      ...current,
      [videoId]: {
        ...current[videoId],
        maturity,
      },
    }));
  }

  advisorySelected(video: ProductionVideo, advisory: ContentAdvisory): boolean {
    return this.classificationFor(video).advisories.includes(advisory);
  }

  toggleAdvisory(video: ProductionVideo, advisory: ContentAdvisory): void {
    if (this.production()?.moderationStatus !== 'PENDING') {
      return;
    }

    const current = this.classificationFor(video);

    const advisories = current.advisories.includes(advisory)
      ? current.advisories.filter((item) => item !== advisory)
      : [...current.advisories, advisory];

    this.classificationDrafts.update((drafts) => ({
      ...drafts,
      [video.id]: {
        ...current,
        advisories,
      },
    }));
  }

  classificationChanged(video: ProductionVideo): boolean {
    const draft = this.classificationFor(video);

    if (draft.maturity !== video.maturity) {
      return true;
    }

    if (draft.advisories.length !== video.advisories.length) {
      return true;
    }

    return draft.advisories.some(
      (advisory) => !video.advisories.includes(advisory),
    );
  }

  typeLabel(production: Production): string {
    return productionTypeLabel(production.type);
  }

  structureLabel(production: Production): string {
    return production.structure === 'EPISODIC' ? 'Serie' : 'Una pieza';
  }

  moderationLabel(production: Production): string {
    return {
      NOT_SUBMITTED: 'Sin enviar',
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
    }[production.moderationStatus];
  }

  videoKindLabel(kind: ProductionVideoKind): string {
    return {
      MAIN: 'Video principal',
      EPISODE: 'Episodio',
      TRAILER: 'Trailer',
      EXTRA: 'Extra',
    }[kind];
  }

  creditLabel(role: Production['credits'][number]['role']): string {
    return creditRoleLabel(role);
  }

  decisionLabel(review: ProductionModerationReview): string {
    return review.decision === 'APPROVED' ? 'Aprobada' : 'Rechazada';
  }

  dateLabel(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  playbackFor(videoId: number): ProductionVideoPlayback | null {
    return this.videoPlaybacks()[videoId] ?? null;
  }

  playbackErrorFor(videoId: number): string | null {
    return this.videoPlaybackErrors()[videoId] ?? null;
  }

  private initializeClassificationDrafts(production: Production): void {
    const drafts: Record<number, VideoClassificationDraft> = {};

    for (const video of production.videos) {
      drafts[video.id] = {
        maturity: video.maturity,
        advisories: [...video.advisories],
      };
    }

    this.classificationDrafts.set(drafts);
  }

  private loadVideoPlaybacks(production: Production): void {
    this.videoPlaybacks.set({});
    this.videoPlaybackErrors.set({});

    for (const video of production.videos) {
      if (video.videoAsset.status !== 'AVAILABLE') {
        this.videoPlaybackErrors.update((current) => ({
          ...current,
          [video.id]: 'Video no disponible.',
        }));

        continue;
      }

      this.productionApi
        .getPlayback(production.slug, video.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (playback) => {
            this.videoPlaybacks.update((current) => ({
              ...current,
              [video.id]: playback,
            }));
          },
          error: (error) => {
            this.videoPlaybackErrors.update((current) => ({
              ...current,
              [video.id]: apiErrorMessage(
                error,
                'No pudimos cargar este video.',
              ),
            }));
          },
        });
    }
  }
}
