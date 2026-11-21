import { openUrl } from '@tauri-apps/plugin-opener';
import { isTauri } from '@/lib/platform';
import { safeHttpUrl } from './media';

/**
 * Out of the HUD, into the system browser: what Ctrl-click and the "open outside"
 * buttons do. The desktop app asks the OS (the opener plugin), the web app a new tab.
 */
export async function openExternal(raw: string): Promise<void> {
  const url = safeHttpUrl(raw);
  if (!url) return;
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
