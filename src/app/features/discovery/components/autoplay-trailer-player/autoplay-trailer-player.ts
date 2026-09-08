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

interface YoutubePlayer {
  mute(): void;
  unMute(): void;
  playVideo(): void;
  destroy(): void;
}

interface YoutubePlayerEvent {
  target: YoutubePlayer;
  data: number;
}

interface YoutubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YoutubePlayerEvent) => void;
        onStateChange: (event: YoutubePlayerEvent) => void;
        onError: () => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YoutubePlayer;

  PlayerState: {
    ENDED: number;
  };
}

type YoutubeWindow = Window & {
  YT?: YoutubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<YoutubeApi> | null = null;

function loadYoutubeApi(): Promise<YoutubeApi> {
  const youtubeWindow = window as YoutubeWindow;

  if (youtubeWindow.YT?.Player) {
    return Promise.resolve(youtubeWindow.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;

    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();

      if (youtubeWindow.YT) {
        resolve(youtubeWindow.YT);
        return;
      }

      reject(new Error('YouTube API unavailable'));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (existing) {
      existing.addEventListener(
        'error',
        () => reject(new Error('Could not load YouTube API')),
        { once: true },
      );

      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;

    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error('Could not load YouTube API'));
    };

    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

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

            if (this.muted()) {
              event.target.mute();
            } else {
              event.target.unMute();
            }

            event.target.playVideo();
          },
          onStateChange: (event) => {
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
}
