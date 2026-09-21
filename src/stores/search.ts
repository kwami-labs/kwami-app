import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  createPanelLayout,
  PANEL_LAYOUTS,
  type PanelLayout,
  type PanelRect,
} from '@/lib/panelLayout';

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  /** Image URL (e.g. og:image from result page) */
  image?: string;
  /** Extracted features (e.g. "2 bedrooms", "€2000/mo") */
  features?: string[];
  /** Product/item name (cleaned title for product cards) */
  product_name?: string;
  /** Extracted price for product cards (e.g. "€199", "$49.99") */
  price?: string | null;
}

/**
 * How search results are presented.
 *
 * Deliberately the browser panel's vocabulary rather than a second one:
 *
 * - `docked`     — the cards that arc around the avatar. The original
 *                  behaviour and still the default, because it keeps the
 *                  avatar the centre of the screen. It is "docked" rather
 *                  than "orbit" so that one sentence in the agent's
 *                  capability manifest can describe both panels; the tool
 *                  still accepts "orbit" as a spoken alias.
 * - `floating`   — a draggable, resizable window listing every result, for
 *                  reading rather than glancing.
 * - `fullscreen` — expanded over the viewport when there is a lot to read.
 */
export type SearchPanelLayout = PanelLayout;

export const SEARCH_PANEL_LAYOUTS = PANEL_LAYOUTS;

/** Narrow enough to park beside the avatar, wide enough not to wrap a title. */
export const MIN_SEARCH_PANEL_WIDTH = 320;
export const MIN_SEARCH_PANEL_HEIGHT = 240;

const DEFAULT_SEARCH_RECT: PanelRect = { x: 160, y: 120, width: 560, height: 560 };

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResultItem[]>([]);
  const resultsBatchId = ref(0); // Bump when results change so card entrance re-runs
  const answer = ref<string | null>(null);
  const error = ref<string | null>(null);
  /**
   * True between asking for a search and the results arriving.
   *
   * Search runs agent-side and comes back over the LiveKit data channel, so
   * there is no promise to await -- without this the panel looks empty and
   * broken for the second or two a search takes, and the user asks again.
   */
  const isSearching = ref(false);
  /**
   * Which result the user (or the agent, by voice) is pointing at.
   *
   * -1 means nothing is focused. Kept in the store rather than the component
   * because both the panel and the orbit cards show the focus ring, and the
   * agent's `focus_search_result` has to drive the same state the mouse does.
   */
  const focusedIndex = ref(-1);

  // No custom `layouts` on purpose: the search panel reuses the browser
  // panel's docked/floating/fullscreen union so the agent can be told about
  // both panels in one sentence. Only the minimums differ -- a list of search
  // results stays readable much narrower than a rendered web page does.
  const panel = createPanelLayout({
    storageKey: 'kwami-search-panel-layout',
    defaultRect: DEFAULT_SEARCH_RECT,
    minWidth: MIN_SEARCH_PANEL_WIDTH,
    minHeight: MIN_SEARCH_PANEL_HEIGHT,
  });

  const hasSearchData = computed(
    () =>
      (query.value?.trim?.()?.length ?? 0) > 0 ||
      results.value.length > 0 ||
      (answer.value?.length ?? 0) > 0,
  );

  /** True when the windowed panel should render instead of the orbit cards. */
  const isWindowed = computed(() => panel.layout.value !== 'docked');

  const focusedResult = computed<SearchResultItem | null>(() =>
    focusedIndex.value >= 0 && focusedIndex.value < results.value.length
      ? (results.value[focusedIndex.value] ?? null)
      : null,
  );

  function setResults(data: {
    query: string;
    results: SearchResultItem[];
    answer?: string | null;
  }) {
    query.value = data.query ?? '';
    results.value = Array.isArray(data.results) ? data.results : [];
    resultsBatchId.value += 1;
    answer.value = data.answer ?? null;
    error.value = null;
    isSearching.value = false;
    // A focus index from the previous search points at a different result now,
    // so carrying it over would highlight something the user never chose.
    focusedIndex.value = -1;
  }

  function setSearching(value: boolean, nextQuery?: string) {
    isSearching.value = value;
    if (value) {
      error.value = null;
      if (typeof nextQuery === 'string') query.value = nextQuery;
    }
  }

  function setError(msg: string) {
    error.value = msg;
    isSearching.value = false;
  }

  function focusResult(index: number): boolean {
    const i = Math.floor(index);
    if (!Number.isFinite(i) || i < 0 || i >= results.value.length) return false;
    focusedIndex.value = i;
    return true;
  }

  function clearFocus() {
    focusedIndex.value = -1;
  }

  function removeResultAt(index: number) {
    const i = Math.max(0, Math.floor(index));
    if (i < results.value.length) {
      results.value = results.value.filter((_, j) => j !== i);
      // Removing a card shifts everything after it up by one, so a stored
      // index would silently come to mean a different result.
      if (focusedIndex.value === i) focusedIndex.value = -1;
      else if (focusedIndex.value > i) focusedIndex.value -= 1;
    }
  }

  function clear() {
    query.value = '';
    results.value = [];
    answer.value = null;
    error.value = null;
    isSearching.value = false;
    focusedIndex.value = -1;
    // Layout is deliberately kept: where the user put the panel is a
    // preference about the panel, not state belonging to one search.
  }

  return {
    query,
    results,
    resultsBatchId,
    answer,
    error,
    isSearching,
    focusedIndex,
    focusedResult,
    hasSearchData,
    isWindowed,
    setResults,
    setSearching,
    setError,
    focusResult,
    clearFocus,
    removeResultAt,
    clear,

    // Panel layout (shared core in lib/panelLayout.ts)
    layout: panel.layout,
    rect: panel.rect,
    isManipulating: panel.isManipulating,
    layoutBeforeFullscreen: panel.layoutBeforeFullscreen,
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
