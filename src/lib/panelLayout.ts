/**
 * Shared layout state for floating panels.
 *
 * Extracted from the browser panel so the search panel — and anything after it
 * — gets the same behaviour rather than a second, subtly different copy. Three
 * things in here are not obvious, and all three were bugs before they were
 * rules:
 *
 * 1. **Clamp on every mutation, not just on load.** A panel dragged past the
 *    edge, or restored from a session on a larger monitor, has no header left
 *    to grab and no close button to click. The user cannot recover it without
 *    clearing site data, so "stays reachable" is an invariant of the state, not
 *    a check at one entry point.
 *
 * 2. **"What fullscreen was entered from" belongs to the state, not the
 *    component.** These panels are expanded and collapsed by voice as well, and
 *    the agent has no way to know what the layout was beforehand. With the
 *    memory held in a component, every agent-initiated "expand to read this,
 *    then put it back" quietly docked a panel the user had floating.
 *
 * 3. **Gesture state lives here too.** A panel containing an iframe has to lay
 *    a transparent shield over it while dragging, or the pointer events go to
 *    the iframe's document and the drag dies halfway. `isManipulating` is what
 *    the shield binds to.
 *
 * Each panel names its own layouts: the browser panel docks into a split pane,
 * the search panel orbits the avatar. Only "which layout means fullscreen" and
 * "which layouts are free-floating" have to be declared.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';

/** The layouts the browser panel uses; other panels declare their own. */
export type PanelLayout = 'docked' | 'floating' | 'fullscreen';

export const PANEL_LAYOUTS: readonly PanelLayout[] = ['docked', 'floating', 'fullscreen'] as const;

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Small enough to be useful on a laptop, large enough that content still reflows. */
export const MIN_PANEL_WIDTH = 360;
export const MIN_PANEL_HEIGHT = 260;

export const DEFAULT_PANEL_RECT: PanelRect = { x: 120, y: 96, width: 720, height: 520 };

export interface PanelSizeLimits {
  minWidth?: number;
  minHeight?: number;
}

export function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Keep a floating panel reachable.
 *
 * Size is clamped to the viewport first, then position — in that order,
 * because clamping a position against an oversized width pushes the panel off
 * the left edge instead of keeping it on screen.
 */
export function clampRect(rect: PanelRect, limits: PanelSizeLimits = {}): PanelRect {
  const minWidth = limits.minWidth ?? MIN_PANEL_WIDTH;
  const minHeight = limits.minHeight ?? MIN_PANEL_HEIGHT;
  const { width: vw, height: vh } = viewportSize();
  const width = clamp(Math.round(rect.width), minWidth, Math.max(minWidth, vw));
  const height = clamp(Math.round(rect.height), minHeight, Math.max(minHeight, vh));
  return {
    width,
    height,
    x: clamp(Math.round(rect.x), 0, Math.max(0, vw - width)),
    y: clamp(Math.round(rect.y), 0, Math.max(0, vh - height)),
  };
}

export interface CreatePanelLayoutOptions<L extends string> {
  /** localStorage key; per panel, so two panels remember their own positions. */
  storageKey: string;
  /** Every layout this panel can be in. Anything else is rejected. */
  layouts?: readonly L[];
  /** Where it starts, and where `reset()` returns to. */
  defaultLayout?: L;
  /** Which layout means "covering everything". */
  fullscreenLayout?: L;
  /** Layouts whose geometry is user-controlled, and so must be clamped. */
  floatingLayouts?: readonly L[];
  defaultRect?: PanelRect;
  minWidth?: number;
  minHeight?: number;
}

