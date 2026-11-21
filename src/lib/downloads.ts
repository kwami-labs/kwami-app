/**
 * Where a download ends up, and the way to its folder (2026-11-21).
 *
 * In the desktop app every download goes to the Windows folder of its kind, in a `KWAMI`
 * folder (`src-tauri`, module `downloads`): Videos, Pictures, Music, Documents or Downloads.
 * Tauri says where each one went (`kwami-download`). What Jarvis's own browser downloads goes
 * to his folder, Documents\Jarvis\descargas, and arrives as a `browser_download` message
 * (`kwami:agent_message`: the SDK passes a `browser_session` on with only its action, url and
 * title). In a browser the browser shows its own downloads, so nothing here does anything there.
 */
import { isTauri } from '@/lib/platform';

export interface SavedDownload {
  name: string;
  path: string;
  folder: string;
  success: boolean;
}

/** What the agent sends when Jarvis's browser finished a download. */
export interface JarvisDownload {
  type: 'browser_download';
  state: 'completed' | 'canceled' | 'unsaved' | string;
  name: string;
  path: string;
  size?: number;
}

export const DOWNLOAD_EVENT = 'kwami-download';

/** A download the desktop app saved, read from Tauri's event; null when it is not one. */
export function savedDownload(payload: unknown): SavedDownload | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.path !== 'string' || !p.path) return null;
  return {
    name: typeof p.name === 'string' && p.name ? p.name : p.path.split(/[\\/]/).pop() || p.path,
    path: p.path,
    folder: typeof p.folder === 'string' ? p.folder : '',
    success: p.success === true,
  };
}

/** Jarvis's browser's download, read from the agent's message; null when it is not one. */
export function jarvisDownload(detail: unknown): JarvisDownload | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  if (d.type !== 'browser_download' || typeof d.name !== 'string' || !d.name) return null;
  return {
    type: 'browser_download',
    state: typeof d.state === 'string' ? d.state : '',
    name: d.name,
    path: typeof d.path === 'string' ? d.path : '',
    size: typeof d.size === 'number' ? d.size : undefined,
  };
}

/** Show a downloaded file in its folder. Only in the desktop app, only for its own downloads. */
export async function revealDownload(path: string): Promise<boolean> {
  if (!isTauri() || !path) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('reveal_download', { path });
    return true;
  } catch {
    return false;
  }
}

/** Hear each download the desktop app finishes. In a browser there is nothing to hear. */
export async function onSavedDownload(
  handler: (download: SavedDownload) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen(DOWNLOAD_EVENT, (event) => {
    const download = savedDownload(event.payload);
    if (download) handler(download);
  });
}
