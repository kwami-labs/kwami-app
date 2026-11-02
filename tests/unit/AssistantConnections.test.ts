/** The settings the reports and the Google link hang from. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import AssistantConnections from '@/components/panels/settings/communications/AssistantConnections.vue';
import { assistantEn } from '@/i18n/assistant.locale';
import { useWorkspaceStore } from '@/stores/workspace';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

function respond(google: Record<string, unknown>) {
  api.get.mockImplementation(async (path: string) =>
    path === '/google/status'
      ? google
      : {
          settings: {
            notify_to: '+34612345678',
            notify_channel: 'sms',
            timezone: 'Europe/Madrid',
            reports_enabled: true,
          },
        },
  );
}

async function render() {
  const wrapper = mount(AssistantConnections, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: assistantEn } })],
      stubs: {
        PanelSection: { template: '<section><slot /></section>' },
        BaseButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        BaseInput: { template: '<input />' },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof render>>, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === label);
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
});

describe('AssistantConnections', () => {
  it('says when the server has no Google client', async () => {
    respond({ configured: false, connected: false, email: null });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.googleNotConfigured);
    expect(wrapper.text()).not.toContain(assistantEn.assistant.googleConnect);
  });

  it('opens the consent page to connect', async () => {
    respond({ configured: true, connected: false, email: null });
    api.post.mockResolvedValue({ url: 'https://accounts.google.com/x' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.googleConnect).trigger('click');
    await flushPromises();
    expect(open).toHaveBeenCalledWith('https://accounts.google.com/x', '_blank', 'noopener');
  });

  it('shows the account and disconnects it', async () => {
    respond({ configured: true, connected: true, email: 'yo@gmail.com' });
    api.del.mockResolvedValue({ ok: true });
    const wrapper = await render();
    expect(wrapper.text()).toContain('yo@gmail.com');
    await button(wrapper, assistantEn.assistant.googleDisconnect).trigger('click');
    await flushPromises();
    expect(api.del).toHaveBeenCalledWith('/google/account');
  });

  it('saves what it loaded', async () => {
    respond({ configured: false, connected: false, email: null });
    api.put.mockResolvedValue({});
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.save).trigger('click');
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith('/assistant/settings', {
      kwami_id: 'k1',
      notify_to: '+34612345678',
      notify_channel: 'sms',
      timezone: 'Europe/Madrid',
      reports_enabled: true,
    });
    expect(wrapper.text()).toContain(assistantEn.assistant.saved);
  });

  it('shows the error when saving fails', async () => {
    respond({ configured: false, connected: false, email: null });
    api.put.mockRejectedValue(new Error('Invalid phone number'));
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.save).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Invalid phone number');
  });
});
