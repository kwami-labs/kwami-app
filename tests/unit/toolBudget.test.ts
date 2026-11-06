import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Kwami } from 'kwami';
import ToolBudget from '@/components/panels/settings/tools/ToolBudget.vue';
import ToolCatalog from '@/components/panels/settings/tools/ToolCatalog.vue';
import { parseToolInventory, useToolInventoryStore } from '@/stores/toolInventory';
import { useUserToolsStore } from '@/stores/userTools';
import { registerToolBatch, type ToolGroupId } from '@/lib/toolRegistration';

const REPORT = {
  type: 'tool_inventory',
  limit: 128,
  total: 128,
  builtin: ['web_search', 'navigate_to'],
  client: 2,
  dropped: ['send_email'],
};

beforeEach(() => setActivePinia(createPinia()));

describe('tool_inventory', () => {
  it('reads the report and ignores anything else', () => {
    expect(parseToolInventory(REPORT, 5)).toEqual({
      limit: 128,
      total: 128,
      builtin: ['web_search', 'navigate_to'],
      client: 2,
      dropped: ['send_email'],
      receivedAt: 5,
    });
    expect(parseToolInventory({ type: 'brain_status' })).toBeNull();
    expect(parseToolInventory(null)).toBeNull();
  });

  // It crosses from another process and version: junk must not break the panel.
  it('survives junk fields', () => {
    expect(
      parseToolInventory({ type: 'tool_inventory', builtin: [1, 'a'], dropped: 'x', total: -3 }, 1),
    ).toEqual({ limit: 128, total: 0, builtin: ['a'], client: 0, dropped: [], receivedAt: 1 });
  });

  it('keeps the latest report from the agent message event', () => {
    const store = useToolInventoryStore();
    store.apply({ ...REPORT, dropped: [] });
    store.apply({ type: 'search_results' });
    expect(store.inventory?.dropped).toEqual([]);
  });
});

describe('ToolBudget', () => {
  const tools = [
    { name: 'set_theme', description: '' },
    { name: 'send_email', description: '' },
    { name: 'get_weather', description: '' },
  ];
  const groups: Record<string, ToolGroupId> = {
    set_theme: 'appearance',
    send_email: 'email',
    get_weather: 'custom',
  };

  it('splits what reaches the model and names what does not', () => {
    const w = mount(ToolBudget, {
      props: {
        inventory: parseToolInventory(REPORT),
        clientTools: tools,
        groupOf: (n: string) => groups[n] ?? 'other',
      },
    });
    expect(w.find('.figure').text()).toBe('128 of 128');
    expect(w.findAll('.legend b').map((b) => b.text())).toEqual(['2', '1', '1']);
    expect(w.find('.dropped').text()).toContain('1 tool does not reach the model');
    expect(w.find('.names').text()).toBe('send_email');
  });

  it('says what it knows when the agent has not reported', () => {
    const w = mount(ToolBudget, {
      props: { inventory: null, clientTools: tools, groupOf: () => 'other' as ToolGroupId },
    });
    expect(w.find('.unknown').text()).toContain('The app offers 3');
  });
});

describe('switching a group off', () => {
  function live() {
    const registry = new Map<string, { name: string; description: string }>();
    return {
      registry,
      isConnected: () => true,
      tools: {
        get: (n: string) => registry.get(n),
        register: (d: { name: string; description: string }) => registry.set(d.name, d),
        unregister: (n: string) => registry.delete(n),
        getToolDefinitions: () => [...registry.values()],
      },
      agent: { registerTool: vi.fn(), unregisterTool: vi.fn(), syncConfigToBackend: vi.fn() },
    };
  }

  const fill =
    () =>
    ({ instance, group }: { instance: Kwami; group: (g: ToolGroupId) => void }) => {
      group('email');
      instance.registerTool({ name: 'send_email', description: 'Sends.' });
      group('appearance');
      instance.registerTool({ name: 'set_theme', description: 'Theme.' });
    };

  it('keeps the group out of the registry and takes back what was there', () => {
    const k = live();
    registerToolBatch(k as unknown as Kwami, fill(), () => {});
    expect([...k.registry.keys()]).toEqual(['send_email', 'set_theme']);

    const skipped: string[] = [];
    registerToolBatch(k as unknown as Kwami, fill(), () => {}, {
      skip: (g) => g === 'email',
      onSkipped: (tool) => skipped.push(tool.name),
    });

    expect([...k.registry.keys()]).toEqual(['set_theme']);
    expect(k.agent.unregisterTool).toHaveBeenCalledWith('send_email');
    expect(skipped).toEqual(['send_email']);
    // One sync with the smaller list.
    expect(k.agent.syncConfigToBackend.mock.calls.at(-1)?.[1]).toHaveLength(1);
  });

  it('is saved per kwami, for the app groups that may be switched off only', () => {
    const store = useUserToolsStore();
    store.setGroupEnabled('communications', false);
    store.setGroupEnabled('interface', false); // the agent needs it to show anything
    store.setGroupEnabled('custom', false); // not an app group
    expect(store.getSnapshot().disabledGroups).toEqual(['communications']);

    store.applySnapshot({ disabledGroups: ['email', 'interface', 'nope', 'email'] });
    expect(store.disabledGroups).toEqual(['email']);
    store.setGroupEnabled('email', true);
    expect(store.disabledGroups).toEqual([]);
  });
});

describe('ToolCatalog with the budget', () => {
  const tools = [
    { name: 'send_email', description: 'Sends an email.' },
    { name: 'set_theme', description: 'Changes the theme.' },
    { name: 'web_search', description: '' },
  ];
  const groups: Record<string, ToolGroupId> = {
    send_email: 'email',
    set_theme: 'appearance',
    web_search: 'agent',
  };

  function mountCatalog(off: ToolGroupId[] = []) {
    return mount(ToolCatalog, {
      props: {
        tools,
        groupOf: (n: string) => groups[n] ?? 'other',
        offGroups: new Set(off),
        dropped: new Set(['send_email']),
      },
    });
  }

  it('offers a switch on the app groups, not on the agent’s', async () => {
    const w = mountCatalog();
    const bars = w.findAll('.group-bar');
    const titles = bars.map((b) => b.find('.group-title').text());
    const withSwitch = bars
      .filter((b) => b.find('.switch').exists())
      .map((b) => b.find('.group-title').text());
    expect(titles).toEqual(['Look and ambience', 'Email', 'The agent’s own']);
    expect(withSwitch).toEqual(['Look and ambience', 'Email']);

    await bars[1].find('.switch input').setValue(false);
    expect(w.emitted('toggle-group')).toEqual([['email', false]]);
  });

  it('marks a dropped tool, and an off group cannot be tested', async () => {
    const w = mountCatalog(['email']);
    expect(w.findAll('.group.off .group-title').map((g) => g.text())).toEqual(['Email']);
    await w.find('.search-input').setValue('send_email');
    expect(w.find('.dropped').text()).toBe('Does not reach the model');
    await w.find('.row-head').trigger('click');
    expect(w.findAll('button').some((b) => b.text() === 'Test')).toBe(false);
  });

  it('lists the agent’s own tools without actions', async () => {
    const w = mountCatalog();
    await w.find('.search-input').setValue('web_search');
    await w.find('.row-head').trigger('click');
    expect(w.find('.detail .note').text()).toContain('runs on the server');
    expect(w.find('.detail .actions').exists()).toBe(false);
  });
});
