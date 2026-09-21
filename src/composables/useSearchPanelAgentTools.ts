import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useSearchStore, SEARCH_PANEL_LAYOUTS, type SearchPanelLayout } from '@/stores/search';
import { useAgentActionState } from '@/composables/useAgentActionState';

/**
 * Client tools for the windowed search panel.
 *
 * Kept out of `useWorkspaceAgentTools.ts` because that file is already 2,400
 * lines and is being edited concurrently; this registers onto the same `Kwami`
 * instance and behaves identically from the model's side.
 *
 * The control vocabulary is deliberately the same as `set_browser_panel`'s
 * (layout, expand, position, size, center, reset). Two panels that do the same
 * thing under different names is a tax the model pays on every call, and it
 * lets the agent describe both with one capability block.
 */

const SEARCH_PANEL_CONTROLS = ['layout', 'expand', 'position', 'size', 'center', 'reset'] as const;

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The model counts results the way the user does, from 1. The store indexes
 * from 0. Converting at the boundary rather than inside each handler keeps the
 * off-by-one in exactly one place.
 */
function toIndex(position: unknown): number | null {
  if (typeof position !== 'number' || !Number.isFinite(position)) return null;
  return Math.floor(position) - 1;
}

export function useSearchPanelAgentTools() {
  const { t } = useI18n();
  const searchStore = useSearchStore();
  const actionState = useAgentActionState();

  function setSearchPanelControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('searchPanel.controlString') };
    }

    const normalized = normalizeKey(control);

    function result(message: string) {
      actionState.recordAction(t('searchPanel.actionSearchPanel'), String(control), {
        announce: true,
      });
      return {
        success: true,
        layout: searchStore.layout,
        rect: { ...searchStore.rect },
        resultCount: searchStore.results.length,
        message,
      };
    }

    switch (normalized) {
      case 'layout':
      case 'mode': {
        const requested = typeof value === 'string' ? normalizeKey(value) : '';
        const match = SEARCH_PANEL_LAYOUTS.find((item) => normalizeKey(item) === requested);
        if (!match) return { success: false, message: t('searchPanel.layoutInvalid') };
        if (searchStore.layout === match) {
          return { ...result(t('searchPanel.layoutAlready', { layout: match })) };
        }
        searchStore.setLayout(match as SearchPanelLayout);
        return result(t('searchPanel.layoutSet', { layout: match }));
      }

      case 'expand':
      case 'fullscreen': {
        if (typeof value !== 'boolean') {
          return { success: false, message: t('searchPanel.layoutInvalid') };
        }
        // Collapsing returns to whatever the panel was before it expanded, so
        // "expand it, read it, put it back" does not drop a floating window
        // back into the orbit layout.
        if (value) searchStore.expandFullscreen();
        else searchStore.collapseFullscreen();
        return result(value ? t('searchPanel.expanded') : t('searchPanel.collapsed'));
      }

      case 'position':
      case 'move': {
        if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
          return { success: false, message: t('searchPanel.positionObject') };
        }
        // Moving implies floating: asking the orbit cards to go to (40, 40)
        // would otherwise report success and visibly do nothing.
        searchStore.setLayout('floating');
        searchStore.moveTo(value.x, value.y);
        return result(t('searchPanel.moved'));
      }

      case 'size':
      case 'resize': {
        if (
          !isRecord(value) ||
          typeof value.width !== 'number' ||
          typeof value.height !== 'number'
        ) {
          return { success: false, message: t('searchPanel.sizeObject') };
        }
        searchStore.setLayout('floating');
        searchStore.resizeTo(value.width, value.height);
        return result(t('searchPanel.resized'));
      }

      case 'center':
      case 'centre':
        searchStore.setLayout('floating');
        searchStore.centerPanel();
        return result(t('searchPanel.centered'));

      case 'reset':
        searchStore.resetLayout();
        return result(t('searchPanel.layoutReset'));

      default:
        return {
          success: false,
          message: t('searchPanel.unknownControl', {
            control,
            list: SEARCH_PANEL_CONTROLS.join(', '),
          }),
        };
    }
  }

  function focusSearchResult(position: unknown) {
    if (!searchStore.results.length) {
      return { success: false, message: t('searchPanel.noResultsToFocus') };
    }
    const index = toIndex(position);
    if (index === null) {
      return { success: false, message: t('searchPanel.focusIndexNumber') };
    }
    if (!searchStore.focusResult(index)) {
      return {
        success: false,
        message: t('searchPanel.focusOutOfRange', {
          position: Math.floor(position as number),
          count: searchStore.results.length,
        }),
      };
    }
    const item = searchStore.results[index];
    const title = item?.product_name || item?.title || item?.url || '';
    actionState.recordAction(t('searchPanel.actionFocusResult'), title, { announce: true });
    return {
      success: true,
      position: index + 1,
      title,
      url: item?.url ?? '',
      message: t('searchPanel.focusedResult', { position: index + 1, title }),
    };
  }

  /**
   * Hand a result to the cloud browser.
   *
   * Sends a request over the data channel rather than navigating here, so the
   * page opens inside the Browserbase session that carries the user's logins.
   * Loading it in a local iframe would open it signed out, and most of what
   * anyone asks to open -- mail, a bank, a dashboard -- is useless signed out.
   */
  function openSearchResult(position: unknown) {
    if (!searchStore.results.length) {
      return { success: false, message: t('searchPanel.noResultsToFocus') };
    }
    const index = toIndex(position);
    if (index === null) {
      return { success: false, message: t('searchPanel.focusIndexNumber') };
    }
    const item = searchStore.results[index];
    if (!item) {
      return {
        success: false,
        message: t('searchPanel.focusOutOfRange', {
          position: Math.floor(position as number),
          count: searchStore.results.length,
        }),
      };
    }
    if (!item.url) {
      return { success: false, message: t('searchPanel.openNoUrl') };
    }

    searchStore.focusResult(index);
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'browser_open_request', url: item.url }),
    );
    window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: payload }));

    const title = item.product_name || item.title || item.url;
    actionState.recordAction(t('searchPanel.actionOpenResult'), title, { announce: true });
    return {
      // The request has left the app; whether the page loads is the browser
      // session's business and arrives later as a browser_session event.
      success: true,
      requested: true,
      position: index + 1,
      title,
      url: item.url,
      message: t('searchPanel.openedResult', { position: index + 1, title }),
    };
  }

  /**
   * Register onto a live `Kwami` instance.
   *
   * Shaped as a standalone function so `useWorkspaceAgentTools.registerTools`
   * can call it with one line, without this file's tools having to live in
   * that file.
   */
  function registerSearchPanelTools(instance: Kwami) {
    instance.registerTool({
      name: 'set_search_panel',
      description: t('searchPanel.toolDescSetSearchPanel'),
      parameters: {
        control: { type: 'string', enum: [...SEARCH_PANEL_CONTROLS] },
        value: {},
      },
      handler: async ({ control, value }) => setSearchPanelControl(control, value),
    });

    instance.registerTool({
      name: 'focus_search_result',
      description: t('searchPanel.toolDescFocusSearchResult'),
      parameters: {
        position: { type: 'number' },
      },
      handler: async ({ position }) => focusSearchResult(position),
    });

    instance.registerTool({
      name: 'open_search_result',
      description: t('searchPanel.toolDescOpenSearchResult'),
      parameters: {
        position: { type: 'number' },
      },
      handler: async ({ position }) => openSearchResult(position),
    });
  }

  return {
    SEARCH_PANEL_CONTROLS,
    setSearchPanelControl,
    focusSearchResult,
    openSearchResult,
    registerSearchPanelTools,
  };
}
