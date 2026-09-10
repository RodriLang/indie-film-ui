import { isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
  LucideCheck,
  LucideHeart,
  LucideLayers3,
  LucideLink,
  LucidePlay,
  LucideUnlink,
  LucideVolume2,
  LucideVolumeX,
  LucideX,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PlaybackPreferences } from '../../../../core/playback/playback-preferences';
import { AutoplayTrailerPlayer } from '../../../discovery/components/autoplay-trailer-player/autoplay-trailer-player';
import { MediaRail } from '../../../../shared/ui/media-rail/media-rail';
import { MediaRailItem } from '../../../../shared/ui/media-rail/media-rail-item';
import { EpisodeCard } from '../../components/episode-card/episode-card';
import { CreditLinkRequestApi } from '../../data/credit-link-request.api';
import {
  ProductionCreditLinkRequest,
} from '../../data/credit-link-request.models';
import { ProductionApi } from '../../data/production.api';
import {
  CREDIT_ROLE_OPTIONS,
  CreditRole,
  creditRoleLabel,
  Production,
  ProductionCredit,
  ProductionVideo,
  ProductionVideoPlayback,
  productionTypeLabel,
} from '../../data/production.models';

@Component({
  selector: 'app-production-detail-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MediaRail,
    MediaRailItem,
    EpisodeCard,
    AutoplayTrailerPlayer,
    LucideCheck,
    LucideHeart,
    LucideLayers3,
    LucideLink,
    LucidePlay,
    LucideUnlink,
    LucideVolume2,
    LucideVolumeX,
    LucideX,
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
  private readonly creditLinkRequestApi = inject(CreditLinkRequestApi);
  private readonly fb = inject(FormBuilder);
  readonly authStore = inject(AuthStore);
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
  readonly creditRequests = signal<ProductionCreditLinkRequest[]>([]);
  readonly creditContextLoading = signal(false);
  readonly creditActionBusy = signal<number | null>(null);
  readonly expandedCreditId = signal<number | null>(null);
  readonly newClaimOpen = signal(false);
  readonly creditNotice = signal<string | null>(null);
  readonly creditError = signal<string | null>(null);
  readonly creditRoles = CREDIT_ROLE_OPTIONS;

  readonly newClaimForm = this.fb.group({
    personName: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(150),
    ]),
    role: this.fb.nonNullable.control<CreditRole>('OTHER', Validators.required),
    roleDetail: this.fb.nonNullable.control('', Validators.maxLength(100)),
  });

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
          this.loadCreditContext();
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

  toggleCreditContext(credit: ProductionCredit): void {
    if (credit.user) {
      return;
    }

    this.expandedCreditId.update((current) =>
      current === credit.id ? null : credit.id,
    );
    this.creditNotice.set(null);
    this.creditError.set(null);
  }

  pendingInvitation(): ProductionCreditLinkRequest | null {
    const userId = this.authStore.user()?.id;
    if (!userId) {
      return null;
    }

    return (
      this.creditRequests().find(
        (request) =>
          request.type === 'OWNER_INVITATION' &&
          request.status === 'PENDING' &&
          request.requestedUser.id === userId,
      ) ?? null
    );
  }

  pendingRequestForCredit(creditId: number): ProductionCreditLinkRequest | null {
    return (
      this.creditRequests().find(
        (request) =>
          request.status === 'PENDING' && request.credit?.id === creditId,
      ) ?? null
    );
  }

  pendingNewClaim(): ProductionCreditLinkRequest | null {
    const userId = this.authStore.user()?.id;
    if (!userId) {
      return null;
    }

    return (
      this.creditRequests().find(
        (request) =>
          request.type === 'USER_CLAIM' &&
          request.status === 'PENDING' &&
          request.requestedBy.id === userId &&
          !request.credit,
      ) ?? null
    );
  }

  isOwnProduction(): boolean {
    const userId = this.authStore.user()?.id;
    return !!userId && this.production()?.submittedBy.id === userId;
  }

  canClaimCredits(): boolean {
    return this.authStore.user()?.role === 'CREATOR';
  }

  explainUnlinkedCredit(credit: ProductionCredit): string {
    const request = this.pendingRequestForCredit(credit.id);
    const currentUserId = this.authStore.user()?.id;

    if (
      request?.type === 'OWNER_INVITATION' &&
      request.requestedUser.id === currentUserId
    ) {
      return 'Este crédito todavía no está vinculado. Tenés una invitación pendiente para asociarlo a tu perfil.';
    }

    if (
      request?.type === 'USER_CLAIM' &&
      request.requestedBy.id === currentUserId
    ) {
      return 'Este crédito todavía no está vinculado. Tu reclamo ya fue enviado y está pendiente de aprobación.';
    }

    if (this.pendingInvitation()) {
      return 'Este crédito no está vinculado a una cuenta. Primero resolvé la invitación pendiente que tenés en esta producción.';
    }

    if (!this.authStore.authenticated()) {
      return 'Este nombre figura en los créditos, pero todavía no está vinculado a una cuenta de creador.';
    }

    if (!this.canClaimCredits()) {
      return 'Este nombre figura en los créditos, pero no está vinculado a una cuenta. Para reclamarlo necesitás convertir tu cuenta en un perfil de creador.';
    }

    if (this.isOwnProduction()) {
      return 'Este nombre figura en los créditos, pero todavía no está vinculado a una cuenta de creador.';
    }

    return 'Este nombre figura en los créditos, pero todavía no está vinculado a una cuenta. Si sos vos, podés solicitar la vinculación.';
  }

  claimExistingCredit(credit: ProductionCredit): void {
    const production = this.production();
    if (!production || this.creditActionBusy()) {
      return;
    }

    if (!this.authStore.authenticated()) {
      this.goToAuth();
      return;
    }

    if (!this.canClaimCredits()) {
      this.creditError.set('Para reclamar una participación necesitás convertir tu cuenta en un perfil de creador.');
      return;
    }

    if (this.pendingInvitation()) {
      this.creditError.set('Primero resolvé la invitación pendiente de esta producción.');
      return;
    }

    this.creditActionBusy.set(credit.id);
    this.creditError.set(null);
    this.creditNotice.set(null);

    this.creditLinkRequestApi
      .claimExistingCredit(production.slug, credit.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          this.upsertCreditRequest(request);
          this.creditActionBusy.set(null);
          this.creditNotice.set('Reclamo enviado. El responsable de la producción debe aprobarlo.');
        },
        error: (error) => {
          this.creditActionBusy.set(null);
          this.creditError.set(apiErrorMessage(error, 'No pudimos enviar el reclamo.'));
        },
      });
  }

  openNewClaim(): void {
    if (!this.authStore.authenticated()) {
      this.goToAuth();
      return;
    }

    if (!this.canClaimCredits()) {
      this.creditError.set('Para reclamar una participación necesitás convertir tu cuenta en un perfil de creador.');
      return;
    }

    if (this.pendingInvitation()) {
      this.creditError.set('Primero resolvé la invitación pendiente de esta producción.');
      return;
    }

    const user = this.authStore.user();
    this.newClaimForm.reset({
      personName: user?.displayName ?? '',
      role: 'OTHER',
      roleDetail: '',
    });
    this.newClaimOpen.set(true);
    this.creditError.set(null);
    this.creditNotice.set(null);
  }

  closeNewClaim(): void {
    this.newClaimOpen.set(false);
  }

  submitNewClaim(): void {
    const production = this.production();
    if (!production || this.newClaimForm.invalid || this.creditActionBusy()) {
      this.newClaimForm.markAllAsTouched();
      return;
    }

    const value = this.newClaimForm.getRawValue();
    this.creditActionBusy.set(-1);
    this.creditError.set(null);
    this.creditNotice.set(null);

    this.creditLinkRequestApi
      .claimNewCredit(production.slug, {
        personName: value.personName.trim(),
        role: value.role,
        roleDetail: value.roleDetail.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          this.upsertCreditRequest(request);
          this.creditActionBusy.set(null);
          this.newClaimOpen.set(false);
          this.creditNotice.set('Solicitud enviada. El responsable de la producción debe aprobarla.');
        },
        error: (error) => {
          this.creditActionBusy.set(null);
          this.creditError.set(apiErrorMessage(error, 'No pudimos enviar la solicitud.'));
        },
      });
  }

  acceptCreditRequest(request: ProductionCreditLinkRequest): void {
    this.resolveCreditRequest(request, 'accept');
  }

  rejectCreditRequest(request: ProductionCreditLinkRequest): void {
    this.resolveCreditRequest(request, 'reject');
  }

  cancelCreditRequest(request: ProductionCreditLinkRequest): void {
    this.resolveCreditRequest(request, 'cancel');
  }

  goToAuth(): void {
    void this.router.navigate(['/auth'], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  private resolveCreditRequest(
    request: ProductionCreditLinkRequest,
    action: 'accept' | 'reject' | 'cancel',
  ): void {
    if (this.creditActionBusy()) {
      return;
    }

    this.creditActionBusy.set(request.id);
    this.creditError.set(null);
    this.creditNotice.set(null);

    const operation =
      action === 'accept'
        ? this.creditLinkRequestApi.accept(request.id)
        : action === 'reject'
          ? this.creditLinkRequestApi.reject(request.id)
          : this.creditLinkRequestApi.cancel(request.id);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.creditActionBusy.set(null);
        this.expandedCreditId.set(null);
        this.creditNotice.set(
          action === 'accept'
            ? 'Vinculación aceptada.'
            : action === 'reject'
              ? 'Solicitud rechazada.'
              : 'Solicitud cancelada.',
        );
        this.reloadProductionAndCreditContext();
      },
      error: (error) => {
        this.creditActionBusy.set(null);
        this.creditError.set(apiErrorMessage(error, 'No pudimos actualizar la solicitud.'));
      },
    });
  }

  private loadCreditContext(): void {
    const production = this.production();
    if (!production || !this.authStore.authenticated()) {
      this.creditRequests.set([]);
      return;
    }

    this.creditContextLoading.set(true);
    this.creditLinkRequestApi
      .findForProduction(production.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          this.creditRequests.set(requests);
          this.creditContextLoading.set(false);
        },
        error: () => {
          this.creditRequests.set([]);
          this.creditContextLoading.set(false);
        },
      });
  }

  private reloadProductionAndCreditContext(): void {
    const production = this.production();
    if (!production) {
      return;
    }

    this.productionApi
      .findPublishedBySlug(production.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.production.set(updated);
          this.loadCreditContext();
        },
        error: () => this.loadCreditContext(),
      });
  }

  private upsertCreditRequest(request: ProductionCreditLinkRequest): void {
    this.creditRequests.update((requests) => {
      const index = requests.findIndex((item) => item.id === request.id);
      if (index < 0) {
        return [request, ...requests];
      }

      return requests.map((item) => (item.id === request.id ? request : item));
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