export interface PanelLayoutState<L extends string = PanelLayout> {
  layout: Ref<L>;
  /** Where `collapseFullscreen` returns to. Captured on the way in. */
  layoutBeforeFullscreen: Ref<L>;
  rect: Ref<PanelRect>;
  /** True while a drag or resize is in flight; bind the iframe shield to this. */
  isManipulating: Ref<boolean>;
  isDocked: ComputedRef<boolean>;
  isFloating: ComputedRef<boolean>;
  isFullscreen: ComputedRef<boolean>;
  /** Type guard for this panel's own layout union. */
  isLayout: (value: unknown) => value is L;
  setLayout: (next: L) => void;
  expandFullscreen: () => void;
  collapseFullscreen: () => void;
  toggleFullscreen: () => void;
  moveTo: (x: number, y: number) => void;
  resizeTo: (width: number, height: number) => void;
  setRect: (rect: Partial<PanelRect>) => void;
  syncToViewport: () => void;
  center: () => void;
  reset: () => void;
  setManipulating: (value: boolean) => void;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function createPanelLayout<L extends string = PanelLayout>(
  options: CreatePanelLayoutOptions<L>,
): PanelLayoutState<L> {
  const layouts = (options.layouts ?? (PANEL_LAYOUTS as readonly string[] as readonly L[]));
  // `layouts` is never empty in practice; the cast is what lets `L` stay a
  // closed union at the call site instead of widening to `L | undefined`.
  const defaultLayout = (options.defaultLayout ?? layouts[0]) as L;
  const fullscreenLayout =
    options.fullscreenLayout ?? (layouts.find((item) => item === 'fullscreen') as L | undefined);
  const floatingLayouts =
    options.floatingLayouts ?? (layouts.filter((item) => item === 'floating') as readonly L[]);
  const defaultRect = options.defaultRect ?? DEFAULT_PANEL_RECT;
  const limits: PanelSizeLimits = { minWidth: options.minWidth, minHeight: options.minHeight };

  const isLayout = (value: unknown): value is L =>
    typeof value === 'string' && (layouts as readonly string[]).includes(value);

  // The viewport is deliberately not consulted here: on mobile it is still
  // settling as browser chrome appears, so an early clamp would shrink the
  // panel to a size the user never chose. `syncToViewport` handles it on mount.
  function loadPersisted(): { layout: L; rect: PanelRect; previous: L } {
    const fallback = { layout: defaultLayout, rect: { ...defaultRect }, previous: defaultLayout };
    if (typeof localStorage === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(options.storageKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as {
        layout?: unknown;
        rect?: Partial<PanelRect>;
        previous?: unknown;
      };
      const saved = { ...defaultRect, ...(parsed.rect ?? {}) };
      return {
        layout: isLayout(parsed.layout) ? parsed.layout : defaultLayout,
        previous: isLayout(parsed.previous) ? parsed.previous : defaultLayout,
        rect: {
          x: readNumber(saved.x, defaultRect.x),
          y: readNumber(saved.y, defaultRect.y),
          width: readNumber(saved.width, defaultRect.width),
          height: readNumber(saved.height, defaultRect.height),
        },
      };
    } catch {
      return fallback;
    }
  }

  const persisted = loadPersisted();
  const layout = ref(persisted.layout) as Ref<L>;
  const rect = ref<PanelRect>(persisted.rect);
  const layoutBeforeFullscreen = ref(
    persisted.previous === fullscreenLayout ? defaultLayout : persisted.previous,
  ) as Ref<L>;
  const isManipulating = ref(false);

  function persist() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        options.storageKey,
        JSON.stringify({
          layout: layout.value,
          rect: rect.value,
          previous: layoutBeforeFullscreen.value,
        }),
      );
    } catch {
      // Private mode, or storage disabled. The panel still works for this
      // session; it just will not remember where it was.
    }
  }

  function setLayout(next: L) {
    if (!isLayout(next) || layout.value === next) return;
    // Captured on the way in: it is the only moment the answer is knowable.
    if (next === fullscreenLayout) layoutBeforeFullscreen.value = layout.value;
    layout.value = next;
    if (floatingLayouts.includes(next)) rect.value = clampRect(rect.value, limits);
    persist();
  }

  function expandFullscreen() {
    if (fullscreenLayout) setLayout(fullscreenLayout);
  }

  function collapseFullscreen() {
    if (!fullscreenLayout || layout.value !== fullscreenLayout) return;
    setLayout(
      layoutBeforeFullscreen.value === fullscreenLayout ? defaultLayout : layoutBeforeFullscreen.value,
    );
  }

  function toggleFullscreen() {
    if (fullscreenLayout && layout.value === fullscreenLayout) collapseFullscreen();
    else expandFullscreen();
  }

  function setRect(next: Partial<PanelRect>) {
    rect.value = clampRect({ ...rect.value, ...next }, limits);
    persist();
  }

  function moveTo(x: number, y: number) {
    setRect({ x, y });
  }

  function resizeTo(width: number, height: number) {
    setRect({ width, height });
  }

  /** Re-clamp after a window resize, so a panel cannot go unreachable. */
  function syncToViewport() {
    const clamped = clampRect(rect.value, limits);
    const current = rect.value;
    if (
      clamped.x !== current.x ||
      clamped.y !== current.y ||
      clamped.width !== current.width ||
      clamped.height !== current.height
    ) {
      rect.value = clamped;
      persist();
    }
  }

  /** Centre the panel — the recovery path when it ends up somewhere odd. */
  function center() {
    const { width: vw, height: vh } = viewportSize();
    const { width, height } = rect.value;
    setRect({ x: Math.round((vw - width) / 2), y: Math.round((vh - height) / 2) });
  }

  function reset() {
    layout.value = defaultLayout;
    layoutBeforeFullscreen.value = defaultLayout;
    rect.value = clampRect({ ...defaultRect }, limits);
    persist();
  }

  function setManipulating(value: boolean) {
    isManipulating.value = value;
  }

  return {
    layout,
    layoutBeforeFullscreen,
    rect,
    isManipulating,
    isDocked: computed(() => (layout.value as string) === 'docked'),
    isFloating: computed(() => floatingLayouts.includes(layout.value)),
    isFullscreen: computed(() => layout.value === fullscreenLayout),
    isLayout,
    setLayout,
    expandFullscreen,
    collapseFullscreen,
    toggleFullscreen,
    moveTo,
    resizeTo,
    setRect,
    syncToViewport,
    center,
    reset,
    setManipulating,
  };
}
