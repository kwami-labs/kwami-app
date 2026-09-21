/**
 * The YouTube IFrame Player API, loaded once.
 *
 * The login backdrop embeds a crate track's watch URL as a muted picture.
 * Audio stays on the same-origin file — this only paints. The API is what
 * lets play/pause follow the soundtrack pill; a bare iframe cannot be paused
 * without tearing it down.
 */

export interface YoutubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  destroy: () => void;
}

export interface YoutubePlayerHandlers {
  onReady?: (player: YoutubePlayer) => void;
  onError?: () => void;
}

type YoutubeApi = {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YoutubePlayer }) => void;
        onError?: () => void;
      };
    },
  ) => YoutubePlayer;
};

declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YoutubeApi> | null = null;

export function loadYoutubeIframeApi(): Promise<YoutubeApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API needs a window'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<YoutubeApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube IFrame API loaded without Player'));
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        loading = null;
        reject(new Error('YouTube IFrame API failed to load'));
      };
      document.head.appendChild(script);
    }
  });

  return loading;
}

export function createYoutubePlayer(
  el: HTMLElement,
  videoId: string,
  handlers: YoutubePlayerHandlers = {},
): Promise<YoutubePlayer> {
  return loadYoutubeIframeApi().then(
    (api) =>
      new Promise<YoutubePlayer>((resolve) => {
        const player = new api.Player(el, {
          videoId,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            loop: 1,
            playlist: videoId,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              event.target.mute();
              handlers.onReady?.(event.target);
              resolve(event.target);
            },
            onError: () => handlers.onError?.(),
          },
        });
      }),
  );
}
