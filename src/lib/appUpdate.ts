/**
 * The "check for update" button in Settings.
 *
 * registerServiceWorker.ts already looks for a new deploy on focus and hourly, but on a
 * phone the installed PWA can sit on an old build for a long time and the user has no
 * way to tell or to ask for the new one. This keeps the worker registration so the
 * button can check at once, and offers a clean reload when a build is truly stuck.
 */

export type UpdateCheckResult = 'updating' | 'latest' | 'offline' | 'unavailable';

let registration: ServiceWorkerRegistration | null = null;

/** Called by registerServiceWorker once the worker is registered. */
export function setUpdateRegistration(value: ServiceWorkerRegistration | null): void {
  registration = value;
}

export function currentBuild(): { sha: string; builtAt: string } {
  return __APP_BUILD__;
}

/**
 * Asks the server for a newer worker. When one is found it installs and takes over on
 * its own (`registerType: 'autoUpdate'`), and registerServiceWorker reloads the page
 * when that happens, outside a voice session.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!registration) return 'unavailable';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  try {
    await registration.update();
  } catch {
    return 'offline';
  }
  return registration.installing || registration.waiting ? 'updating' : 'latest';
}

/**
 * Drops every service worker and cache of this site and reloads from the network.
 * Account data lives in Supabase and local storage, which this leaves alone.
 */
export async function forceFreshReload(
  reload: () => void = () => location.reload(),
): Promise<void> {
  try {
    const workers = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(workers.map((worker) => worker.unregister()));
  } catch {
    // Without access to the workers a plain reload is still better than nothing.
  }
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Same as above.
  }
  reload();
}
