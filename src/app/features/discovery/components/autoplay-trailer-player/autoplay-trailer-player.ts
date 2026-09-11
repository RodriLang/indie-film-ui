import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';

import { ProductionVideoPlayback } from '../../../production/data/production.models';
import {
  loadYoutubeApi,
  YoutubePlayer,
} from '../../../../shared/youtube/youtube-iframe-api';

@Component({
  selector: 'app-autoplay-trailer-player',
  host: {
    '[class.cover]': "fit() === 'cover'",
  },
  templateUrl: './autoplay-trailer-player.html',
  styleUrl: './autoplay-trailer-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoplayTrailerPlayer implements AfterViewInit, OnDestroy {
  private static readonly SOURCE_ASPECT_RATIO = 9 / 16;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  private player: YoutubePlayer | null = null;
  private playerReady = false;
  private destroyed = false;

  private resizeObserver: ResizeObserver | null = null;

  readonly playback = input.required<ProductionVideoPlayback>();
  readonly muted = input.required<boolean>();
  readonly fit = input<'contain' | 'cover'>('contain');

  readonly ended = output<void>();
  readonly unavailable = output<void>();
  readonly autoplayMuted = output<void>();

  constructor() {
    effect(() => {
      const muted = this.muted();

      if (!this.player || !this.playerReady) {
        return;
      }

      if (muted) {
        this.player.mute();
      } else {
        this.player.unMute();
      }
    });

    effect(() => {
      const fit = this.fit();

      if (!this.player || !this.playerReady) {
        return;
      }

      this.applyFit(this.player, fit);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const playback = this.playback();

    if (playback.provider !== 'YOUTUBE') {
      this.unavailable.emit();
      return;
    }

    try {
      const youtube = await loadYoutubeApi();

      if (this.destroyed) {
        return;
      }

      this.player = new youtube.Player(this.host().nativeElement, {
        width: '100%',
        height: '100%',
        videoId: playback.externalId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: (event) => {
            this.playerReady = true;

            this.applyFit(event.target, this.fit());
            this.observeContainer(event.target);
            this.disableCaptions(event.target);

            if (this.muted()) {
              event.target.mute();
            } else {
              event.target.unMute();
            }

            event.target.playVideo();
          },

          onStateChange: (event) => {
            this.disableCaptions(event.target);

            if (event.data === youtube.PlayerState.ENDED) {
              this.ended.emit();
            }
          },

          onError: () => {
            this.unavailable.emit();
          },

          onAutoplayBlocked: () => {
            if (!this.playerReady) {
              return;
            }

            this.player?.mute();
            this.player?.playVideo();

            this.autoplayMuted.emit();
          },
        },
      });
    } catch {
      if (!this.destroyed) {
        this.unavailable.emit();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.playerReady = false;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.player?.destroy();
    this.player = null;
  }

  private observeContainer(player: YoutubePlayer): void {
    const iframe = player.getIframe();
    const container = iframe.parentElement;

    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.destroyed && this.playerReady) {
        this.applyFit(player, this.fit());
      }
    });

    this.resizeObserver.observe(container);
  }

  private applyFit(player: YoutubePlayer, fit: 'contain' | 'cover'): void {
    const iframe = player.getIframe();

    iframe.style.position = 'absolute';
    iframe.style.top = '50%';
    iframe.style.left = '50%';
    iframe.style.transform = 'translate(-50%, -50%)';

    if (fit !== 'cover') {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      return;
    }

    const container = iframe.parentElement;

    if (!container) {
      iframe.style.width = '100%';
      iframe.style.height = '133.333%';
      return;
    }

    const rect = container.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const containerAspectRatio = rect.width / rect.height;

    if (containerAspectRatio >= AutoplayTrailerPlayer.SOURCE_ASPECT_RATIO) {
      /*
       * El contenedor es proporcionalmente más ancho que el video 9:16.
       * Cubrimos todo el ancho y recortamos verticalmente.
       */
      iframe.style.width = '100%';
      iframe.style.height = `${
        (containerAspectRatio / AutoplayTrailerPlayer.SOURCE_ASPECT_RATIO) * 100
      }%`;

      return;
    }

    /*
     * El contenedor es proporcionalmente más angosto que el video.
     * Cubrimos todo el alto y recortamos horizontalmente.
     */
    iframe.style.height = '100%';
    iframe.style.width = `${
      (AutoplayTrailerPlayer.SOURCE_ASPECT_RATIO / containerAspectRatio) * 100
    }%`;
  }

  private disableCaptions(player: YoutubePlayer): void {
    try {
      player.unloadModule?.('captions');
      player.unloadModule?.('cc');
    } catch {
      /*
       * YouTube no expone una API pública para forzar
       * captions off. Esto es únicamente best effort.
       */
    }
  }
}
