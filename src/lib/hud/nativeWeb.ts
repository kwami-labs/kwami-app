import { isTauri } from '@/lib/platform';

/**
 * The desktop app's own web view for the HUD (src-tauri/src/lib.rs, `hud_web_*`).
 *
 * Most sites refuse to be shown in an `<iframe>`, so in Tauri each web window of the
 * HUD gets a native child webview laid exactly over its body. The window keeps it in
 * place: bounds on every move and resize, hidden while folded into the dock or
 * covered by the window being dragged. In the browser build there is no such thing,
 * and the web widget falls back to an iframe.
 */

export interface NativeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeWebEvent {
  label: string;
  url: string;
  loading: boolean;
}

const PREFIX = 'hud-web-';

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let invokeFn: Invoke | null = null;

async function invoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  if (!invokeFn) invokeFn = (await import('@tauri-apps/api/core')).invoke as Invoke;
  return invokeFn(cmd, args);
}

export function nativeWebAvailable(): boolean {
  return isTauri();
}

/**
 * How much the app's own page is zoomed (the interface size, lib/uiScale). The page
 * measures in its CSS pixels and the views are placed in the window's logical ones;
 * zoomed, one CSS pixel is `scale` logical ones, and a view placed unscaled lands short
 * of its window and too small.
 */
let scale = 1;
export function setNativeScale(factor: number): void {
  scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
}
export function nativeScale(): number {
  return scale;
}

function round(bounds: NativeBounds): NativeBounds {
  return {
    x: Math.round(bounds.x * scale),
    y: Math.round(bounds.y * scale),
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale)),
  };
}

// -- one owner per view ---------------------------------------------------------------

/**
 * A window's view outlives the component that shows it for a moment: a hot reload, a
 * move to another screen or into a tab group unmounts the window and mounts it again
 * at once. Closing on unmount raced the open of the new mount (the open found the view
 * being closed, failed, and the window fell back to an iframe while the view stayed,
 * misplaced). So a close waits a moment, and a window mounting with the same label
 * takes the view over instead.
 */
const CLOSE_DELAY_MS = 600;
const pendingClose = new Map<string, ReturnType<typeof setTimeout>>();
const owners = new Map<string, symbol>();

/** Take the view for `label`; true when one from an earlier mount is still there to adopt. */
export function claimNative(label: string, owner: symbol): boolean {
  owners.set(label, owner);
  const pending = pendingClose.get(label);
  if (!pending) return false;
  clearTimeout(pending);
  pendingClose.delete(label);
  return true;
}

export function ownsNative(label: string, owner: symbol): boolean {
  return owners.get(label) === owner;
}

/** Close the view soon, unless a new mount claims it first. */
export function releaseNative(label: string, owner: symbol): void {
  if (owners.get(label) !== owner) return;
  const pending = pendingClose.get(label);
  if (pending) clearTimeout(pending);
  pendingClose.set(
    label,
    setTimeout(() => {
      pendingClose.delete(label);
      if (owners.get(label) !== owner) return;
      owners.delete(label);
      void nativeWeb.close(label).catch(() => {});
    }, CLOSE_DELAY_MS),
  );
}

/** Where the view really is, in physical pixels; null when there is none (or no Tauri). */
export async function nativeRect(label: string): Promise<NativeBounds | null> {
  if (!isTauri()) return null;
  try {
    const { getAllWebviews } = await import('@tauri-apps/api/webview');
    const view = (await getAllWebviews()).find((v) => v.label === PREFIX + label);
    if (!view) return null;
    const [position, size] = await Promise.all([view.position(), view.size()]);
    return { x: position.x, y: position.y, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

export const nativeWeb = {
  open(label: string, url: string, bounds: NativeBounds) {
    return invoke('hud_web_open', { label, url, ...round(bounds) });
  },
  /** Where the view goes and whether it shows, in one call: the views move every frame of a drag. */
  place(label: string, bounds: NativeBounds, visible = true) {
    return invoke('hud_web_bounds', { label, ...round(bounds), visible });
  },
  navigate(label: string, url: string) {
    return invoke('hud_web_navigate', { label, url });
  },
  history(label: string, step: 'back' | 'forward' | 'reload') {
    return invoke('hud_web_history', { label, step });
  },
  zoom(label: string, factor: number) {
    return invoke('hud_web_zoom', { label, factor });
  },
  close(label: string) {
    return invoke('hud_web_close', { label });
  },
};

/**
 * Close the HUD's web views no window owns. They outlive the page that opened them,
 * so a reload (or a window closed while its view was still opening) leaves one lying
 * over the app until this runs.
 */
export async function closeOrphans(keep: string[] = []): Promise<number> {
  if (!isTauri()) return 0;
  let closed = 0;
  try {
    const { getAllWebviews } = await import('@tauri-apps/api/webview');
    for (const view of await getAllWebviews()) {
      const label = view.label.startsWith(PREFIX) ? view.label.slice(PREFIX.length) : '';
      if (label && !keep.includes(label)) {
        await nativeWeb.close(label);
        closed += 1;
      }
    }
  } catch (e) {
    console.warn('[HUD] could not close leftover web views', e);
  }
  return closed;
}

/** Page loads in the HUD's web views, to keep each address bar honest. */
export async function onNativeWebEvent(
  handler: (event: NativeWebEvent) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen<NativeWebEvent>('hud-web', (event) => handler(event.payload));
}
