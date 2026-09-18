import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * How the live browser panel is laid out.
 *
 * - `docked`     — a split pane beside the avatar, resized with the splitter in
 *                  App.vue. The original behaviour, and still the default.
 * - `floating`   — a window the user can drag anywhere and resize from its
 *                  corner, so the avatar stays fully visible behind it.
 * - `fullscreen` — expanded over the whole viewport for reading or watching.
 */
export type BrowserPanelLayout = 'docked' | 'floating' | 'fullscreen';

export const BROWSER_PANEL_LAYOUTS: readonly BrowserPanelLayout[] = [
  'docked',
  'floating',
  'fullscreen',
] as const;

export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY = 'kwami-browser-panel-layout';

/** Small enough to be useful on a laptop, large enough that a page still reflows. */
export const MIN_PANEL_WIDTH = 360;
export const MIN_PANEL_HEIGHT = 260;

const DEFAULT_RECT: FloatingRect = { x: 120, y: 96, width: 720, height: 520 };

function viewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Keep a floating panel reachable.
 *
 * A window dragged off-screen, or restored from a session on a much larger
 * monitor, has no header left to grab and no close button to click — the panel
 * is then unrecoverable without clearing storage. Sizes are clamped to the
 * viewport first, then the position is clamped so the whole panel stays inside
 * it.
 */
export function clampRect(rect: FloatingRect): FloatingRect {
  const { width: vw, height: vh } = viewport();
  const width = clamp(Math.round(rect.width), MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, vw));
  const height = clamp(Math.round(rect.height), MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, vh));
  return {
    width,
    height,
    x: clamp(Math.round(rect.x), 0, Math.max(0, vw - width)),
    y: clamp(Math.round(rect.y), 0, Math.max(0, vh - height)),
  };
}

function isLayout(value: unknown): value is BrowserPanelLayout {
  return typeof value === 'string' && (BROWSER_PANEL_LAYOUTS as readonly string[]).includes(value);
}

function loadPersisted(): { layout: BrowserPanelLayout; rect: FloatingRect } {
  const fallback = { layout: 'docked' as BrowserPanelLayout, rect: { ...DEFAULT_RECT } };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { layout?: unknown; rect?: Partial<FloatingRect> };
    const rect = { ...DEFAULT_RECT, ...(parsed.rect ?? {}) };
    return {
      layout: isLayout(parsed.layout) ? parsed.layout : 'docked',
      // Not clamped here: the viewport is not necessarily final at module load
      // (mobile browsers resize as chrome settles). `syncToViewport` does it.
      rect: {
        x: Number.isFinite(rect.x) ? rect.x : DEFAULT_RECT.x,
        y: Number.isFinite(rect.y) ? rect.y : DEFAULT_RECT.y,
        width: Number.isFinite(rect.width) ? rect.width : DEFAULT_RECT.width,
        height: Number.isFinite(rect.height) ? rect.height : DEFAULT_RECT.height,
      },
    };
  } catch {
    return fallback;
  }
}

export const useNavigationStore = defineStore('navigation', () => {
  const isActive = ref(false);
  const currentUrl = ref('');
  const currentTitle = ref('');
  const isLoading = ref(false);
  const liveUrl = ref('');
  /** Which cloud-browser vendor is running this session ('browserbase' | 'browser_use'). */
  const vendor = ref('');
  /**
   * Whether this browser carries the user's saved logins. False means the
   * session is ephemeral, which the panel says out loud rather than letting
   * the user discover it by being signed out of everything.
   */
  const isPersistent = ref(true);

  const persisted = loadPersisted();
  const layout = ref<BrowserPanelLayout>(persisted.layout);
  const floatingRect = ref<FloatingRect>(persisted.rect);
  /** True while a drag or resize is in flight; the panel shields the iframe. */
  const isManipulating = ref(false);

  const hasNavigation = computed(() => isActive.value);
  const isFloating = computed(() => layout.value === 'floating');
  const isFullscreen = computed(() => layout.value === 'fullscreen');
  /** Only the docked layout takes part in App.vue's split; the others overlay. */
  const isDocked = computed(() => layout.value === 'docked');

  function persist() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ layout: layout.value, rect: floatingRect.value }),
      );
    } catch {
      // Private mode, or storage disabled. The panel still works for this
      // session; it just will not remember where it was.
    }
  }

  function updateState(state: {
    url?: string;
    title?: string;
    isLoading?: boolean;
    liveUrl?: string;
    vendor?: string;
    persistent?: boolean;
  }) {
    if (state.url !== undefined) {
      currentUrl.value = state.url;
      if (state.url) isActive.value = true;
    }
    if (state.title !== undefined) currentTitle.value = state.title;
    if (state.isLoading !== undefined) isLoading.value = state.isLoading;
    if (state.liveUrl !== undefined) liveUrl.value = state.liveUrl;
    if (state.vendor !== undefined) vendor.value = state.vendor;
    if (state.persistent !== undefined) isPersistent.value = state.persistent;
  }

  function setLayout(next: BrowserPanelLayout) {
    if (!isLayout(next) || layout.value === next) return;
    layout.value = next;
    if (next === 'floating') floatingRect.value = clampRect(floatingRect.value);
    persist();
  }

  /** Fullscreen from anywhere; from fullscreen, back to where it came from. */
  function toggleFullscreen(previous: BrowserPanelLayout = 'docked') {
    setLayout(layout.value === 'fullscreen' ? previous : 'fullscreen');
  }

  function moveTo(x: number, y: number) {
    floatingRect.value = clampRect({ ...floatingRect.value, x, y });
    persist();
  }

  function resizeTo(width: number, height: number) {
    floatingRect.value = clampRect({ ...floatingRect.value, width, height });
    persist();
  }

  function setRect(rect: Partial<FloatingRect>) {
    floatingRect.value = clampRect({ ...floatingRect.value, ...rect });
    persist();
  }

  /** Re-clamp after a window resize so a floating panel cannot go unreachable. */
  function syncToViewport() {
    const clamped = clampRect(floatingRect.value);
    const current = floatingRect.value;
    if (
      clamped.x !== current.x ||
      clamped.y !== current.y ||
      clamped.width !== current.width ||
      clamped.height !== current.height
    ) {
      floatingRect.value = clamped;
      persist();
    }
  }

  /** Centre the floating panel — the recovery path when it ends up somewhere odd. */
  function centerPanel() {
    const { width: vw, height: vh } = viewport();
    const { width, height } = floatingRect.value;
    setRect({ x: Math.round((vw - width) / 2), y: Math.round((vh - height) / 2) });
  }

  function resetLayout() {
    layout.value = 'docked';
    floatingRect.value = clampRect({ ...DEFAULT_RECT });
    persist();
  }

  function setManipulating(value: boolean) {
    isManipulating.value = value;
  }

  function end() {
    isActive.value = false;
    currentUrl.value = '';
    currentTitle.value = '';
    isLoading.value = false;
    liveUrl.value = '';
    vendor.value = '';
    isPersistent.value = true;
    isManipulating.value = false;
    // Layout is deliberately kept: it is a user preference about the panel,
    // not state belonging to one browsing session.
  }

  return {
    isActive,
    currentUrl,
    currentTitle,
    isLoading,
    liveUrl,
    vendor,
    isPersistent,
    layout,
    floatingRect,
    isManipulating,
    hasNavigation,
    isFloating,
    isFullscreen,
    isDocked,
    updateState,
    setLayout,
    toggleFullscreen,
    moveTo,
    resizeTo,
    setRect,
    syncToViewport,
    centerPanel,
    resetLayout,
    setManipulating,
    end,
  };
});
