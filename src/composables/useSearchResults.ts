import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSearchStore, type SearchResultItem, type SearchPanelLayout } from '@/stores/search';

let searchResultsListenerAttached = false;

export type { SearchResultItem, SearchPanelLayout };

export interface SearchResultsState {
  query: string;
  results: SearchResultItem[];
  answer: string | null;
  loading: boolean;
  error: string | null;
}

export function useSearchResults() {
  const store = useSearchStore();
  const {
    query,
    results,
    answer,
    error,
    isSearching,
    focusedIndex,
    focusedResult,
    hasSearchData,
    isWindowed,
    layout,
    rect,
    isManipulating,
    isDocked,
    isFloating,
    isFullscreen,
  } = storeToRefs(store);

  if (!searchResultsListenerAttached) {
    searchResultsListenerAttached = true;
    window.addEventListener('kwami:search_results', (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        query?: string;
        results?: SearchResultItem[];
        answer?: string | null;
      };
      store.setResults({
        query: detail?.query ?? '',
        results: Array.isArray(detail?.results) ? detail.results : [],
        answer: detail?.answer ?? null,
      });
    });
    /**
     * The agent fires this the moment it starts a search, well before the
     * results event. Without it the panel shows the previous search's cards
     * while a new one runs, which reads as the search having been ignored.
     */
    window.addEventListener('kwami:search_started', (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string } | undefined;
      store.setSearching(true, detail?.query);
    });
    window.addEventListener('kwami:remove_result', (e: Event) => {
      const detail = (e as CustomEvent).detail as { index?: number };
      if (typeof detail?.index === 'number') store.removeResultAt(detail.index);
    });
  }

  const hasResults = computed(() => results.value.length > 0 || (answer.value?.length ?? 0) > 0);

  return {
    query,
    results,
    answer,
    error,
    isSearching,
    /** Kept for callers written against the old shape. */
    loading: isSearching,
    focusedIndex,
    focusedResult,
    hasResults,
    hasSearchData,

    // Panel layout
    isWindowed,
    layout,
    rect,
    isManipulating,
    isDocked,
    isFloating,
    isFullscreen,

    setResults: store.setResults,
    setLoading: (value: boolean) => store.setSearching(value),
    setError: store.setError,
    focusResult: store.focusResult,
    clearFocus: store.clearFocus,
    removeResultAt: store.removeResultAt,
    clear: store.clear,
    setLayout: store.setLayout,
    expandFullscreen: store.expandFullscreen,
    collapseFullscreen: store.collapseFullscreen,
    toggleFullscreen: store.toggleFullscreen,
    setRect: store.setRect,
    syncToViewport: store.syncToViewport,
    centerPanel: store.centerPanel,
    resetLayout: store.resetLayout,
    setManipulating: store.setManipulating,
  };
}
