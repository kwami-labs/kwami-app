import { registerSW } from 'virtual:pwa-register';
import { createReloader, type StaleVersionOptions } from '@/lib/staleVersion';
import { setUpdateRegistration } from '@/lib/appUpdate';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker so that a deploy reaches tabs that are already open.
 *
 * This replaces the plugin's injected `registerSW.js`, which only registered the
 * worker. With `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches`, a new worker
 * took over and deleted the old precache while the page kept running the old build,
 * whose lazy chunks were now gone from the server too (see lib/staleVersion.ts).
 * Here the page reloads when the updated worker activates, outside a voice session.
 *
 * A home-screen PWA can stay open for days, and browsers only look for a new worker on
 * navigation, so this also checks when the app comes back to the foreground and hourly.
 */
export function registerServiceWorker(options: StaleVersionOptions): void {
  const reloadWhenSafe = createReloader(options);

  registerSW({
    immediate: true,
    onNeedReload: () => {
      reloadWhenSafe();
    },
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      setUpdateRegistration(registration);
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
