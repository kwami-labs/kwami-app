/**
 * Reminders and the user's real Google account. What matters: a declined dialog
 * sends nothing, a waived one leaves a record, and a tool passing `confirm: true`
 * gets nowhere.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useAssistantAgentTools } from '@/composables/useAssistantAgentTools';
import { resetOutboundGate } from '@/composables/useOutboundGate';
import { assistantEn } from '@/i18n/assistant.locale';
import { useWorkspaceStore } from '@/stores/workspace';

type Handler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

const registered = new Map<string, { description: string; handler: Handler }>();
const approve = { value: true };
const confirmations: { title: string }[] = [];
const live = ref<{ role: string; content: string; timestamp: number }[]>([]);

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    requestConfirmation: vi.fn(async (options: { title: string }) => {
      confirmations.push(options);
      return approve.value;
    }),
  }),
}));

vi.mock('@/composables/useTranscriptionState', () => ({
  useTranscriptionState: () => ({ liveMessages: live }),
}));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

function tool(name: string): Handler {
  const entry = registered.get(name);
  if (!entry) throw new Error(`${name} is not registered`);
  return entry.handler;
}

function sentCalls() {
  return api.post.mock.calls.filter(([path]) => path === '/google/gmail/send');
}

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  live.value = [];
  vi.clearAllMocks();
  api.post.mockResolvedValue({ task: { id: 't1' }, event: { id: 'e1' } });
  api.patch.mockResolvedValue({ event: { id: 'e1' } });
  api.del.mockResolvedValue({ ok: true });
  resetOutboundGate();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
  const Host = defineComponent({
    setup() {
      const { registerAssistantTools } = useAssistantAgentTools();
      registerAssistantTools({
        registerTool: (def: { name: string; description: string; handler: Handler }) =>
          registered.set(def.name, def),
      } as never);
      return () => h('div');
    },
  });
  mount(Host, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: assistantEn } })],
    },
  });
});

describe('registration', () => {
  it('gives every tool a real description', () => {
    expect(registered.size).toBe(15);
    for (const [name, def] of registered) {
      expect(def.description).not.toContain('assistant.tool');
      expect(def.description, name).toBeTruthy();
    }
  });
});

describe('reminders and follow-ups', () => {
  it('creates a reminder on the active kwami', async () => {
    const result = await tool('create_reminder')({ title: 'Llamar', run_at: '2026-11-03T09:00' });
    expect(result.success).toBe(true);
    expect(api.post).toHaveBeenCalledWith(
      '/assistant/tasks',
      expect.objectContaining({ kwami_id: 'k1', kind: 'reminder', title: 'Llamar' }),
    );
  });

  it('passes a repeating rule through', async () => {
    await tool('create_reminder')({
      title: 'Cartera',
      recurrence: 'weekly',
      weekdays: [2],
      local_time: '09:30',
    });
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({
      recurrence: 'weekly',
      weekdays: [2],
      local_time: '09:30',
    });
  });

  it('schedules work with its instruction', async () => {
    const result = await tool('schedule_work')({
      title: 'Mercados',
      instruction: 'Resume mis posiciones',
      recurrence: 'daily',
      local_time: '08:00',
    });
    expect(result.success).toBe(true);
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({
      kind: 'work',
      notes: 'Resume mis posiciones',
      recurrence: 'daily',
      local_time: '08:00',
    });
  });

  it('adds a follow-up with no time', async () => {
    await tool('add_followup')({ title: 'Reforma' });
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({ kind: 'followup' });
  });

  it('hides the reports from the list', async () => {
    api.get.mockResolvedValue({
      tasks: [
        { id: '1', kind: 'report' },
        { id: '2', kind: 'followup' },
      ],
    });
    const result = await tool('list_assistant_tasks')({});
    expect(result.tasks).toEqual([{ id: '2', kind: 'followup' }]);
  });

  it('closes and cancels', async () => {
    await tool('complete_assistant_task')({ id: 'a' });
    await tool('cancel_assistant_task')({ id: 'b' });
    expect(api.patch).toHaveBeenCalledWith('/assistant/tasks/a', { status: 'done' });
    expect(api.patch).toHaveBeenCalledWith('/assistant/tasks/b', { status: 'cancelled' });
  });

  it('reads notifications, unread by default', async () => {
    api.get.mockResolvedValue({ notifications: [] });
    await tool('read_assistant_notifications')({});
    expect(api.get.mock.calls[0]?.[1].query.unread_only).toBe(true);
  });

  it('reports a failure instead of claiming success', async () => {
    api.post.mockRejectedValue(new Error('A reminder needs a time'));
    const result = await tool('create_reminder')({ title: 'X' });
    expect(result).toEqual({ success: false, message: 'A reminder needs a time' });
  });
});

describe('sending from Gmail', () => {
  const args = { to: 'a@b.c, d@e.f', subject: 'Hola', body: 'Texto' };

  it('asks first and sends on yes', async () => {
    const result = await tool('send_gmail_message')(args);
    expect(confirmations).toHaveLength(1);
    expect(result.sent).toBe(true);
    expect(sentCalls()[0]?.[1]).toMatchObject({ to: ['a@b.c', 'd@e.f'] });
  });

  it('sends nothing on no', async () => {
    approve.value = false;
    const result = await tool('send_gmail_message')(args);
    expect(result.cancelled).toBe(true);
    expect(sentCalls()).toHaveLength(0);
  });

  it('is not fooled by confirm: true', async () => {
    approve.value = false;
    await tool('send_gmail_message')({ ...args, confirm: true });
    expect(confirmations).toHaveLength(1);
    expect(sentCalls()).toHaveLength(0);
  });

  it('skips the dialog on an express order, and records it first', async () => {
    live.value = [{ role: 'user', content: 'Envíaselo sin revisar', timestamp: Date.now() }];
    const result = await tool('send_gmail_message')({ ...args, express_order: 'sin revisar' });
    expect(confirmations).toHaveLength(0);
    expect(result.sent).toBe(true);
    expect(api.post.mock.calls[0]?.[0]).toBe('/assistant/express-sends');
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({
      channel: 'gmail',
      express_order: 'sin revisar',
    });
  });

  it('asks again for the next message of the same order', async () => {
    live.value = [{ role: 'user', content: 'Envíaselo sin revisar', timestamp: Date.now() }];
    await tool('send_gmail_message')({ ...args, express_order: 'sin revisar' });
    await tool('send_gmail_message')({ ...args, express_order: 'sin revisar' });
    expect(confirmations).toHaveLength(1);
  });

  it('asks when the quote is not what the user said', async () => {
    live.value = [{ role: 'user', content: 'Léeme el correo', timestamp: Date.now() }];
    await tool('send_gmail_message')({ ...args, express_order: 'sin revisar' });
    expect(confirmations).toHaveLength(1);
  });

  it('falls back to the dialog when the record cannot be written', async () => {
    live.value = [{ role: 'user', content: 'sin revisar', timestamp: Date.now() }];
    api.post.mockRejectedValueOnce(new Error('down'));
    await tool('send_gmail_message')({ ...args, express_order: 'sin revisar' });
    expect(confirmations).toHaveLength(1);
  });

  it('needs a recipient and a body', async () => {
    expect((await tool('send_gmail_message')({ to: '', body: 'x' })).success).toBe(false);
    expect((await tool('send_gmail_message')({ to: 'a@b.c' })).success).toBe(false);
    expect(confirmations).toHaveLength(0);
  });

  it('reads and archives without asking', async () => {
    api.get.mockResolvedValue({ messages: [], message: { id: 'm1' } });
    await tool('list_gmail_messages')({});
    expect(api.get.mock.calls[0]?.[1].query.q).toBe('in:inbox');
    expect((await tool('read_gmail_message')({ id: 'm1' })).message).toEqual({ id: 'm1' });
    await tool('archive_gmail_message')({ id: 'm1' });
    expect(api.post).toHaveBeenCalledWith('/google/gmail/messages/m1/archive');
    expect(confirmations).toHaveLength(0);
  });
});

describe('Google Calendar', () => {
  const event = { title: 'R', starts_at: 'a', ends_at: 'b' };

  it('an event for the user alone needs no dialog', async () => {
    await tool('create_google_event')(event);
    expect(confirmations).toHaveLength(0);
    expect(api.post).toHaveBeenCalledWith(
      '/google/calendar/events',
      expect.objectContaining({ attendees: null }),
    );
  });

  it('an invitation asks first, and a no creates nothing', async () => {
    approve.value = false;
    const result = await tool('create_google_event')({ ...event, attendees: 'a@b.c' });
    expect(confirmations).toHaveLength(1);
    expect(result.cancelled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('updating with new attendees asks first', async () => {
    approve.value = false;
    await tool('update_google_event')({ id: 'e1', attendees: 'a@b.c' });
    expect(api.patch).not.toHaveBeenCalled();
    approve.value = true;
    await tool('update_google_event')({ id: 'e1', title: 'N' });
    expect(api.patch).toHaveBeenCalledWith(
      '/google/calendar/events/e1',
      expect.objectContaining({ title: 'N', attendees: null }),
    );
  });

  it('deleting always asks', async () => {
    approve.value = false;
    expect((await tool('delete_google_event')({ id: 'e1' })).cancelled).toBe(true);
    expect(api.del).not.toHaveBeenCalled();
    approve.value = true;
    await tool('delete_google_event')({ id: 'e1', title: 'R' });
    expect(api.del).toHaveBeenCalledWith('/google/calendar/events/e1');
  });

  it('lists a range', async () => {
    api.get.mockResolvedValue({ events: [] });
    await tool('list_google_events')({ range_start: 'a', range_end: 'b' });
    expect(api.get.mock.calls[0]?.[1].query).toEqual({ range_start: 'a', range_end: 'b' });
  });
});
