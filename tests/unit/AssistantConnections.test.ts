/** The settings the reports and the Google link hang from. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import AssistantConnections from '@/components/panels/settings/communications/AssistantConnections.vue';
import { assistantEn } from '@/i18n/assistant.locale';
import { useWorkspaceStore } from '@/stores/workspace';

enableAutoUnmount(afterEach);

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
    respond({ configured: false, connected: false, email: null, accounts: [] });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.googleNotConfigured);
    expect(wrapper.text()).not.toContain(assistantEn.assistant.googleConnect);
  });

  it('opens the consent page to connect', async () => {
    respond({ configured: true, connected: false, email: null, accounts: [] });
    api.post.mockResolvedValue({ url: 'https://accounts.google.com/x' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.googleConnect).trigger('click');
    await flushPromises();
    expect(open).toHaveBeenCalledWith('https://accounts.google.com/x', '_blank', 'noopener');
  });

  const healthy = { needs_reconnect: false, missing_scopes: [] };

  it('shows each account and disconnects only the one asked for', async () => {
    respond({
      configured: true,
      connected: true,
      email: 'yo@gmail.com',
      accounts: [
        { email: 'yo@gmail.com', ...healthy },
        { email: 'claude@nexow.ai', ...healthy },
      ],
    });
    api.del.mockResolvedValue({ ok: true });
    const wrapper = await render();
    expect(wrapper.text()).toContain('yo@gmail.com');
    expect(wrapper.text()).toContain('claude@nexow.ai');
    const buttons = wrapper
      .findAll('button')
      .filter((b) => b.text() === assistantEn.assistant.googleDisconnect);
    expect(buttons).toHaveLength(2);
    await buttons[1]!.trigger('click');
    await flushPromises();
    expect(api.del).toHaveBeenCalledWith('/google/account', {
      query: { account: 'claude@nexow.ai' },
    });
  });

  it('offers another account once one is linked', async () => {
    respond({
      configured: true,
      connected: true,
      email: 'yo@gmail.com',
      accounts: [{ email: 'yo@gmail.com', ...healthy }],
    });
    const wrapper = await render();
    expect(button(wrapper, assistantEn.assistant.googleConnectAnother)).toBeTruthy();
    expect(wrapper.text()).not.toContain(assistantEn.assistant.googleReconnect);
  });

  it('says when a link died, or lacks what was added later', async () => {
    respond({
      configured: true,
      connected: true,
      email: 'yo@gmail.com',
      accounts: [
        { email: 'yo@gmail.com', needs_reconnect: true, missing_scopes: [] },
        { email: 'otra@gmail.com', needs_reconnect: false, missing_scopes: ['drive'] },
      ],
    });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.googleNeedsReconnect);
    expect(wrapper.text()).toContain(assistantEn.assistant.googleMissingScopes);
    expect(
      wrapper.findAll('button').filter((b) => b.text() === assistantEn.assistant.googleReconnect),
    ).toHaveLength(2);
  });

  describe('after opening the consent page', () => {
    const link = { url: 'https://accounts.google.com/x' };
    const none = { configured: true, connected: false, email: null, accounts: [] };
    const linked = {
      configured: true,
      connected: true,
      email: 'yo@gmail.com',
      accounts: [{ email: 'yo@gmail.com', ...healthy }],
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue(null);
      api.post.mockResolvedValue(link);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits, then shows the account without a reload', async () => {
      respond(none);
      const wrapper = await render();
      await button(wrapper, assistantEn.assistant.googleConnect).trigger('click');
      await flushPromises();
      expect(wrapper.text()).toContain(assistantEn.assistant.googleWaiting);
      respond(linked);
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
      expect(wrapper.text()).toContain('yo@gmail.com');
      expect(wrapper.text()).toContain(assistantEn.assistant.googleUpdated);
      expect(wrapper.text()).not.toContain(assistantEn.assistant.googleWaiting);
    });

    it('stops asking when nothing comes back', async () => {
      respond(none);
      const wrapper = await render();
      await button(wrapper, assistantEn.assistant.googleConnect).trigger('click');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(181_000);
      await flushPromises();
      expect(wrapper.text()).not.toContain(assistantEn.assistant.googleWaiting);
      api.get.mockClear();
      await vi.advanceTimersByTimeAsync(9000);
      expect(api.get).not.toHaveBeenCalled();
    });

    it('catches up when the window gets the focus back, and stops listening when it goes', async () => {
      respond(none);
      const wrapper = await render();
      respond(linked);
      window.dispatchEvent(new Event('focus'));
      await flushPromises();
      expect(wrapper.text()).toContain('yo@gmail.com');
      wrapper.unmount();
      api.get.mockClear();
      window.dispatchEvent(new Event('focus'));
      expect(api.get).not.toHaveBeenCalled();
    });

    it('keeps waiting through a failed check', async () => {
      respond(none);
      const wrapper = await render();
      await button(wrapper, assistantEn.assistant.googleConnect).trigger('click');
      await flushPromises();
      api.get.mockRejectedValue(new Error('down'));
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
      expect(wrapper.text()).toContain(assistantEn.assistant.googleWaiting);
    });
  });

  it('saves what it loaded', async () => {
    respond({ configured: false, connected: false, email: null, accounts: [] });
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
    respond({ configured: false, connected: false, email: null, accounts: [] });
    api.put.mockRejectedValue(new Error('Invalid phone number'));
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.save).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Invalid phone number');
  });
});
