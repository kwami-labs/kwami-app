import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import {
  forgetMcpKey,
  getMcpKey,
  parseMcpServers,
  setMcpKey,
  validateMcpServer,
} from '@/lib/mcpServers';
import { useUserToolsStore } from '@/stores/userTools';
import { useToolCatalogStore } from '@/stores/toolCatalog';

// --- the MCP client, faked: each server offers the tools listed here -----------
const offered: Record<string, { name: string; description?: string }[]> = {};
const failing = new Set<string>();
const calls: { url: string; tool: string; args: unknown }[] = [];

vi.mock('@/lib/mcpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mcpClient')>();
  class FakeClient {
    serverInfo = { name: 'fake' };
    constructor(private readonly options: { url: string }) {}
    async connect() {
      if (failing.has(this.options.url)) throw new actual.McpError('network', 'Failed to fetch');
    }
    async listTools() {
      return offered[this.options.url] ?? [];
    }
    async callTool(tool: string, args: unknown) {
      calls.push({ url: this.options.url, tool, args });
      return { content: [{ type: 'text', text: `${tool} ok` }] };
    }
    async close() {}
  }
  return { ...actual, McpClient: FakeClient };
});

// --- a live instance with the SDK registry's Map semantics -------------------
type Def = { name: string; description: string; handler?: (a: unknown) => Promise<unknown> };
function liveKwami(appTools: string[]) {
  const registry = new Map<string, Def>();
  for (const name of appTools) registry.set(name, { name, description: name });
  return {
    registry,
    isConnected: () => true,
    tools: {
      get: (name: string) => registry.get(name),
      getAll: () => [...registry.values()],
      register: (def: Def) => registry.set(def.name, def),
      unregister: (name: string) => registry.delete(name),
      getToolDefinitions: () => [...registry.values()],
    },
    agent: { registerTool: vi.fn(), unregisterTool: vi.fn(), syncConfigToBackend: vi.fn() },
  };
}
const kwamiRef = shallowRef<ReturnType<typeof liveKwami> | null>(null);
vi.mock('@/composables/useKwami', () => ({ useKwami: () => ({ kwami: kwamiRef }) }));

const { useMcpServers } = await import('@/composables/useMcpServers');

let host: VueWrapper | null = null;
function setup(appTools: string[] = ['send_email']) {
  const live = liveKwami(appTools);
  kwamiRef.value = live;
  host = mount(defineComponent({ setup: () => (useMcpServers().startSync(), () => h('div')) }));
  return live;
}

beforeEach(() => {
  setActivePinia(createPinia());
  kwamiRef.value = null;
  calls.length = 0;
  failing.clear();
  for (const key of Object.keys(offered)) delete offered[key];
});
afterEach(() => {
  // Removing every server also drops the module-level connections.
  useUserToolsStore().applySnapshot(null);
  host?.unmount();
  host = null;
});

const DW = 'https://mcp.deepwiki.com/mcp';

describe('MCP servers', () => {
  it('connects a saved server and registers its tools, prefixed and ahead of the app', async () => {
    offered[DW] = [{ name: 'read_wiki_structure', description: 'Topics of a repo' }];
    const live = setup(['send_email']);
    useUserToolsStore().saveServer({ name: 'DeepWiki', url: DW });
    await flushPromises();

    expect([...live.registry.keys()]).toEqual(['deepwiki__read_wiki_structure', 'send_email']);
    expect(live.registry.get('deepwiki__read_wiki_structure')?.description).toBe(
      '[DeepWiki] Topics of a repo',
    );
    expect(useToolCatalogStore().groupOf('deepwiki__read_wiki_structure')).toBe('mcp');

    const out = await live.registry.get('deepwiki__read_wiki_structure')!.handler!({ repo: 'a/b' });
    expect(out).toBe('read_wiki_structure ok');
    expect(calls).toEqual([{ url: DW, tool: 'read_wiki_structure', args: { repo: 'a/b' } }]);
  });

  it('leaves out the tools the user switched off, and brings them back', async () => {
    offered[DW] = [{ name: 'a' }, { name: 'b' }];
    const live = setup([]);
    const store = useUserToolsStore();
    store.saveServer({ name: 'dw', url: DW });
    await flushPromises();
    store.setServerToolEnabled('dw', 'a', false);
    await nextTick();
    expect([...live.registry.keys()]).toEqual(['dw__b']);
    store.setServerToolEnabled('dw', 'a', true);
    await nextTick();
    expect([...live.registry.keys()].sort()).toEqual(['dw__a', 'dw__b']);
  });

  it('takes the tools back when the server is removed', async () => {
    offered[DW] = [{ name: 'a' }];
    const live = setup([]);
    const store = useUserToolsStore();
    store.saveServer({ name: 'dw', url: DW });
    await flushPromises();
    store.removeServer('dw');
    await nextTick();
    expect(live.registry.size).toBe(0);
    expect(live.agent.unregisterTool).toHaveBeenCalledWith('dw__a');
  });

  it('records a failure instead of registering anything', async () => {
    failing.add(DW);
    const live = setup([]);
    useUserToolsStore().saveServer({ name: 'dw', url: DW });
    await flushPromises();
    expect(live.registry.size).toBe(0);
    expect(useMcpServers().states.dw).toMatchObject({
      status: 'error',
      error: { kind: 'network' },
    });
  });

  it('never takes the name of an app tool', async () => {
    offered[DW] = [{ name: 'email' }];
    const live = setup(['send__email']);
    useUserToolsStore().saveServer({ name: 'send', url: DW });
    await flushPromises();
    expect([...live.registry.keys()]).toEqual(['send__email_2', 'send__email']);
    expect(live.registry.get('send__email')?.description).toBe('send__email');
  });
});

describe('saved servers', () => {
  it('validates name and address', () => {
    expect(validateMcpServer({ name: '', url: DW }, new Set())).toEqual(['nameRequired']);
    expect(validateMcpServer({ name: 'dw', url: DW }, new Set(['dw']))).toEqual(['nameTaken']);
    expect(validateMcpServer({ name: 'dw', url: 'mcp.example.com' }, new Set())).toEqual([
      'urlInvalid',
    ]);
    expect(validateMcpServer({ name: 'dw', url: 'http://example.com/mcp' }, new Set())).toEqual([
      'urlInsecure',
    ]);
    expect(validateMcpServer({ name: 'dw', url: 'http://localhost:3001/mcp' }, new Set())).toEqual(
      [],
    );
  });

  it('reads back valid entries only', () => {
    expect(
      parseMcpServers([
        { name: 'dw', url: DW, disabledTools: ['a', 3] },
        { name: 'dw', url: DW },
        { name: 'x', url: 'nope' },
        null,
      ]),
    ).toEqual([{ name: 'dw', url: DW, disabledTools: ['a'] }]);
  });

  // The key is a credential for someone else's service: never in the config.
  it('keeps keys out of the saved config, on the device only when asked', () => {
    const store = useUserToolsStore();
    setMcpKey(DW, 'secret', false);
    store.saveServer({ name: 'dw', url: DW });
    expect(JSON.stringify(store.getSnapshot())).not.toContain('secret');
    expect(getMcpKey(DW)).toBe('secret');
    expect(localStorage.getItem(`kwami.mcpKey:${DW}`)).toBeNull();

    setMcpKey(DW, 'secret', true);
    expect(localStorage.getItem(`kwami.mcpKey:${DW}`)).toBe('secret');
    forgetMcpKey(DW);
    expect(getMcpKey(DW)).toBeUndefined();
  });
});
