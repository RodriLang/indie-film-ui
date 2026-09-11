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
  private readonly platformId = inject(PLATFORM_ID);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  private player: YoutubePlayer | null = null;
  private playerReady = false;
  private destroyed = false;

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

            this.applyFit(event.target);
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

    this.player?.destroy();
    this.player = null;
  }

  private applyFit(player: YoutubePlayer): void {
    if (this.fit() !== 'cover') {
      return;
    }

    const iframe = player.getIframe();

    iframe.style.width = '100%';
    iframe.style.height = '133.333%';

    iframe.style.position = 'absolute';
    iframe.style.top = '50%';
    iframe.style.left = '50%';

    iframe.style.transform = 'translate(-50%, -50%)';
  }

  private disableCaptions(player: YoutubePlayer): void {
    try {
      player.unloadModule?.('captions');
      player.unloadModule?.('cc');
    } catch {
      // YouTube no expone una API pública para forzar captions off.
    }
  }
}
