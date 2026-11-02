/**
 * Layout and notification settings by voice. The layout is undoable and runs freely;
 * the phone that receives every reminder never changes without the dialog.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useLayoutAgentTools } from '@/composables/useLayoutAgentTools';
import { layoutEn } from '@/i18n/layout.locale';
import { useWorkspaceStore } from '@/stores/workspace';

type Handler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

const registered = new Map<string, { description: string; handler: Handler }>();
const approve = { value: true };
const confirmations: unknown[] = [];

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    requestConfirmation: vi.fn(async (options: unknown) => {
      confirmations.push(options);
      return approve.value;
    }),
  }),
}));

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

function tool(name: string): Handler {
  return registered.get(name)!.handler;
}

const stored = {
  settings: {
    notify_to: '+34600000000',
    notify_channel: 'sms',
    timezone: 'Europe/Madrid',
    reports_enabled: false,
  },
};

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  localStorage.clear();
  vi.clearAllMocks();
  api.get.mockResolvedValue(stored);
  api.put.mockResolvedValue({ settings: { ok: true } });
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
  const Host = defineComponent({
    setup() {
      useLayoutAgentTools().registerLayoutTools({
        registerTool: (def: { name: string; description: string; handler: Handler }) =>
          registered.set(def.name, def),
      } as never);
      return () => h('div');
    },
  });
  mount(Host, {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: layoutEn } })] },
  });
});

describe('set_panel_arrangement', () => {
  it('hides, shows, moves and resets', async () => {
    const hidden = await tool('set_panel_arrangement')({ action: 'hide', panel: 'audio' });
    expect(hidden.arrangement).toMatchObject({ hidden: ['audio'] });
    await tool('set_panel_arrangement')({ action: 'show', panel: 'audio' });
    const up = await tool('set_panel_arrangement')({ action: 'move_up', panel: 'audio' });
    expect((up.arrangement as { order: string[] }).order[0]).toBe('audio');
    await tool('set_panel_arrangement')({ action: 'move_down', panel: 'audio' });
    const reset = await tool('set_panel_arrangement')({ action: 'reset' });
    expect(reset.arrangement).toEqual({ hidden: [], order: [] });
    expect(confirmations).toHaveLength(0);
  });

  it('refuses an unknown panel or action', async () => {
    const panel = await tool('set_panel_arrangement')({ action: 'hide', panel: 'x' });
    expect(panel.success).toBe(false);
    const action = await tool('set_panel_arrangement')({ action: 'dance', panel: 'audio' });
    expect(action.success).toBe(false);
  });
});

describe('set_assistant_notifications', () => {
  it('asks first and keeps what was not mentioned', async () => {
    const result = await tool('set_assistant_notifications')({ reports_enabled: true });
    expect(confirmations).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(api.put).toHaveBeenCalledWith('/assistant/settings', {
      kwami_id: 'k1',
      notify_to: '+34600000000',
      notify_channel: 'sms',
      timezone: 'Europe/Madrid',
      reports_enabled: true,
    });
  });

  it('never changes the phone on a no, whatever the model passes', async () => {
    approve.value = false;
    const result = await tool('set_assistant_notifications')({
      notify_to: '+34999999999',
      express_order: 'sin revisar',
      confirm: true,
    });
    expect(result.cancelled).toBe(true);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('reports a failure', async () => {
    api.get.mockRejectedValue(new Error('down'));
    expect(await tool('set_assistant_notifications')({})).toEqual({
      success: false,
      message: 'down',
    });
  });
});
