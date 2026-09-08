import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideHeart,
  LucideLayers3,
  LucidePlay,
  LucideVolume2,
  LucideVolumeX,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PlaybackPreferences } from '../../../../core/playback/playback-preferences';
import { AutoplayTrailerPlayer } from '../../../discovery/components/autoplay-trailer-player/autoplay-trailer-player';
import { MediaRail } from '../../../../shared/ui/media-rail/media-rail';
import { MediaRailItem } from '../../../../shared/ui/media-rail/media-rail-item';
import { EpisodeCard } from '../../components/episode-card/episode-card';
import { ProductionApi } from '../../data/production.api';
import {
  creditRoleLabel,
  Production,
  ProductionVideo,
  ProductionVideoPlayback,
  productionTypeLabel,
} from '../../data/production.models';

@Component({
  selector: 'app-production-detail-page',
  imports: [
    RouterLink,
    MediaRail,
    MediaRailItem,
    EpisodeCard,
    AutoplayTrailerPlayer,
    LucideHeart,
    LucideLayers3,
    LucidePlay,
    LucideVolume2,
    LucideVolumeX,
  ],
  templateUrl: './production-detail-page.html',
  styleUrl: './production-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionDetailPage implements OnInit, OnDestroy {
  private static readonly TRAILER_INTRO_MS = 1800;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productionApi = inject(ProductionApi);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly playbackPreferences = inject(PlaybackPreferences);

  private readonly browser = isPlatformBrowser(this.platformId);

  private readonly hero = viewChild<ElementRef<HTMLElement>>('hero');

  private heroObserver: IntersectionObserver | null = null;
  private observedHero: HTMLElement | null = null;
  private trailerTimer: ReturnType<typeof setTimeout> | undefined;
  private trailerAttempted = false;

  readonly production = signal<Production | null>(null);
  readonly selectedVideo = signal<ProductionVideo | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly liking = signal(false);
  readonly heroPosterFailed = signal(false);
  readonly heroLandscapeFailed = signal(false);
  readonly titleArtFailed = signal(false);

  readonly heroVisible = signal(false);

  readonly trailerPlayback = signal<ProductionVideoPlayback | null>(null);

  readonly trailerMuted = signal(true);
  readonly reducedMotion = signal(false);

  constructor() {
    if (this.browser) {
      this.reducedMotion.set(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );

      this.trailerMuted.set(this.playbackPreferences.muted());
    }

    effect(() => {
      const hero = this.hero()?.nativeElement;

      if (!this.browser || hero === this.observedHero) {
        return;
      }

      this.heroObserver?.disconnect();
      this.observedHero = hero ?? null;

      if (!hero) {
        return;
      }

      this.heroObserver = new IntersectionObserver(
        ([entry]) => {
          const visible =
            !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.6;

          this.heroVisible.set(visible);

          if (!visible) {
            this.stopTrailer();
            this.trailerAttempted = false;
            return;
          }

          if (document.visibilityState === 'visible') {
            this.scheduleTrailer();
          }
        },
        {
          threshold: [0, 0.6, 1],
        },
      );

      this.heroObserver.observe(hero);
    });
  }

  ngOnInit(): void {
    if (this.browser) {
      document.addEventListener(
        'visibilitychange',
        this.handleDocumentVisibilityChange,
      );
    }

    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.error.set('Producción no encontrada.');
      this.loading.set(false);
      return;
    }

    this.productionApi
      .findPublishedBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (production) => {
          this.production.set(production);
          this.selectedVideo.set(this.initialVideo(production));
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos cargar esta producción.'),
          );
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.heroObserver?.disconnect();
    this.heroObserver = null;
    this.observedHero = null;

    clearTimeout(this.trailerTimer);
    this.trailerPlayback.set(null);

    if (this.browser) {
      document.removeEventListener(
        'visibilitychange',
        this.handleDocumentVisibilityChange,
      );
    }
  }

  typeLabel(): string {
    return this.production()
      ? productionTypeLabel(this.production()!.type)
      : '';
  }

  creditLabel(role: Production['credits'][number]['role']): string {
    return creditRoleLabel(role);
  }

  episodes(): ProductionVideo[] {
    return (
      this.production()
        ?.videos.filter((video) => video.kind === 'EPISODE')
        .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)) ?? []
    );
  }

  selectVideo(video: ProductionVideo): void {
    const production = this.production();

    if (!production) {
      return;
    }

    void this.router.navigate(['/watch', production.slug], {
      queryParams: {
        videoId: video.id,
      },
    });
  }

  play(): void {
    const production = this.production();
    const video = this.selectedVideo();

    if (!production || !video) {
      return;
    }

    void this.router.navigate(['/watch', production.slug], {
      queryParams: {
        videoId: video.id,
      },
    });
  }

  toggleLike(): void {
    const production = this.production();

    if (!production || this.liking()) {
      return;
    }

    if (!this.authStore.authenticated()) {
      void this.router.navigate(['/auth'], {
        queryParams: {
          returnUrl: this.router.url,
        },
      });
      return;
    }

    this.liking.set(true);

    const request = production.likedByCurrentUser
      ? this.productionApi.unlike(production.slug)
      : this.productionApi.like(production.slug);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.production.update((current) =>
          current
            ? {
                ...current,
                likeCount: result.likeCount,
                likedByCurrentUser: result.liked,
              }
            : current,
        );

        this.liking.set(false);
      },
      error: () => {
        this.liking.set(false);
      },
    });
  }

  toggleTrailerSound(event: Event): void {
    event.stopPropagation();

    const muted = !this.trailerMuted();

    this.trailerMuted.set(muted);
    this.playbackPreferences.setMuted(muted);
  }

  onTrailerEnded(): void {
    this.trailerPlayback.set(null);
  }

  onTrailerUnavailable(): void {
    this.trailerPlayback.set(null);
  }

  onTrailerAutoplayMuted(): void {
    /*
     * El navegador no permitió iniciar con sonido.
     * Silenciamos esta reproducción sin modificar
     * la preferencia persistida.
     */
    this.trailerMuted.set(true);
  }

  private initialVideo(production: Production): ProductionVideo | null {
    if (production.structure === 'EPISODIC') {
      return (
        production.videos.find(
          (video) =>
            video.kind === 'EPISODE' && video.videoAsset.status === 'AVAILABLE',
        ) ?? null
      );
    }

    return (
      production.videos.find(
        (video) =>
          video.kind === 'MAIN' && video.videoAsset.status === 'AVAILABLE',
      ) ?? null
    );
  }

  private trailer(): ProductionVideo | null {
    return (
      this.production()?.videos.find(
        (video) =>
          video.kind === 'TRAILER' && video.videoAsset.status === 'AVAILABLE',
      ) ?? null
    );
  }

  private scheduleTrailer(): void {
    if (
      !this.browser ||
      this.reducedMotion() ||
      !this.heroVisible() ||
      this.trailerAttempted ||
      document.visibilityState !== 'visible'
    ) {
      return;
    }

    const production = this.production();
    const trailer = this.trailer();

    if (!production || !trailer) {
      return;
    }

    this.trailerAttempted = true;

    clearTimeout(this.trailerTimer);

    this.trailerTimer = setTimeout(() => {
      this.loadTrailer(production.slug, trailer.id);
    }, ProductionDetailPage.TRAILER_INTRO_MS);
  }

  private loadTrailer(slug: string, videoId: number): void {
    if (
      !this.browser ||
      !this.heroVisible() ||
      document.visibilityState !== 'visible'
    ) {
      return;
    }

    this.productionApi
      .getPlayback(slug, videoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playback) => {
          if (!this.heroVisible() || document.visibilityState !== 'visible') {
            return;
          }

          this.trailerPlayback.set(playback);
        },
        error: () => {
          /*
           * Un autoplay fallido nunca abre gates de login,
           * edad o consentimiento.
           */
          this.trailerPlayback.set(null);
        },
      });
  }

  private stopTrailer(): void {
    clearTimeout(this.trailerTimer);
    this.trailerPlayback.set(null);
  }

  private readonly handleDocumentVisibilityChange = (): void => {
    if (!this.browser) {
      return;
    }

    if (document.visibilityState !== 'visible') {
      this.stopTrailer();
      this.trailerAttempted = false;
      return;
    }

    if (this.heroVisible()) {
      this.scheduleTrailer();
    }
  };
}
