import { computed, ref } from 'vue';
import { isTauri } from '@/lib/platform';
import { setNativeScale } from '@/lib/hud/nativeWeb';

/**
 * The size of the whole interface on this desktop: the sidebar, the panels, Jarvis's
 * screen and its windows, all at once.
 *
 * The app was laid out for a 1920×1080 desktop at 100 %. On a larger one (2560×1440,
 * 3440×1440, a 4K at 100 %) everything came out small, and nothing could make it
 * bigger: the desktop app's web view does not take Ctrl and +. So the page is zoomed
 * the way a browser zooms it (WebView2's own zoom, through Tauri), which keeps every
 * layout working: the page simply gets fewer, larger CSS pixels.
 *
 * - **Auto** (the default) follows the monitor the window is on: 100 % up to 1920×1080,
 *   larger above, up to 175 %; moving the window to another monitor resizes it.
 * - **A fixed size**, 80 % to 200 %, from the HUD's settings, Ctrl and + / - / 0, or
 *   by voice. Kept per device: it is about this desktop, not the account.
 *
 * In the browser build the browser's own zoom does this, so nothing is applied there.
 */

export type UiScaleChoice = 'auto' | number;

export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 2;
export const UI_SCALE_STEP = 0.1;
const AUTO_MAX = 1.75;
const KEY = 'kwami-ui-scale';

function clamp(value: number): number {
  return Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value)) * 100) / 100;
}

/** The size a monitor of `width`×`height` logical pixels gets on auto: 1 for 1920×1080. */
export function autoScale(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  const ratio = Math.min(width / 1920, height / 1080);
  return Math.round(Math.min(AUTO_MAX, Math.max(1, ratio)) * 20) / 20;
}

/** A stored or spoken choice, checked: "auto", or a factor (a percentage is read as one). */
export function parseScaleChoice(value: unknown): UiScaleChoice | null {
  if (value === 'auto') return 'auto';
  const n = typeof value === 'string' ? Number(value.replace('%', '').trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return clamp(n > 5 ? n / 100 : n);
}

function readChoice(): UiScaleChoice {
  try {
    return parseScaleChoice(localStorage.getItem(KEY)) ?? 'auto';
  } catch {
    return 'auto';
  }
}

// Module scope: one interface, one size.
const choice = ref<UiScaleChoice>(readChoice());
const applied = ref(1);
/** Whether this app can zoom itself: the desktop app built with the permission for it. */
const available = ref(isTauri());
let started = false;

type ZoomTarget = { setZoom(factor: number): Promise<void> };
let target: ZoomTarget | null = null;

async function zoomTarget(): Promise<ZoomTarget | null> {
  if (!isTauri()) return null;
  if (!target) {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    target = getCurrentWebview() as unknown as ZoomTarget;
  }
  return target;
}

/** The monitor's size in logical pixels: the page's CSS pixels times the zoom it has now. */
/** The monitor the window is on, in logical pixels (its own scale, 125 % say, taken out). */
const monitor = ref<{ width: number; height: number } | null>(null);

function monitorSize(): { width: number; height: number } {
  // screen.* is the monitor in logical pixels too, and the page's zoom does not change it:
  // the fallback when the app cannot say which monitor it is on.
  return monitor.value ?? { width: window.screen.width, height: window.screen.height };
}

function wanted(): number {
  if (choice.value !== 'auto') return clamp(choice.value);
  const { width, height } = monitorSize();
  return autoScale(width, height);
}

let applying: Promise<void> | null = null;
async function apply(): Promise<void> {
  if (!available.value) return;
  // The zoom the view really has, not what this module last set: a reload (or a hot
  // update) starts the module again while the view keeps its zoom.
  await detectApplied();
  const factor = wanted();
  if (Math.abs(factor - applied.value) < 0.001) return;
  const view = await zoomTarget();
  if (!view) return;
  try {
    await view.setZoom(factor);
    applied.value = factor;
    setNativeScale(factor);
  } catch (e) {
    // An app built before the permission: it stays at 100 % and says so.
    available.value = false;
    console.warn('[UI] the interface cannot be resized in this build', e);
  }
}

/**
 * The zoom the page already has: a reload keeps the web view's zoom while this module
 * starts again at 1, and the monitor's size would then be read too small. The window's
 * own scale (Windows' 125 %, say) is taken out of the device pixel ratio.
 */
async function detectApplied(): Promise<void> {
  try {
    const { currentMonitor, getCurrentWindow } = await import('@tauri-apps/api/window');
    const [scale, screenNow] = await Promise.all([
      getCurrentWindow().scaleFactor(),
      currentMonitor().catch(() => null),
    ]);
    const zoom = (window.devicePixelRatio || 1) / (scale || 1);
    if (Number.isFinite(zoom) && zoom > 0) {
      applied.value = Math.round(zoom * 100) / 100;
      setNativeScale(applied.value);
    }
    if (screenNow?.size && screenNow.scaleFactor > 0) {
      monitor.value = {
        width: screenNow.size.width / screenNow.scaleFactor,
        height: screenNow.size.height / screenNow.scaleFactor,
      };
    }
  } catch {
    // Unknown: assume none, and the screen as the page sees it.
  }
}

function queueApply(): void {
  applying = (applying ?? Promise.resolve()).then(apply, apply);
}

function save(): void {
  try {
    localStorage.setItem(KEY, String(choice.value));
  } catch {
    // Private mode: the size lasts the session.
  }
}

/** Ctrl and + / - / 0, as in a browser. */
function onKey(e: KeyboardEvent): void {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (e.key === '+' || e.key === '=') step(1);
  else if (e.key === '-' || e.key === '_') step(-1);
  else if (e.key === '0') setChoice('auto');
  else return;
  e.preventDefault();
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
function onResize(): void {
  if (choice.value !== 'auto') return;
  // Moved to another monitor, or the monitor changed: auto follows, once it settles.
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(queueApply, 250);
}

function setChoice(next: UiScaleChoice): void {
  choice.value = next === 'auto' ? 'auto' : clamp(next);
  save();
  queueApply();
}

function step(direction: 1 | -1): void {
  // From the size the view really has, once whatever is under way has finished.
  applying = (applying ?? Promise.resolve()).then(async () => {
    await detectApplied();
    choice.value = clamp(applied.value + direction * UI_SCALE_STEP);
    save();
    await apply();
  });
}

export function useUiScale() {
  /** Once, from the app's root: applies the saved size and listens for keys and monitors. */
  function start(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    if (!isTauri()) {
      available.value = false;
      return;
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    queueApply();
  }

  return {
    choice,
    applied,
    available,
    percent: computed(() => Math.round(applied.value * 100)),
    setChoice,
    step,
    start,
    /** What auto would pick here and now, for the settings to show. */
    autoValue: computed(() => {
      const { width, height } = monitorSize();
      return autoScale(width, height);
    }),
  };
}
