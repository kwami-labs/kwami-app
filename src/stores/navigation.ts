import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  createPanelLayout,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  PANEL_LAYOUTS,
  type PanelLayout,
  type PanelRect,
} from '@/lib/panelLayout';

/**
 * How the live browser panel is laid out.
 *
 * - `docked`     — a split pane beside the avatar, resized with the splitter in
 *                  App.vue. The original behaviour, and still the default.
 * - `floating`   — a window the user can drag anywhere and resize from its
 *                  corner, so the avatar stays fully visible behind it.
 * - `fullscreen` — expanded over the whole viewport for reading or watching.
 *
 * The mechanics (clamping, persistence, the fullscreen return memory, gesture
 * state) live in `lib/panelLayout.ts`, shared with the search panel.
 */
export type BrowserPanelLayout = PanelLayout;

/**
 * Re-exported rather than re-listed.
 *
 * A second copy of the same three strings is the shape of bug that has bitten
 * this repo twice today: two definitions written "the same way" that quietly
 * stop agreeing, with both sides still passing their own tests.
 */
export const BROWSER_PANEL_LAYOUTS: readonly BrowserPanelLayout[] = PANEL_LAYOUTS;

export type FloatingRect = PanelRect;

export { MIN_PANEL_HEIGHT, MIN_PANEL_WIDTH, clampRect } from '@/lib/panelLayout';

const STORAGE_KEY = 'kwami-browser-panel-layout';

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

  const panel = createPanelLayout<BrowserPanelLayout>({
    storageKey: STORAGE_KEY,
    layouts: BROWSER_PANEL_LAYOUTS,
    defaultLayout: 'docked',
    fullscreenLayout: 'fullscreen',
    floatingLayouts: ['floating'],
    minWidth: MIN_PANEL_WIDTH,
    minHeight: MIN_PANEL_HEIGHT,
  });

  const hasNavigation = computed(() => isActive.value);

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

  function end() {
    isActive.value = false;
    currentUrl.value = '';
    currentTitle.value = '';
    isLoading.value = false;
    liveUrl.value = '';
    vendor.value = '';
    isPersistent.value = true;
    panel.setManipulating(false);
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
    hasNavigation,
    updateState,
    end,

    // Panel layout (shared core in lib/panelLayout.ts)
    layout: panel.layout,
    layoutBeforeFullscreen: panel.layoutBeforeFullscreen,
    floatingRect: panel.rect,
    isManipulating: panel.isManipulating,
    isDocked: panel.isDocked,
    isFloating: panel.isFloating,
    isFullscreen: panel.isFullscreen,
    setLayout: panel.setLayout,
    expandFullscreen: panel.expandFullscreen,
    collapseFullscreen: panel.collapseFullscreen,
    toggleFullscreen: panel.toggleFullscreen,
    moveTo: panel.moveTo,
    resizeTo: panel.resizeTo,
    setRect: panel.setRect,
    syncToViewport: panel.syncToViewport,
    centerPanel: panel.center,
    resetLayout: panel.reset,
    setManipulating: panel.setManipulating,
  };
});
