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

import { ProductionVideoPlayback } from '../../data/production.models';

interface YoutubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  mute(): void;
  unMute(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
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
    PLAYING: number;
    PAUSED: number;
  };
}

type YoutubeWindow = Window & {
  YT?: YoutubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

export interface VideoPlaybackProgress {
  positionSeconds: number;
  durationSeconds: number;
  ended: boolean;
}

export interface VideoPlaybackTime {
  positionSeconds: number;
  durationSeconds: number;
}

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
  selector: 'app-video-player',
  templateUrl: './video-player.html',
  styleUrl: './video-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayer implements AfterViewInit, OnDestroy {
  private static readonly PROGRESS_INTERVAL_MS = 10000;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  private player: YoutubePlayer | null = null;
  private playerReady = false;
  private destroyed = false;
  private playbackEnded = false;

  private observer: IntersectionObserver | null = null;

  private progressTimer: ReturnType<typeof setInterval> | undefined;
  private timeTimer: ReturnType<typeof setInterval> | undefined;

  readonly playback = input.required<ProductionVideoPlayback>();

  readonly title = input('Video');

  readonly startAt = input(0);

  readonly autoplay = input(false);

  readonly muted = input(false);

  readonly controls = input(true);

  readonly progress = output<VideoPlaybackProgress>();

  readonly playingChanged = output<boolean>();

  readonly ended = output<void>();

  readonly unavailable = output<void>();

  readonly autoplayMuted = output<void>();

  readonly timeChanged = output<VideoPlaybackTime>();

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
    if (!this.browser) {
      return;
    }

    const playback = this.playback();

    if (playback.provider !== 'YOUTUBE') {
      this.unavailable.emit();
      return;
    }

    this.createVisibilityObserver();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);

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
          autoplay: 0,
          mute: this.muted() ? 1 : 0,
          controls: this.controls() ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            this.playerReady = true;

            const startAt = Math.max(0, this.startAt());

            if (startAt > 0) {
              event.target.seekTo(startAt, true);
            }

            if (this.muted()) {
              event.target.mute();
            } else {
              event.target.unMute();
            }

            if (this.autoplay()) {
              event.target.playVideo();
            }
          },

          onStateChange: (event) => {
            if (event.data === youtube.PlayerState.PLAYING) {
              /*
               * Algunos embeds pueden intentar volver a reproducirse
               * después de ENDED. Mientras siga marcado como finalizado,
               * no permitimos ese reinicio automático.
               */
              if (this.playbackEnded) {
                event.target.pauseVideo();
                return;
              }

              this.playingChanged.emit(true);
              this.startProgressTimer();
              this.startTimeTimer();
              return;
            }

            if (event.data === youtube.PlayerState.PAUSED) {
              this.playingChanged.emit(false);
              this.stopProgressTimer();
              this.stopTimeTimer();

              if (!this.playbackEnded) {
                this.emitProgress(false);
              }

              return;
            }

            if (event.data === youtube.PlayerState.ENDED) {
              this.playbackEnded = true;

              this.playingChanged.emit(false);
              this.stopProgressTimer();
              this.stopTimeTimer();

              this.emitProgress(true);
              event.target.pauseVideo();

              this.ended.emit();
            }
          },

          onError: () => {
            this.stopProgressTimer();
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

    if (!this.playbackEnded) {
      this.emitProgress(false);
    }

    this.stopProgressTimer();
    this.stopTimeTimer();

    this.observer?.disconnect();
    this.observer = null;

    if (this.browser) {
      document.removeEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      );
    }

    this.playerReady = false;

    this.player?.destroy();
    this.player = null;
  }

  play(): void {
    if (!this.player || !this.playerReady) {
      return;
    }

    if (this.playbackEnded) {
      this.playbackEnded = false;
      this.player.seekTo(0, true);
    }

    this.player.playVideo();
  }

  pause(): void {
    if (!this.playerReady) {
      return;
    }

    this.emitProgress(false);
    this.player?.pauseVideo();
  }

  flushProgress(): void {
    this.emitProgress(false);
  }

  seekTo(seconds: number): void {
    if (!this.player || !this.playerReady) {
      return;
    }

    const duration = this.player.getDuration();

    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const position = Math.max(0, Math.min(seconds, duration));

    this.player.seekTo(position, true);
  }

  private createVisibilityObserver(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.25) {
          return;
        }

        this.emitProgress(false);
        this.player?.pauseVideo();
      },
      {
        threshold: [0, 0.25, 1],
      },
    );

    this.observer.observe(this.frame().nativeElement);
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();

    this.progressTimer = setInterval(
      () => this.emitProgress(false),
      VideoPlayer.PROGRESS_INTERVAL_MS,
    );
  }

  private stopProgressTimer(): void {
    clearInterval(this.progressTimer);
  }

  private emitProgress(ended: boolean): void {
    if (!this.player || !this.playerReady) {
      return;
    }

    const currentTime = this.player.getCurrentTime();
    const duration = this.player.getDuration();

    if (
      !Number.isFinite(currentTime) ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return;
    }

    this.progress.emit({
      positionSeconds: ended
        ? Math.max(1, Math.floor(duration))
        : Math.max(0, Math.floor(currentTime)),
      durationSeconds: Math.max(1, Math.floor(duration)),
      ended,
    });
  }

  private readonly handleVisibilityChange = (): void => {
    if (!this.browser || document.visibilityState === 'visible') {
      return;
    }

    this.emitProgress(false);
    this.player?.pauseVideo();
  };

  private startTimeTimer(): void {
    this.stopTimeTimer();

    this.emitTime();

    this.timeTimer = setInterval(() => this.emitTime(), 250);
  }

  private stopTimeTimer(): void {
    clearInterval(this.timeTimer);
  }

  private emitTime(): void {
    if (!this.player || !this.playerReady) {
      return;
    }

    const positionSeconds = this.player.getCurrentTime();

    const durationSeconds = this.player.getDuration();

    if (
      !Number.isFinite(positionSeconds) ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return;
    }

    this.timeChanged.emit({
      positionSeconds,
      durationSeconds,
    });
  }
}
