/**
 * Conversation history as the user sees it: one card per conversation, opened
 * into its transcript and Zep's summary -- not one undifferentiated stream.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import MemorySessions from '@/components/memory/MemorySessions.vue';
import { en } from '@/i18n/translations/en';
import { useMemoryStore } from '@/stores/memory';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

enableAutoUnmount(afterEach);

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

const session = {
  thread_id: 't-1',
  created_at: '2026-11-05T18:00:00Z',
  started_at: '2026-11-05T18:00:00Z',
  ended_at: '2026-11-05T18:25:00Z',
  message_count: 3,
  preview: 'Ponme una alarma para mañana',
  empty: false,
};

function render() {
  return mount(MemorySessions, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  api.get.mockReset();
  useAuthStore().user = { id: 'user-1' } as never;
  useWorkspaceStore().activeWorkspaceId = 'kwami-1';
});

describe('MemorySessions', () => {
  it('shows each conversation with when, how many messages, how long and how it opened', () => {
    useMemoryStore().sessions = [session];
    const text = render().text();

    expect(text).toContain('Ponme una alarma para mañana');
    expect(text).toContain('3 messages');
    expect(text).toContain('25 min');
  });

  it('opens a conversation into its summary and transcript, in spoken order', async () => {
    api.get.mockImplementation(async (path: string) =>
      path.endsWith('/summary')
        ? { summary: 'They set an alarm.' }
        : {
            messages: [
              { uuid: 'm-1', role: 'user', content: 'Ponme una alarma', name: null },
              { uuid: 'm-2', role: 'assistant', content: 'Hecho, señor', name: 'Jarvis' },
            ],
            total: 2,
            has_more: false,
          },
    );
    useMemoryStore().sessions = [session];
    const wrapper = render();

    await wrapper.get('button.session-head').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('They set an alarm.');
    const lines = wrapper.findAll('.line').map((l) => l.text());
    expect(lines[0]).toContain('You');
    expect(lines[0]).toContain('Ponme una alarma');
    expect(lines[1]).toContain('Jarvis');
    expect(wrapper.get('button.session-head').attributes('aria-expanded')).toBe('true');

    await wrapper.get('button.session-head').trigger('click');
    expect(wrapper.find('.transcript').exists()).toBe(false);
  });

  it('says so when a conversation cannot be read', async () => {
    api.get.mockRejectedValue(new Error('zep down'));
    useMemoryStore().sessions = [session];
    const wrapper = render();

    await wrapper.get('button.session-head').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Could not load this conversation: zep down');
  });

  it('offers older conversations while there are more', async () => {
    api.get.mockResolvedValue({ sessions: [], next_offset: null });
    const store = useMemoryStore();
    store.sessions = [session];
    store.sessionsNextOffset = 1;
    const wrapper = render();

    await wrapper.get('button.sessions-more').trigger('click');
    await flushPromises();

    expect(api.get.mock.calls[0]![1].query).toEqual({ limit: 20, offset: 1 });
    expect(wrapper.find('button.sessions-more').exists()).toBe(false);
  });

  it('has an empty state, a loading state and an error with a retry', async () => {
    const store = useMemoryStore();
    expect(render().text()).toContain('No conversation history');

    store.sessionsLoading = true;
    expect(render().text()).toContain('Loading conversations...');

    store.sessionsLoading = false;
    store.sessionsError = 'zep down';
    api.get.mockResolvedValue({ sessions: [session], next_offset: null });
    const wrapper = render();
    expect(wrapper.text()).toContain('Could not load conversations: zep down');
    await wrapper.get('button.sessions-link').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Ponme una alarma para mañana');
  });

  it('marks a conversation Zep could not describe', () => {
    useMemoryStore().sessions = [
      { ...session, unavailable: true, message_count: null, preview: null },
    ];
    const text = render().text();

    expect(text).toContain('Could not be read right now');
    expect(text).toContain('Nothing was said');
  });
});
