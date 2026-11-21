/**
 * What an address points at, so the HUD opens it in the right widget: a video in the
 * player, a picture in the viewer, a page in the web view. Read off the address only;
 * nothing is fetched to find out.
 */

export type MediaKind = 'youtube' | 'video' | 'audio' | 'image' | 'pdf' | 'web';

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v|m3u8)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|opus)(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
const YOUTUBE_ID = /^[\w-]{11}$/;

/** An http(s) address, normalised, or null for anything else (javascript:, data:, junk). */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const SIGN_IN_HOSTS =
  /(^|\.)(accounts\.google\.com|login\.microsoftonline\.com|appleid\.apple\.com|auth0\.com|okta\.com)$/i;
const SIGN_IN_PATH = /\/(oauth2?|authorize|auth\/|sso|signin|sign-in|login|connect\/?)/i;

/**
 * Whether an address is a sign-in or an account connection. Those stay in the system
 * browser: an embedded view is refused by Google and others, and the way back into
 * the app (`kwami://`) only works from there.
 */
export function isSignInAddress(raw: string): boolean {
  try {
    const url = new URL(raw);
    return SIGN_IN_HOSTS.test(url.hostname) || SIGN_IN_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The video id of a YouTube address, in any of its shapes, or null. */
export function youtubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      id = match ? match[2] : null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Seconds from a YouTube `t` / `start` parameter (`90`, `1m30s`, `1h2m3s`). */
export function youtubeStart(raw: string): number {
  try {
    const url = new URL(raw);
    const value = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
    if (/^\d+s?$/.test(value)) return parseInt(value, 10);
    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!match || !value) return 0;
    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  } catch {
    return 0;
  }
}

export function classifyUrl(raw: string): MediaKind {
  if (youtubeId(raw)) return 'youtube';
  let path = raw;
  try {
    path = new URL(raw).pathname;
  } catch {
    // Not an absolute address: judge the text as it is.
  }
  if (VIDEO_EXT.test(path)) return 'video';
  if (AUDIO_EXT.test(path)) return 'audio';
  if (IMAGE_EXT.test(path)) return 'image';
  if (PDF_EXT.test(path)) return 'pdf';
  return 'web';
}

export interface YoutubeOptions {
  start?: number;
  end?: number;
  autoplay?: boolean;
  loop?: boolean;
}

/**
 * The privacy-enhanced embed of a video, with the JS API on so the player widget can
 * drive speed, seeking and the loop through `postMessage`.
 */
export function youtubeEmbedUrl(id: string, options: YoutubeOptions = {}): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  if (options.start && options.start > 0) params.set('start', String(Math.floor(options.start)));
  if (options.end && options.end > 0) params.set('end', String(Math.ceil(options.end)));
  if (options.autoplay) params.set('autoplay', '1');
  if (options.loop) {
    params.set('loop', '1');
    params.set('playlist', id);
  }
  if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    params.set('origin', window.location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** `75.4` → `1:15`, `3725` → `1:02:05`. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
