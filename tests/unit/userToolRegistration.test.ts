import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useUserToolRegistration } from '@/composables/useUserToolRegistration';
import { useUserToolsStore } from '@/stores/userTools';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import type { UserWebhookTool } from '@/lib/userTools';

type Def = { name: string; description: string; handler?: unknown };

/** A registry with the SDK's Map semantics: re-setting a key keeps its slot. */
function liveKwami(appTools: string[], connected = true) {
  const registry = new Map<string, Def>();
  for (const name of appTools) registry.set(name, { name, description: name });
  return {
    registry,
    isConnected: () => connected,
    tools: {
      get: (name: string) => registry.get(name),
      getAll: () => [...registry.values()],
      register: (def: Def) => registry.set(def.name, def),
      unregister: (name: string) => registry.delete(name),
      getToolDefinitions: () => [...registry.values()].map(({ name }) => ({ name })),
    },
    agent: { registerTool: vi.fn(), unregisterTool: vi.fn(), syncConfigToBackend: vi.fn() },
  };
}

const kwamiRef = shallowRef<ReturnType<typeof liveKwami> | null>(null);
vi.mock('@/composables/useKwami', () => ({ useKwami: () => ({ kwami: kwamiRef }) }));

const webhook = (name: string): UserWebhookTool => ({
  name,
  description: `${name} tool`,
  url: 'https://x.org/hook',
  method: 'POST',
  params: [],
});

let host: VueWrapper | null = null;

function setup(appTools: string[]) {
  const live = liveKwami(appTools);
  kwamiRef.value = live;
  host = mount(defineComponent({ setup: () => (useUserToolRegistration(), () => h('div')) }));
  return live;
}

// A host left mounted keeps watching the shared kwami ref with the previous
// test's store, and re-registers that test's tools onto the next instance.
afterEach(() => {
  host?.unmount();
  host = null;
});

beforeEach(() => {
  setActivePinia(createPinia());
  kwamiRef.value = null;
});

describe('useUserToolRegistration', () => {
  // The agent keeps the head of the list when it is over the provider's 128,
  // so a user tool at the tail was the first thing dropped.
  it('puts the user tools ahead of the app tools', async () => {
    const live = setup(['set_ui_control', 'send_email', 'list_calendar_events']);
    useUserToolsStore().save(webhook('get_weather'));
    await nextTick();

    expect([...live.registry.keys()]).toEqual([
      'get_weather',
      'set_ui_control',
      'send_email',
      'list_calendar_events',
    ]);
    expect(useToolCatalogStore().groupOf('get_weather')).toBe('custom');
    const sync = live.agent.syncConfigToBackend.mock.calls.at(-1);
    expect(sync?.[0]).toBe('tools');
    expect((sync?.[1] as { name: string }[])[0].name).toBe('get_weather');
  });

  it('takes back a tool the user removed, and tells the agent', async () => {
    const live = setup(['send_email']);
    const store = useUserToolsStore();
    store.save(webhook('get_weather'));
    await nextTick();
    store.remove('get_weather');
    await nextTick();

    expect(live.registry.has('get_weather')).toBe(false);
    expect(live.agent.unregisterTool).toHaveBeenCalledWith('get_weather');
    expect(useToolCatalogStore().groupOf('get_weather')).toBe('other');
  });

  it('follows a rename', async () => {
    const live = setup([]);
    const store = useUserToolsStore();
    store.save(webhook('old_name'));
    await nextTick();
    store.save(webhook('new_name'), 'old_name');
    await nextTick();

    expect([...live.registry.keys()]).toEqual(['new_name']);
  });

  it('never replaces one of the app tools with a saved tool of the same name', async () => {
    const live = setup(['send_email']);
    // Saved before the app shipped a tool called send_email.
    useUserToolsStore().applySnapshot({ webhooks: [webhook('send_email')] });
    await nextTick();

    expect(live.registry.get('send_email')?.description).toBe('send_email');
    expect(live.agent.registerTool).not.toHaveBeenCalled();
  });

  it("clears the previous kwami's tools when the next has none", async () => {
    const live = setup([]);
    const store = useUserToolsStore();
    store.applySnapshot({ webhooks: [webhook('get_weather')] });
    await nextTick();
    store.applySnapshot(null);
    await nextTick();

    expect(live.registry.size).toBe(0);
  });
});
