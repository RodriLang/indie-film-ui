import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideVolume2, LucideVolumeX } from '@lucide/angular';

import { PlaybackPreferences } from '../../../../core/playback/playback-preferences';
import { ProductionApi } from '../../../production/data/production.api';
import {
  ProductionSummary,
  ProductionVideoPlayback,
} from '../../../production/data/production.models';
import { AutoplayTrailerPlayer } from '../autoplay-trailer-player/autoplay-trailer-player';


const POSTER_INTRO_MS = 1800;
const NO_TRAILER_DURATION_MS = 7000;
const MAX_TRAILER_DURATION_MS = 60000;

@Component({
  selector: 'app-primary-stage',
  imports: [RouterLink, AutoplayTrailerPlayer, LucideVolume2, LucideVolumeX],
  templateUrl: './primary-stage.html',
  styleUrl: './primary-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryStage implements AfterViewInit, OnDestroy {
  private readonly productionApi = inject(ProductionApi);
  private readonly playbackPreferences = inject(PlaybackPreferences);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stageRoot =
    viewChild.required<ElementRef<HTMLElement>>('stageRoot');

  private readonly viewport =
    viewChild.required<ElementRef<HTMLElement>>('viewport');

  private scrollTimer: ReturnType<typeof setTimeout> | undefined;
  private introTimer: ReturnType<typeof setTimeout> | undefined;
  private advanceTimer: ReturnType<typeof setTimeout> | undefined;
  private trailerMaxTimer: ReturnType<typeof setTimeout> | undefined;

  private intersectionObserver: IntersectionObserver | null = null;
  private cycleVersion = 0;

  readonly productions = input.required<ProductionSummary[]>();

  readonly activeIndex = signal(0);
  readonly reducedMotion = signal(false);
  readonly stageVisible = signal(false);

  readonly trailerPlayback = signal<ProductionVideoPlayback | null>(null);

  readonly stageMuted = signal(true);

  constructor() {
    if (!this.browser) {
      return;
    }

    this.reducedMotion.set(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    this.stageMuted.set(this.playbackPreferences.muted());
  }

  ngAfterViewInit(): void {
    if (!this.browser) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const visible =
          !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.6;

        this.stageVisible.set(visible);

        if (visible && document.visibilityState === 'visible') {
          this.restartCycle();
        } else {
          this.stopCycle();
        }
      },
      {
        threshold: [0, 0.6, 1],
      },
    );

    this.intersectionObserver.observe(this.stageRoot().nativeElement);

    document.addEventListener(
      'visibilitychange',
      this.handleDocumentVisibilityChange,
    );
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    if (this.browser) {
      document.removeEventListener(
        'visibilitychange',
        this.handleDocumentVisibilityChange,
      );
    }

    clearTimeout(this.scrollTimer);
    this.stopCycle();
  }

  onScroll(): void {
    this.stopCycle();

    clearTimeout(this.scrollTimer);

    this.scrollTimer = setTimeout(() => this.finishScroll(), 140);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();

    this.goTo(this.activeIndex() + (event.key === 'ArrowRight' ? 1 : -1));
  }

  goTo(index: number): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const next = Math.max(0, Math.min(index, targets.length - 1));

    this.stopCycle();

    if (Math.abs(viewport.scrollLeft - targets[next]) <= 2) {
      this.activeIndex.set(next);
      this.restartCycle();
      return;
    }

    viewport.scrollTo({
      left: targets[next],
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
    });
  }

  toggleSound(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const muted = !this.stageMuted();

    this.stageMuted.set(muted);
    this.playbackPreferences.setMuted(muted);
  }

  onTrailerEnded(): void {
    this.advanceToNext();
  }

  onTrailerUnavailable(): void {
    const version = this.cycleVersion;

    this.trailerPlayback.set(null);
    clearTimeout(this.trailerMaxTimer);

    this.scheduleAdvance(
      Math.max(0, NO_TRAILER_DURATION_MS - POSTER_INTRO_MS),
      version,
    );
  }

  onAutoplayMuted(): void {
    // El navegador bloqueó autoplay con sonido.
    // No modificamos la preferencia persistida.
    this.stageMuted.set(true);
  }

  distanceFromActive(index: number): number {
    return Math.abs(index - this.activeIndex());
  }

  private readonly handleDocumentVisibilityChange = (): void => {
    if (!this.browser) {
      return;
    }

    if (document.visibilityState === 'visible' && this.stageVisible()) {
      this.restartCycle();
      return;
    }

    this.stopCycle();
  };

  private finishScroll(): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const nearest = this.findNearestIndex(viewport.scrollLeft, targets);

    this.activeIndex.set(nearest);
    this.restartCycle();
  }

  private restartCycle(): void {
    this.stopCycle();

    if (!this.canRunCycle()) {
      return;
    }

    const production = this.productions()[this.activeIndex()];

    if (!production) {
      return;
    }

    const version = this.cycleVersion;
    const trailer = production.trailer;

    if (!trailer?.videoId) {
      this.scheduleAdvance(NO_TRAILER_DURATION_MS, version);

      return;
    }

    this.introTimer = setTimeout(() => {
      this.loadTrailer(production, trailer.videoId, version);
    }, POSTER_INTRO_MS);
  }

  private loadTrailer(
    production: ProductionSummary,
    videoId: number,
    version: number,
  ): void {

    if (!this.isCurrentCycle(version)) {
      return;
    }

    this.productionApi
      .getPlayback(production.slug, videoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playback) => {
          if (!this.isCurrentCycle(version)) {
            return;
          }

          this.trailerPlayback.set(playback);

          this.trailerMaxTimer = setTimeout(() => {
            if (this.isCurrentCycle(version)) {
              this.advanceToNext();
            }
          }, MAX_TRAILER_DURATION_MS);
        },
        error: () => {
          if (!this.isCurrentCycle(version)) {
            return;
          }

          this.scheduleAdvance(
            Math.max(0, NO_TRAILER_DURATION_MS - POSTER_INTRO_MS),
            version,
          );
        },
      });
  }

  private scheduleAdvance(delay: number, version: number): void {
    if (this.productions().length <= 1) {
      return;
    }

    clearTimeout(this.advanceTimer);

    this.advanceTimer = setTimeout(() => {
      if (this.isCurrentCycle(version)) {
        this.advanceToNext();
      }
    }, delay);
  }

  private advanceToNext(): void {
    if (this.productions().length <= 1) {
      this.stopCycle();
      return;
    }

    const next = (this.activeIndex() + 1) % this.productions().length;

    this.goTo(next);
  }

  private stopCycle(): void {
    this.cycleVersion++;

    clearTimeout(this.introTimer);
    clearTimeout(this.advanceTimer);
    clearTimeout(this.trailerMaxTimer);

    this.trailerPlayback.set(null);
  }

  private canRunCycle(): boolean {
    if (!this.browser) {
      return false;
    }

    return (
      this.stageVisible() &&
      document.visibilityState === 'visible' &&
      !this.reducedMotion() &&
      this.productions().length > 0
    );
  }

  private isCurrentCycle(version: number): boolean {
    return version === this.cycleVersion && this.canRunCycle();
  }

  private getSnapTargets(viewport: HTMLElement): number[] {
    const items = Array.from(viewport.children) as HTMLElement[];

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    return items.map((item) => {
      const centered =
        item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2;

      return Math.max(0, Math.min(centered, maxScroll));
    });
  }

  private findNearestIndex(position: number, targets: number[]): number {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    targets.forEach((target, index) => {
      const distance = Math.abs(position - target);

      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });

    return nearestIndex;
  }
}
