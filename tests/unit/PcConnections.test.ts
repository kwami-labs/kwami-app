/** Signing the PC in from the app: what it shows, and what it asks the PC to do. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import PcConnections from '@/components/panels/settings/communications/PcConnections.vue';
import { assistantEn } from '@/i18n/assistant.locale';
import { useWorkspaceStore } from '@/stores/workspace';

enableAutoUnmount(afterEach);

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

function respond(
  status: Record<string, boolean>,
  order = { status: 'done', result: 'Hecho' },
  sites: Record<string, string>[] = [],
) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/pc/status') return status;
    return path === '/pc/sites' ? { sites } : order;
  });
  api.post.mockResolvedValue({ id: 'o1' });
  api.del.mockResolvedValue(undefined);
}

async function render() {
  const wrapper = mount(PcConnections, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: assistantEn } })],
      stubs: {
        PanelSection: { template: '<section><slot /></section>' },
        BaseButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        BaseInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
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
  vi.useFakeTimers();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PcConnections', () => {
  it('offers nothing while the PC is away', async () => {
    respond({ online: false, claude_login: false });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcOffline);
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('says so when the status cannot be read', async () => {
    api.get.mockRejectedValue(new Error('down'));
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcOffline);
  });

  it('opens Claude sign-in and shows how it ended', async () => {
    respond({ online: true, claude_login: true });
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcClaudeChange).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/pc/claude', { kwami_id: 'k1' });
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();
    expect(wrapper.text()).toContain('Hecho');
  });

  it('offers to connect when Claude is not signed in', async () => {
    respond({ online: true, claude_login: false });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcClaudeMissing);
    expect(button(wrapper, assistantEn.assistant.pcClaudeConnect).exists()).toBe(true);
  });

  it('opens the site that was typed, and nothing without one', async () => {
    respond({ online: true, claude_login: true });
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcSiteOpen).trigger('click');
    expect(api.post).not.toHaveBeenCalled();
    await wrapper.find('input').setValue(' github.com ');
    await button(wrapper, assistantEn.assistant.pcSiteOpen).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/pc/sites', { kwami_id: 'k1', address: 'github.com' });
  });

  it('says when the order could not be sent', async () => {
    respond({ online: true, claude_login: true });
    api.post.mockRejectedValue(new Error('409'));
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcClaudeChange).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcFailed);
  });

  it('keeps looking through a blip while the window is open, and gives up in the end', async () => {
    respond({ online: true, claude_login: true }, { status: 'running', result: '' });
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcClaudeChange).trigger('click');
    await flushPromises();
    api.get.mockRejectedValueOnce(new Error('blip'));
    await vi.advanceTimersByTimeAsync(4000);
    expect(wrapper.text()).toContain(assistantEn.assistant.pcClaudeWaiting);
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000 + 4000);
    await flushPromises();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcFailed);
  });

  it('lists each site with how it stands and opens the ones that need it', async () => {
    respond({ online: true, claude_login: true }, undefined, [
      { host: 'github.com', url: 'https://github.com/settings/profile', state: 'connected' },
      { host: 'a.b', url: 'https://a.b/', state: 'signed_out' },
    ]);
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcState.connected);
    expect(wrapper.text()).toContain(assistantEn.assistant.pcState.signed_out);
    const open = wrapper
      .findAll('button')
      .filter((b) => b.text() === assistantEn.assistant.pcSiteOpen);
    await open[0].trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/pc/sites', { kwami_id: 'k1', address: 'https://a.b/' });
  });

  it('suggests only the sites not on the list yet', async () => {
    respond({ online: true, claude_login: true }, undefined, [
      { host: 'github.com', url: 'https://github.com/settings/profile', state: 'connected' },
    ]);
    const wrapper = await render();
    expect(wrapper.findAll('button').some((b) => b.text() === 'GitHub')).toBe(false);
    await button(wrapper, 'Gmail').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/pc/sites', {
      kwami_id: 'k1',
      address: 'https://mail.google.com/mail/u/0/',
    });
  });

  it('takes a site off the list, and says when it could not', async () => {
    respond({ online: true, claude_login: true }, undefined, [
      { host: 'a.b', url: 'https://a.b/', state: 'refused' },
    ]);
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcSiteForget).trigger('click');
    await flushPromises();
    expect(api.del).toHaveBeenCalledWith('/pc/sites/a.b');
    api.del.mockRejectedValue(new Error('down'));
    await button(wrapper, assistantEn.assistant.pcSiteForget).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcFailed);
  });

  it('still offers Claude when only the list of sites cannot be read', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path === '/pc/sites') throw new Error('missing');
      return { online: true, claude_login: true };
    });
    const wrapper = await render();
    expect(wrapper.text()).toContain(assistantEn.assistant.pcClaudeReady);
  });

  it('does nothing without a kwami', async () => {
    respond({ online: true, claude_login: true });
    useWorkspaceStore().activeWorkspaceId = null;
    const wrapper = await render();
    await button(wrapper, assistantEn.assistant.pcClaudeChange).trigger('click');
    expect(api.post).not.toHaveBeenCalled();
  });
});
