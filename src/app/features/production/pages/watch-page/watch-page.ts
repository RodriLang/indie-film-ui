import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideHeart,
  LucidePause,
  LucidePlay,
  LucideVolume2,
  LucideVolumeX,
} from '@lucide/angular';

import { apiErrorCode, apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CurrentUserApi } from '../../../../core/auth/current-user.api';
import { ProductionApi } from '../../data/production.api';
import {
  PlaybackAccessCode,
  Production,
  ProductionVideo,
  ProductionVideoPlayback,
} from '../../data/production.models';
import { PlaybackPreferences } from '../../../../core/playback/playback-preferences';
import {
  VideoPlaybackProgress,
  VideoPlaybackTime,
  VideoPlayer,
} from '../../components/video-player/video-player';
import { ViewingProgressApi } from '../../data/viewing-progress.api';
import { ProductionProgress } from '../../data/viewing-progress.models';

@Component({
  selector: 'app-watch-page',
  imports: [
    LucideArrowLeft,
    LucideHeart,
    LucidePause,
    LucidePlay,
    LucideVolume2,
    LucideVolumeX,
    VideoPlayer,
  ],
  templateUrl: './watch-page.html',
  styleUrl: './watch-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly productionApi = inject(ProductionApi);
  private readonly currentUserApi = inject(CurrentUserApi);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly playbackPreferences = inject(PlaybackPreferences);
  private readonly viewingProgressApi = inject(ViewingProgressApi);

  private readonly videoPlayer = viewChild(VideoPlayer);

  private controlsTimer: ReturnType<typeof setTimeout> | undefined;

  readonly production = signal<Production | null>(null);
  readonly video = signal<ProductionVideo | null>(null);
  readonly playback = signal<ProductionVideoPlayback | null>(null);

  readonly loading = signal(true);
  readonly playbackLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly playbackAccess = signal<PlaybackAccessCode | null>(null);

  readonly controlsVisible = signal(false);
  readonly playing = signal(false);
  readonly liking = signal(false);
  readonly accessBusy = signal(false);

  readonly muted = signal(this.playbackPreferences.muted());

  readonly resumePositionSeconds = signal(0);

  readonly birthDateInput = signal('');

  readonly currentTime = signal(0);
  readonly duration = signal(0);

  constructor() {
    clearTimeout(this.controlsTimer);
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    const requestedVideoId =
      Number(this.route.snapshot.queryParamMap.get('videoId')) || null;

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

          this.prepareVideo(production, requestedVideoId);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos reproducir esta producción.'),
          );

          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    clearTimeout(this.controlsTimer);
  }

  login(): void {
    void this.router.navigate(['/auth'], {
      queryParams: {
        returnUrl: this.router.url,
      },
    });
  }

  seek(event: Event): void {
    const input = event.target as HTMLInputElement;

    const seconds = Number(input.value);

    if (!Number.isFinite(seconds)) {
      return;
    }

    this.currentTime.set(seconds);
    this.videoPlayer()?.seekTo(seconds);
  }

  formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));

    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  onVideoTimeChanged(time: VideoPlaybackTime): void {
    this.currentTime.set(time.positionSeconds);
    this.duration.set(time.durationSeconds);
  }

  saveBirthDate(): void {
    const birthDate = this.birthDateInput();

    if (!birthDate || this.accessBusy()) {
      return;
    }

    this.accessBusy.set(true);

    this.currentUserApi
      .updateBirthDate(birthDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.authStore.updateUser(user);
          this.accessBusy.set(false);
          this.loadPlayback();
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(
              error,
              'No pudimos guardar tu fecha de nacimiento.',
            ),
          );

          this.accessBusy.set(false);
        },
      });
  }

  grantAdultContentConsent(): void {
    if (this.accessBusy()) {
      return;
    }

    this.accessBusy.set(true);

    this.currentUserApi
      .grantAdultContentConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.authStore.updateUser(user);
          this.accessBusy.set(false);
          this.loadPlayback();
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos registrar tu consentimiento.'),
          );

          this.accessBusy.set(false);
        },
      });
  }

  onVideoProgress(progress: VideoPlaybackProgress): void {
    const video = this.video();

    if (
      !video ||
      !this.authStore.authenticated() ||
      !this.isTrackableVideo(video)
    ) {
      return;
    }

    if (!progress.ended && progress.positionSeconds < 5) {
      return;
    }

    this.viewingProgressApi
      .updateVideoProgress(video.id, {
        positionSeconds: progress.positionSeconds,

        durationSeconds: progress.durationSeconds,

        ended: progress.ended,
      })
      .subscribe({
        error: () => {
          /*
           * El progreso es secundario.
           * Una falla nunca interrumpe reproducción.
           */
        },
      });
  }

  showControls(): void {
    this.controlsVisible.set(true);
    this.scheduleControlsHide();
  }

  hideControls(): void {
    this.controlsVisible.set(false);
    clearTimeout(this.controlsTimer);
  }

  toggleControls(): void {
    if (this.controlsVisible()) {
      this.hideControls();
      return;
    }

    this.showControls();
  }

  togglePlayback(event: Event): void {
    event.stopPropagation();

    if (this.playing()) {
      this.videoPlayer()?.pause();
    } else {
      this.videoPlayer()?.play();
    }

    this.scheduleControlsHide();
  }

  onPlayingChanged(playing: boolean): void {
    this.playing.set(playing);
  }

  toggleMute(event: Event): void {
    event.stopPropagation();

    const muted = !this.muted();

    this.muted.set(muted);
    this.playbackPreferences.setMuted(muted);

    this.scheduleControlsHide();
  }

  onAutoplayMuted(): void {
    /*
     * El navegador obligó a iniciar muted.
     * No alteramos la preferencia persistida.
     */
    this.muted.set(true);
  }

  onPlayerUnavailable(): void {
    this.error.set('No pudimos reproducir este video.');
  }

  toggleLike(event: Event): void {
    event.stopPropagation();

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

    const wasLiked = production.likedByCurrentUser;
    const previousCount = production.likeCount;
    const optimisticLiked = !wasLiked;

    const optimisticCount = Math.max(
      0,
      previousCount + (optimisticLiked ? 1 : -1),
    );

    this.liking.set(true);

    this.production.set({
      ...production,
      likedByCurrentUser: optimisticLiked,
      likeCount: optimisticCount,
    });

    const request = wasLiked
      ? this.productionApi.unlike(production.slug)
      : this.productionApi.like(production.slug);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.production.update((current) =>
          current
            ? {
                ...current,
                likedByCurrentUser: result.liked,
                likeCount: result.likeCount,
              }
            : current,
        );

        this.liking.set(false);
        this.scheduleControlsHide();
      },
      error: () => {
        this.production.update((current) =>
          current
            ? {
                ...current,
                likedByCurrentUser: wasLiked,
                likeCount: previousCount,
              }
            : current,
        );

        this.liking.set(false);
        this.scheduleControlsHide();
      },
    });
  }

  back(event: Event): void {
    event.stopPropagation();

    this.videoPlayer()?.flushProgress();

    this.location.back();
  }

  private loadPlayback(): void {
    const production = this.production();
    const video = this.video();

    if (!production || !video) {
      return;
    }

    this.playback.set(null);
    this.playbackAccess.set(null);
    this.error.set(null);
    this.playbackLoading.set(true);

    this.productionApi
      .getPlayback(production.slug, video.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playback) => {
          this.playback.set(playback);
          this.playbackLoading.set(false);
        },
        error: (error) => {
          const code = apiErrorCode(error);

          if (this.isPlaybackAccessCode(code)) {
            this.playbackAccess.set(code);
          } else {
            this.error.set(
              apiErrorMessage(error, 'No pudimos reproducir este video.'),
            );
          }

          this.playbackLoading.set(false);
        },
      });
  }

  private resolveVideo(
    production: Production,
    requestedVideoId: number | null,
  ): ProductionVideo | null {
    if (requestedVideoId) {
      const requested = production.videos.find(
        (video) => video.id === requestedVideoId,
      );

      if (requested) {
        return requested;
      }
    }

    const kind = production.structure === 'EPISODIC' ? 'EPISODE' : 'MAIN';

    const candidates = production.videos.filter((video) => video.kind === kind);

    return (
      candidates.find((video) => video.videoAsset.status === 'AVAILABLE') ??
      candidates[0] ??
      null
    );
  }

  private isPlaybackAccessCode(
    code: string | null,
  ): code is PlaybackAccessCode {
    return (
      code === 'LOGIN_REQUIRED' ||
      code === 'BIRTH_DATE_REQUIRED' ||
      code === 'UNDERAGE' ||
      code === 'ADULT_CONSENT_REQUIRED' ||
      code === 'UNAVAILABLE'
    );
  }

  private scheduleControlsHide(): void {
    clearTimeout(this.controlsTimer);

    this.controlsTimer = setTimeout(
      () => this.controlsVisible.set(false),
      3200,
    );
  }

  private prepareVideo(
    production: Production,
    requestedVideoId: number | null,
  ): void {
    if (!this.authStore.authenticated()) {
      this.prepareVideoWithoutProgress(production, requestedVideoId);

      return;
    }

    this.viewingProgressApi
      .findProductionProgress(production.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.prepareVideoWithProgress(production, requestedVideoId, progress);
        },

        error: () => {
          /*
           * El progreso nunca debe impedir reproducir.
           * Si falla, continuamos sin resume.
           */
          this.prepareVideoWithoutProgress(production, requestedVideoId);
        },
      });
  }

  private prepareVideoWithProgress(
    production: Production,
    requestedVideoId: number | null,
    progress: ProductionProgress,
  ): void {
    const explicitlyRequested = requestedVideoId
      ? (production.videos.find((video) => video.id === requestedVideoId) ??
        null)
      : null;

    const resumed =
      !explicitlyRequested && progress.resumeVideoId
        ? (production.videos.find(
            (video) => video.id === progress.resumeVideoId,
          ) ?? null)
        : null;

    const video =
      explicitlyRequested ?? resumed ?? this.resolveVideo(production, null);

    this.video.set(video);

    if (!video) {
      this.loading.set(false);
      this.error.set('Video no disponible.');
      return;
    }

    this.resumePositionSeconds.set(
      this.resolveResumePosition(video, requestedVideoId, progress),
    );

    this.loading.set(false);
    this.loadPlayback();
  }

  private prepareVideoWithoutProgress(
    production: Production,
    requestedVideoId: number | null,
  ): void {
    const video = this.resolveVideo(production, requestedVideoId);

    this.video.set(video);
    this.resumePositionSeconds.set(0);
    this.loading.set(false);

    if (!video) {
      this.error.set('Video no disponible.');
      return;
    }

    this.loadPlayback();
  }

  private resolveResumePosition(
    video: ProductionVideo,
    requestedVideoId: number | null,
    progress: ProductionProgress,
  ): number {
    if (!requestedVideoId && video.id === progress.resumeVideoId) {
      return progress.resumePositionSeconds;
    }

    const videoProgress = progress.videos.find(
      (item) => item.videoId === video.id,
    );

    if (!videoProgress || videoProgress.completed) {
      return 0;
    }

    return Math.max(0, videoProgress.positionSeconds - 3);
  }

  private isTrackableVideo(video: ProductionVideo): boolean {
    return video.kind === 'MAIN' || video.kind === 'EPISODE';
  }
}
