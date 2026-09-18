/**
 * The windowed search panel and the tools that drive it by voice.
 *
 * Three things here are worth testing rather than trusting:
 *
 * 1. **A result index is a moving target.** The model says "open the second
 *    one" against the list it was told about, but results get dismissed and a
 *    new search replaces them. A stale index silently points at a different
 *    page, which is the failure the user cannot see coming.
 * 2. **A panel that cannot be reached cannot be closed.** The layout state
 *    rides on the shared clamp in lib/panelLayout.ts; these assert the search
 *    panel actually gets that behaviour rather than just importing it.
 * 3. **Tool descriptions are prompt text.** vue-i18n compiles messages lazily,
 *    so a brace in a description is silent until the moment the model needs
 *    it. Every message in this bundle is rendered here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useSearchStore } from '@/stores/search';
import { useSearchPanelAgentTools } from '@/composables/useSearchPanelAgentTools';
import { searchPanelEn, searchPanelEs } from '@/i18n/searchPanel.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

const registered = new Map<string, ToolDef>();

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async () => true),
  }),
}));

const Host = defineComponent({
  setup() {
    const { registerSearchPanelTools } = useSearchPanelAgentTools();
    registerSearchPanelTools({
      registerTool: (def: ToolDef) => registered.set(def.name, def),
    } as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args) as Promise<Record<string, unknown>>;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true });
}

function seedResults(count = 3) {
  const store = useSearchStore();
  store.setResults({
    query: 'best espresso machine',
    results: Array.from({ length: count }, (_, i) => ({
      title: `Result ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      content: `Snippet ${i + 1}`,
    })),
  });
  return store;
}

beforeEach(() => {
  registered.clear();
  localStorage.clear();
  setViewport(1280, 800);
  setActivePinia(createPinia());
  mount(Host);
});

describe('registration', () => {
  it('registers the three search panel tools', () => {
    for (const name of ['set_search_panel', 'focus_search_result', 'open_search_result']) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^searchPanel\./);
    }
  });

  it('uses the same control vocabulary as the browser panel', () => {
    // Two panels with identical behaviour and different words for it is a
    // cost the model pays on every call, and it forces the agent to carry two
    // capability blocks where one would do.
    const controls = registered.get('set_search_panel')?.parameters?.control as { enum: string[] };
    expect(controls.enum).toEqual(['layout', 'expand', 'position', 'size', 'center', 'reset']);
  });
});

describe('set_search_panel', () => {
  it('switches results into a floating window', async () => {
    const store = useSearchStore();
    const result = await call('set_search_panel', { control: 'layout', value: 'floating' });
    expect(result.success).toBe(true);
    expect(store.layout).toBe('floating');
    expect(store.isWindowed).toBe(true);
  });

  it('reports a no-op rather than claiming it changed something', async () => {
    const result = await call('set_search_panel', { control: 'layout', value: 'docked' });
    expect(result.success).toBe(true);
    expect(String(result.message)).toMatch(/already/i);
  });

  it('rejects a layout it does not have', async () => {
    const store = useSearchStore();
    const result = await call('set_search_panel', { control: 'layout', value: 'sideways' });
    expect(result.success).toBe(false);
    expect(store.layout).toBe('docked');
  });

  it('returns to the previous layout when collapsed, not to the default', async () => {
    const store = useSearchStore();
    await call('set_search_panel', { control: 'layout', value: 'floating' });
    await call('set_search_panel', { control: 'expand', value: true });
    expect(store.layout).toBe('fullscreen');

    await call('set_search_panel', { control: 'expand', value: false });
    // The whole point: "expand it, read it, put it back" must not quietly
    // dock a window the user had floating.
    expect(store.layout).toBe('floating');
  });

  it('implies floating when asked to move, so the move is visible', async () => {
    const store = useSearchStore();
    const result = await call('set_search_panel', {
      control: 'position',
      value: { x: 40, y: 60 },
    });
    expect(result.success).toBe(true);
    expect(store.layout).toBe('floating');
    expect(store.rect.x).toBe(40);
    expect(store.rect.y).toBe(60);
  });

  it('keeps a panel pushed off-screen reachable', async () => {
    const store = useSearchStore();
    await call('set_search_panel', { control: 'position', value: { x: 99999, y: 99999 } });
    expect(store.rect.x).toBeLessThanOrEqual(1280 - store.rect.width);
    expect(store.rect.y).toBeLessThanOrEqual(800 - store.rect.height);
  });

  it('refuses a position that is not a pair of numbers', async () => {
    const result = await call('set_search_panel', { control: 'position', value: 'over there' });
    expect(result.success).toBe(false);
  });

  it('names the valid controls when given one it does not know', async () => {
    const result = await call('set_search_panel', { control: 'wiggle', value: true });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('layout');
  });
});

describe('focus_search_result', () => {
  it('counts from one, the way the user does', async () => {
    const store = seedResults();
    const result = await call('focus_search_result', { position: 2 });
    expect(result.success).toBe(true);
    expect(store.focusedIndex).toBe(1);
    expect(result.title).toBe('Result 2');
  });

  it('says how many there are when asked for one past the end', async () => {
    seedResults(3);
    const result = await call('focus_search_result', { position: 9 });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('3');
  });

  it('refuses when there is nothing on screen to point at', async () => {
    const result = await call('focus_search_result', { position: 1 });
    expect(result.success).toBe(false);
  });
});

describe('open_search_result', () => {
  it('asks the cloud browser rather than navigating locally', async () => {
    seedResults();
    const sent: string[] = [];
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail as Uint8Array;
      sent.push(new TextDecoder().decode(detail));
    };
    window.addEventListener('kwami:send_data', listener);

    const result = await call('open_search_result', { position: 2 });
    window.removeEventListener('kwami:send_data', listener);

    expect(result.success).toBe(true);
    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0]!) as { type: string; url: string };
    // Opening it in a local iframe would load it signed out, which is useless
    // for the pages anyone actually asks to open.
    expect(payload.type).toBe('browser_open_request');
    expect(payload.url).toBe('https://example.com/2');
  });

  it('reports the request as sent rather than the page as loaded', async () => {
    seedResults();
    const result = await call('open_search_result', { position: 1 });
    // Whether the page renders is the browser session's business and arrives
    // later; claiming it loaded here would be a guess.
    expect(result.requested).toBe(true);
  });

  it('refuses a result with no link', async () => {
    const store = useSearchStore();
    store.setResults({ query: 'q', results: [{ title: 'No link', url: '', content: '' }] });
    const result = await call('open_search_result', { position: 1 });
    expect(result.success).toBe(false);
  });
});

describe('result indices under mutation', () => {
  it('drops focus when the focused result is dismissed', () => {
    const store = seedResults();
    store.focusResult(1);
    store.removeResultAt(1);
    expect(store.focusedIndex).toBe(-1);
  });

  it('follows the focused result when an earlier one is dismissed', () => {
    const store = seedResults();
    store.focusResult(2);
    store.removeResultAt(0);
    // Everything after the removed card shifts up by one, so a stored index
    // would quietly come to mean a different result.
    expect(store.focusedIndex).toBe(1);
    expect(store.focusedResult?.title).toBe('Result 3');
  });

  it('drops focus when a new search replaces the results', () => {
    const store = seedResults();
    store.focusResult(2);
    store.setResults({ query: 'something else', results: [{ title: 'A', url: 'u', content: '' }] });
    expect(store.focusedIndex).toBe(-1);
  });

  it('keeps the layout across a clear, because it is a preference', () => {
    const store = useSearchStore();
    store.setLayout('floating');
    store.clear();
    expect(store.layout).toBe('floating');
  });
});

describe('search lifecycle', () => {
  it('shows a search as running before any results arrive', () => {
    const store = useSearchStore();
    store.setSearching(true, 'flights to lisbon');
    expect(store.isSearching).toBe(true);
    expect(store.query).toBe('flights to lisbon');
  });

  it('stops showing a search as running once it fails', () => {
    const store = useSearchStore();
    store.setSearching(true, 'q');
    store.setError('upstream timed out');
    expect(store.isSearching).toBe(false);
    expect(store.error).toBe('upstream timed out');
  });
});

describe('locale messages', () => {
  // vue-i18n reads braces and pipes as syntax and compiles lazily, so a
  // malformed description is silent until the model needs it.
  const bundles: Record<string, Record<string, unknown>> = {
    en: searchPanelEn,
    es: searchPanelEs,
  };

  function leafKeys(node: unknown, prefix = ''): string[] {
    if (typeof node === 'string') return [prefix];
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  }

  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`compiles every ${locale} message`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: bundle } });
      for (const key of leafKeys(bundle)) {
        expect(() => i18n.global.t(key, { layout: 'x', control: 'x', list: 'x', position: 1, count: 1, title: 'x' })).not.toThrow();
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(searchPanelEs).sort()).toEqual(leafKeys(searchPanelEn).sort());
  });
});
