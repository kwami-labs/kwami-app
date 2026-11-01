/**
 * Keeping an open tab on the version that is actually deployed.
 *
 * Every deploy renames the lazy chunks (AudioPanel-<hash>.js and so on) and the old
 * files stop existing. Cloudflare's single-page-application fallback then answers a
 * request for an old chunk with index.html and a 200, so a tab still running the
 * previous build fails to import any panel it had not opened yet, and the panel stays
 * empty. That is what a phone with kwami.io left open across a deploy showed: the
 * avatar panel (already loaded) worked and every other one was blank.
 *
 * The cure is a reload onto the new build, with two guards:
 * - never in the middle of a voice session, which a reload would hang up; it waits
 *   for the session to end instead;
 * - at most once a minute, so a chunk that is genuinely broken in the new build
 *   cannot turn into a reload loop.
 */

const RELOAD_STAMP_KEY = 'kwami.staleReloadAt';
const RELOAD_COOLDOWN_MS = 60_000;

export interface StaleVersionOptions {
  /** True while something a reload would destroy is live (a voice session). */
  isBusy: () => boolean;
  /** Seam for tests; defaults to `location.reload()`. */
  reload?: () => void;
  /** Seam for tests; defaults to `Date.now()`. */
  now?: () => number;
}

function readStamp(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_STAMP_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStamp(value: number): void {
  try {
    sessionStorage.setItem(RELOAD_STAMP_KEY, String(value));
  } catch {
    // Storage blocked (private mode): the reload still happens, only the loop guard is lost.
  }
}

/**
 * Returns a function that reloads onto the deployed build as soon as it is safe to:
 * now if idle, otherwise when the voice session ends. Returns false when a reload was
 * already attempted within the cooldown and this one was skipped.
 */
export function createReloader(options: StaleVersionOptions): () => boolean {
  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? (() => Date.now());
  let waitingForIdle = false;

  const reloadNow = () => {
    writeStamp(now());
    reload();
  };

  return () => {
    if (now() - readStamp() < RELOAD_COOLDOWN_MS) return false;
    if (!options.isBusy()) {
      reloadNow();
      return true;
    }
    if (!waitingForIdle) {
      waitingForIdle = true;
      window.addEventListener(
        'kwami:disconnected',
        () => {
          waitingForIdle = false;
          reloadNow();
        },
        { once: true },
      );
    }
    return true;
  };
}

/**
 * Reload when a lazy chunk fails to load. Vite wraps every dynamic import in a helper
 * that dispatches `vite:preloadError` when the chunk (or one of its preloads) cannot be
 * fetched or evaluated, which is exactly the stale-build symptom above.
 */
export function installStaleChunkRecovery(options: StaleVersionOptions): () => void {
  const reloadWhenSafe = createReloader(options);
  const onPreloadError = () => {
    reloadWhenSafe();
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
