/**
 * Tools on Jarvis's screen, and MCP servers by voice.
 *
 * A tool window runs one of the app's tools (an MCP server's most of all) and shows what
 * it answered, again on a button or a timer; only tools that read, since it runs by
 * itself. Jarvis connects, lists and removes the user's MCP servers as the Tools panel
 * does: the same checks, saved only once connected, never a key said aloud.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useUserToolsStore } from '@/stores/userTools';
import { hudEn } from '@/i18n/hud.locale';
import { workspaceAgentToolsEn } from '@/i18n/workspaceAgentTools.locale';
import {
  canShowTool,
  clampRefresh,
  REFRESH_MIN,
  toolMarkdown,
  toolView,
} from '@/lib/hud/toolWidget';
import { nameFromUrl, parseServerValue } from '@/composables/useMcpAgentControls';

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn() }),
}));

// --- the MCP client, faked: each server offers the tools listed here -----------
type Offered = {
  name: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
};
const offered: Record<string, Offered[]> = {};
const failing = new Map<string, 'network' | 'unauthorized'>();

vi.mock('@/lib/mcpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mcpClient')>();
  class FakeClient {
    serverInfo = { name: 'fake' };
    constructor(private readonly options: { url: string }) {}
    async connect() {
      const kind = failing.get(this.options.url);
      if (kind) throw new actual.McpError(kind, kind === 'network' ? 'Failed to fetch' : '401');
    }
    async listTools() {
      return offered[this.options.url] ?? [];
    }
    async callTool(tool: string, args: Record<string, unknown>) {
      return { content: [{ type: 'text', text: `**${tool}** for ${JSON.stringify(args)}` }] };
    }
    async close() {}
  }
  return { ...actual, McpClient: FakeClient };
});

// --- a live instance with the SDK registry's semantics ------------------------
type Def = { name: string; description: string; handler?: (a: unknown) => Promise<unknown> };
function liveKwami(appTools: Record<string, Def['handler']>) {
  const registry = new Map<string, Def>();
  for (const [name, handler] of Object.entries(appTools)) {
    registry.set(name, { name, description: name, handler });
  }
  return {
    registry,
    isConnected: () => true,
    tools: {
      get: (name: string) => registry.get(name),
      getAll: () => [...registry.values()],
      register: (def: Def) => registry.set(def.name, def),
      unregister: (name: string) => registry.delete(name),
      getToolDefinitions: () => [...registry.values()],
      execute: async (name: string, params: Record<string, unknown>) => {
        const tool = registry.get(name);
        if (!tool?.handler) throw new Error(`Tool not found: ${name}`);
        return tool.handler(params);
      },
    },
    agent: { registerTool: vi.fn(), unregisterTool: vi.fn(), syncConfigToBackend: vi.fn() },
  };
}
const kwamiRef = shallowRef<ReturnType<typeof liveKwami> | null>(null);
vi.mock('@/composables/useKwami', () => ({ useKwami: () => ({ kwami: kwamiRef }) }));

const { useMcpServers } = await import('@/composables/useMcpServers');
const { useHudAgentTools } = await import('@/composables/useHudAgentTools');
const { useMcpAgentControls } = await import('@/composables/useMcpAgentControls');

type Result = Record<string, unknown>;
let show: (args: Result) => Result | Promise<Result>;
let mcp: ReturnType<typeof useMcpAgentControls>;
let host: VueWrapper | null = null;

const WEATHER = 'https://weather.example.com/mcp';
const events = [
  { title: 'Dentist', start: '10:00', place: 'Calle Mayor' },
  { title: 'Call with Ana', start: '12:30', place: '' },
];

function setup() {
  const live = liveKwami({
    list_calendar_events: async () => ({ success: true, message: '2 events', events }),
    send_email: async () => ({ success: true }),
  });
  kwamiRef.value = live;
  host = mount(
    defineComponent({
      setup() {
        useMcpServers().startSync();
        show = useHudAgentTools().showOnScreen as typeof show;
        mcp = useMcpAgentControls();
        return () => h('div');
      },
    }),
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { ...hudEn, ...workspaceAgentToolsEn } },
          }),
        ],
      },
    },
  );
  return live;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useHudStore().setViewport({ width: 1600, height: 900 });
  kwamiRef.value = null;
  failing.clear();
  for (const key of Object.keys(offered)) delete offered[key];
});
afterEach(() => {
  useUserToolsStore().applySnapshot(null);
  host?.unmount();
  host = null;
});

describe('which tools a window may run', () => {
  it('runs tools that read, by the verb their name starts with', () => {
    for (const name of [
      'list_calendar_events',
      'read_emails',
      'get_credit_balance',
      'gitmcp__search_generic_code',
      'gitmcp__fetch_generic_url_content',
      'weather__getForecast',
    ]) {
      expect(canShowTool(name), name).toBe(true);
    }
  });

  it('never runs one that sends, changes or deletes, nor itself', () => {
    for (const name of [
      'send_email',
      'delete_kwami',
      'create_calendar_event',
      'github__create_issue',
      'performance_metrics',
      'show_on_screen',
      '',
    ]) {
      expect(canShowTool(name), name).toBe(false);
    }
  });

  it('believes the MCP server about its own tools', () => {
    expect(canShowTool('srv__forecast', { readOnlyHint: true })).toBe(true);
    expect(canShowTool('srv__get_and_reset', { readOnlyHint: false })).toBe(false);
    expect(canShowTool('srv__get_thing', { destructiveHint: true })).toBe(false);
  });

  it('keeps the timer between fifteen seconds and a day, or off', () => {
    expect(clampRefresh(5)).toBe(REFRESH_MIN);
    expect(clampRefresh('60')).toBe(60);
    expect(clampRefresh(10 ** 7)).toBe(86_400);
    expect(clampRefresh(0)).toBe(0);
    expect(clampRefresh('soon')).toBe(0);
  });
});

describe('how a tool answer is shown', () => {
  it('a list of records is a table, with what wrapped it above', () => {
    const view = toolView({ success: true, message: '2 events', events });
    expect(view).toMatchObject({
      type: 'table',
      columns: ['title', 'start', 'place'],
      rows: [
        ['Dentist', '10:00', 'Calle Mayor'],
        ['Call with Ana', '12:30', ''],
      ],
      pairs: [
        ['success', 'true'],
        ['message', '2 events'],
      ],
    });
    expect(toolMarkdown(view)).toContain('- title: Dentist · start: 10:00');
  });

  it('JSON in a string is read as JSON; anything else is the text itself', () => {
    expect(toolView('[{"a":1},{"a":2}]')).toMatchObject({ type: 'table', columns: ['a'] });
    expect(toolView('# Forecast\nSunny')).toEqual({ type: 'text', text: '# Forecast\nSunny' });
    expect(toolView({ temp: 21, sky: { cover: 'none' } })).toEqual({
      type: 'pairs',
      pairs: [
        ['temp', '21'],
        ['sky', '{"cover":"none"}'],
      ],
    });
    expect(toolView(['a', 'b'])).toMatchObject({ type: 'list', items: ['a', 'b'] });
    expect(toolView('')).toEqual({ type: 'empty' });
  });

  it('a failure reads as one', () => {
    expect(toolView({ ok: false, error: 'HTTP 500' })).toEqual({
      type: 'error',
      message: 'HTTP 500',
    });
    expect(toolView({ success: false, message: 'Not signed in' })).toEqual({
      type: 'error',
      message: 'Not signed in',
    });
  });
});

describe('a tool window, by voice', () => {
  it('opens one of the app tools, runs it and answers with what it shows', async () => {
    setup();
    const out = await show({
      action: 'open',
      kind: 'tool',
      tool: 'list_calendar_events',
      refresh: 5,
    });
    expect(out.success).toBe(true);
    expect(String(out.result)).toContain('Dentist');
    const widget = useHudStore().widgets.find((w) => w.kind === 'tool')!;
    expect(widget).toMatchObject({ tool: 'list_calendar_events', refresh: REFRESH_MIN });

    const listed = (await show({ action: 'list' })) as { windows: Result[] };
    expect(listed.windows[0]).toMatchObject({ kind: 'tool', tool: 'list_calendar_events' });
    expect(String(listed.windows[0].shows)).toContain('Dentist');
  });

  it('refuses a tool that writes, and one that is not there, saying which could be shown', async () => {
    setup();
    const writes = await show({ action: 'open', kind: 'tool', tool: 'send_email' });
    expect(writes.success).toBe(false);
    expect(String(writes.message)).toContain('only runs tools that read');
    const missing = await show({ action: 'open', tool: 'weather__forecast' });
    expect(missing.success).toBe(false);
    expect(missing.showable).toEqual(['list_calendar_events']);
    expect(useHudStore().widgets).toHaveLength(0);
  });

  it('runs again on refresh, and the timer can change or stop', async () => {
    setup();
    const opened = await show({ action: 'open', kind: 'tool', tool: 'list_calendar_events' });
    const again = await show({ action: 'refresh', id: String(opened.id), refresh: 120 });
    expect(again).toMatchObject({ success: true, refreshEvery: 120 });
    const stopped = await show({ action: 'refresh', id: 'herramienta', refresh: 0 });
    expect(stopped).toMatchObject({ success: true, refreshEvery: 'by hand' });
    const notTool = useHudStore().openDocument(useHudStore().createDocument('Notes', 'x'), 'user');
    expect((await show({ action: 'refresh', id: notTool.id })).success).toBe(false);
  });

  it('opening the same tool with the same arguments brings the window back', async () => {
    setup();
    await show({ action: 'open', kind: 'tool', tool: 'list_calendar_events', args: { day: 1 } });
    await show({ action: 'open', kind: 'tool', tool: 'list_calendar_events', args: { day: 1 } });
    await show({ action: 'open', kind: 'tool', tool: 'list_calendar_events', args: { day: 2 } });
    expect(useHudStore().widgets.filter((w) => w.kind === 'tool')).toHaveLength(2);
  });
});

describe('MCP servers by voice', () => {
  it('names a server from its address', () => {
    expect(nameFromUrl('https://mcp.deepwiki.com/mcp')).toBe('deepwiki');
    expect(nameFromUrl('https://gitmcp.io/docs')).toBe('gitmcp');
    expect(nameFromUrl('http://localhost:8787/mcp')).toBe('localhost');
    expect(parseServerValue('tiempo https://weather.example.com/mcp')).toEqual({
      name: 'tiempo',
      url: WEATHER,
    });
    expect(parseServerValue({ url: WEATHER })).toEqual({ name: 'weather', url: WEATHER });
  });

  it('connects a server, saves it and its tools are there to call and to show', async () => {
    offered[WEATHER] = [
      { name: 'forecast', annotations: { readOnlyHint: true } },
      { name: 'set_alert' },
    ];
    const live = setup();
    const out = await mcp.connect({ url: WEATHER });
    expect(out).toMatchObject({ success: true, name: 'weather', status: 'connected' });
    expect(out.tools).toEqual(['weather__forecast', 'weather__set_alert']);
    expect(useUserToolsStore().mcpServers).toEqual([{ name: 'weather', url: WEATHER }]);
    expect(live.registry.has('weather__forecast')).toBe(true);

    // Its read-only tool goes in a window; the other is the model's to call.
    const shown = await show({
      action: 'open',
      tool: 'weather__forecast',
      args: { city: 'Madrid' },
    });
    expect(String(shown.result)).toContain('forecast');
    expect((await show({ action: 'open', tool: 'weather__set_alert' })).success).toBe(false);

    expect(mcp.list().servers).toEqual([
      expect.objectContaining({ name: 'weather', status: 'connected' }),
    ]);
  });

  it('a second connect of the same address reconnects it rather than adding a twin', async () => {
    offered[WEATHER] = [{ name: 'forecast' }];
    setup();
    await mcp.connect(WEATHER);
    const again = await mcp.control('connectmcp', { name: 'other', url: WEATHER });
    expect(again).toMatchObject({ success: true, name: 'weather' });
    expect(useUserToolsStore().mcpServers).toHaveLength(1);
  });

  it('saves nothing for a server that does not connect, and never asks for a key aloud', async () => {
    setup();
    failing.set(WEATHER, 'unauthorized');
    const locked = await mcp.connect(WEATHER);
    expect(locked.success).toBe(false);
    expect(String(locked.message)).toContain('never ask for it aloud');
    failing.set(WEATHER, 'network');
    const down = await mcp.connect(WEATHER);
    expect(down.success).toBe(false);
    expect(String(down.message)).toContain('CORS');
    expect(useUserToolsStore().mcpServers).toEqual([]);
    expect(kwamiRef.value!.registry.size).toBe(2);
  });

  it('keeps a server connected by voice on the kwami at once, leaving other drafts alone', async () => {
    offered[WEATHER] = [{ name: 'forecast' }];
    setup();
    const { useWorkspaceStore } = await import('@/stores/workspace');
    const workspace = useWorkspaceStore();
    workspace.workspaces.push({
      id: 'kwami_local_1',
      name: 'Jarvis',
      emoji: '',
      colors: { x: '#000', y: '#000', z: '#000' },
      config: { theme: { mode: 'light' } },
      savedConfig: { theme: { mode: 'dark' } },
      hasUnsavedConfig: true,
    });
    workspace.activeWorkspaceId = 'kwami_local_1';
    const out = await mcp.connect(WEATHER);
    expect(String(out.message)).toContain('kept on this kwami');
    const saved = workspace.getActiveSavedConfig() as {
      theme: unknown;
      tools: { mcpServers: unknown[] };
    };
    expect(saved.tools.mcpServers).toEqual([{ name: 'weather', url: WEATHER }]);
    expect(saved.theme).toEqual({ mode: 'dark' });
    expect(workspace.hasActiveUnsavedConfig).toBe(true);
    await mcp.control('removemcp', 'weather');
    expect(
      (workspace.getActiveSavedConfig() as { tools: { mcpServers: unknown[] } }).tools.mcpServers,
    ).toEqual([]);
  });

  it('checks the address as the panel does', async () => {
    setup();
    const plain = await mcp.connect('http://tools.example.com/mcp');
    expect(String(plain.message)).toContain('https');
    expect((await mcp.connect('not a url')).success).toBe(false);
  });

  it('removes a server by its name, and its tools go with it', async () => {
    offered[WEATHER] = [{ name: 'forecast' }];
    const live = setup();
    await mcp.connect(WEATHER);
    expect(await mcp.control('removemcp', 'Weather')).toMatchObject({ success: true });
    await flushPromises();
    expect(useUserToolsStore().mcpServers).toEqual([]);
    expect(live.registry.has('weather__forecast')).toBe(false);
    expect(await mcp.control('removemcp', 'weather')).toMatchObject({ success: false });
  });
});

describe('the tool window on screen', () => {
  async function mounted() {
    setup();
    const { default: ToolWidget } = await import('@/components/hud/widgets/ToolWidget.vue');
    const hud = useHudStore();
    const widget = hud.open({ kind: 'tool', title: 'Agenda', tool: 'list_calendar_events' });
    const wrapper = mount(ToolWidget, {
      props: { widget, index: 0 },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { ...hudEn } } })],
        stubs: {
          HudWindow: { template: '<div><slot /><slot name="footer" /></div>' },
        },
      },
    });
    await flushPromises();
    return { wrapper, widget, hud };
  }

  it('runs its tool as it opens and shows the records as a table', async () => {
    const { wrapper } = await mounted();
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.find('tbody td').text()).toBe('Dentist');
    expect(wrapper.text()).toContain('2 events');
    expect(wrapper.text()).toContain('list_calendar_events');
    wrapper.unmount();
  });

  it('runs again on its button, and its timer goes round the choices', async () => {
    const { wrapper, widget } = await mounted();
    let runs = 0;
    kwamiRef.value!.registry.get('list_calendar_events')!.handler = async () => {
      runs += 1;
      return { success: true, events: [{ title: 'Moved', start: '11:00' }] };
    };
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(runs).toBe(1);
    expect(wrapper.find('tbody td').text()).toBe('Moved');

    const every = wrapper.find('button.every');
    expect(every.text()).toContain('By hand');
    await every.trigger('click');
    expect(widget.refresh).toBe(30);
    expect(every.text()).toContain('Every 30 s');
    wrapper.unmount();
  });

  it('says so when its tool is not there, without running anything', async () => {
    setup();
    const { default: ToolWidget } = await import('@/components/hud/widgets/ToolWidget.vue');
    const widget = useHudStore().open({ kind: 'tool', title: 'Gone', tool: 'weather__forecast' });
    const wrapper = mount(ToolWidget, {
      props: { widget, index: 0 },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { ...hudEn } } })],
        stubs: { HudWindow: { template: '<div><slot /></div>' } },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Waiting for the tool to be ready');
    wrapper.unmount();
  });

  it('after a while without its tool, says its server may be off', async () => {
    vi.useFakeTimers();
    setup();
    const { default: ToolWidget } = await import('@/components/hud/widgets/ToolWidget.vue');
    const widget = useHudStore().open({ kind: 'tool', title: 'Gone', tool: 'weather__forecast' });
    const wrapper = mount(ToolWidget, {
      props: { widget, index: 0 },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { ...hudEn } } })],
        stubs: { HudWindow: { template: '<div><slot /></div>' } },
      },
    });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(wrapper.text()).toContain('There is no tool called "weather__forecast"');
    wrapper.unmount();
    vi.useRealTimers();
  });
});

describe('HTML inside a Markdown answer', () => {
  it('keeps links as links, drops pictures and tags, and leaves code alone', async () => {
    const { stripHtml } = await import('@/lib/hud/toolWidget');
    const readme = [
      '<p align="center">',
      '<a href="https://pinia.vuejs.org"><img src="logo.svg" alt="Pinia logo"></a>',
      '</p>',
      '<br/>',
      '<a href="https://npmx.dev/package/pinia"><img src="badge.svg"></a> <a href="https://x.dev">Docs</a>',
      '',
      '# Pinia',
      '```html',
      '<div id="app"></div>',
      '```',
    ].join('\n');
    expect(stripHtml(readme)).toBe(
      ['[Docs](https://x.dev)', '', '# Pinia', '```html', '<div id="app"></div>', '```'].join('\n'),
    );
    expect(stripHtml('a < b and c > d')).toBe('a < b and c > d');
  });
});

describe("Jarvis's figure and the action log", () => {
  it('moves off the log when the log sits where the figure was', () => {
    const hud = useHudStore();
    hud.open({ kind: 'document', title: 'Notes', source: 'user' });
    const before = { ...hud.avatar };
    // A log laid right over where the figure is now.
    const log = { x: before.x - 120, y: before.y - 120, w: 240, h: 240 };
    hud.setLogRect(log);
    const spot = hud.avatar;
    const radius = (Math.min(1600, 900) * 0.95 * spot.scale) / 2;
    const overlaps =
      spot.x + radius > log.x &&
      spot.x - radius < log.x + log.w &&
      spot.y + radius > log.y &&
      spot.y - radius < log.y + log.h;
    expect(overlaps).toBe(false);
    hud.setLogRect(null);
    expect(hud.avatar).toEqual(before);
  });
});
