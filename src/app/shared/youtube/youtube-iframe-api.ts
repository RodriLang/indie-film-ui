export interface YoutubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;

  mute(): void;
  unMute(): void;

  seekTo(seconds: number, allowSeekAhead: boolean): void;

  getCurrentTime(): number;
  getDuration(): number;

  getIframe(): HTMLIFrameElement;

  destroy(): void;

  // No forma parte de la API pública documentada.
  // Lo mantenemos opcional porque lo usamos solo como best-effort
  // para ocultar subtítulos en trailers.
  unloadModule?(module: string): void;
}

export interface YoutubePlayerEvent {
  target: YoutubePlayer;
  data: number;
}

export interface YoutubeApi {
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

let youtubeApiPromise: Promise<YoutubeApi> | null = null;

export function loadYoutubeApi(): Promise<YoutubeApi> {
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
