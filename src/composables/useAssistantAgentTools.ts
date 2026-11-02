import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useOutboundGate } from '@/composables/useOutboundGate';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { api } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Reminders, follow-ups and reports, and the user's own Gmail and Calendar.
 *
 * The kwami's mailbox and calendar stay where they are, with their own tools. These
 * reach the user's real account, so anything that speaks in their name -- an email,
 * an invitation -- goes through the same gate as a text message.
 */

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asList(value: unknown): string[] {
  return asText(value)
    .split(/[,;]\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function failure(error: unknown) {
  return { success: false, message: error instanceof Error ? error.message : String(error) };
}

export function useAssistantAgentTools() {
  const { t } = useI18n();
  const workspaceStore = useWorkspaceStore();
  const actionState = useAgentActionState();
  const gate = useOutboundGate();

  function kwamiId(): string {
    return workspaceStore.activeWorkspaceId;
  }

  function dialog(title: string, message: string) {
    return {
      title,
      message,
      confirmLabel: t('assistant.confirmSend'),
      cancelLabel: t('assistant.confirmCancel'),
    };
  }

  async function attempt<T>(run: () => Promise<T>): Promise<T | ReturnType<typeof failure>> {
    try {
      return await run();
    } catch (error) {
      return failure(error);
    }
  }

  // -- reminders and follow-ups -------------------------------------------------

  async function createReminder(args: Record<string, unknown>) {
    return attempt(async () => {
      const { task } = await api.post<{ task: Record<string, unknown> }>('/assistant/tasks', {
        kwami_id: kwamiId(),
        kind: 'reminder',
        title: asText(args.title),
        notes: asText(args.notes),
        run_at: asText(args.run_at) || null,
        recurrence: asText(args.recurrence) || null,
        weekdays: Array.isArray(args.weekdays) ? args.weekdays : null,
        local_time: asText(args.local_time) || null,
      });
      actionState.recordAction(t('assistant.actionReminder'), asText(args.title));
      return { success: true, id: task.id, next_run_at: task.next_run_at };
    });
  }

  async function scheduleWork(args: Record<string, unknown>) {
    return attempt(async () => {
      const { task } = await api.post<{ task: Record<string, unknown> }>('/assistant/tasks', {
        kwami_id: kwamiId(),
        kind: 'work',
        title: asText(args.title),
        notes: asText(args.instruction),
        run_at: asText(args.run_at) || null,
        recurrence: asText(args.recurrence) || null,
        weekdays: Array.isArray(args.weekdays) ? args.weekdays : null,
        local_time: asText(args.local_time) || null,
      });
      actionState.recordAction(t('assistant.actionWork'), asText(args.title));
      return { success: true, id: task.id, next_run_at: task.next_run_at };
    });
  }

  async function addFollowup(args: Record<string, unknown>) {
    return attempt(async () => {
      const { task } = await api.post<{ task: Record<string, unknown> }>('/assistant/tasks', {
        kwami_id: kwamiId(),
        kind: 'followup',
        title: asText(args.title),
        notes: asText(args.notes),
      });
      return { success: true, id: task.id };
    });
  }

  async function listTasks(args: Record<string, unknown>) {
    return attempt(async () => {
      const { tasks } = await api.get<{ tasks: Record<string, unknown>[] }>('/assistant/tasks', {
        query: { kwami_id: kwamiId(), status: asText(args.status) || 'open' },
      });
      return { success: true, tasks: tasks.filter((task) => task.kind !== 'report') };
    });
  }

  async function setTaskStatus(args: Record<string, unknown>, status: 'done' | 'cancelled') {
    return attempt(async () => {
      await api.patch(`/assistant/tasks/${encodeURIComponent(asText(args.id))}`, { status });
      return { success: true };
    });
  }

  async function readNotifications(args: Record<string, unknown>) {
    return attempt(async () => {
      const { notifications } = await api.get<{ notifications: Record<string, unknown>[] }>(
        '/assistant/notifications',
        { query: { kwami_id: kwamiId(), unread_only: args.unread_only !== false, limit: 10 } },
      );
      return { success: true, notifications };
    });
  }

  // -- Gmail --------------------------------------------------------------------

  async function listGmail(args: Record<string, unknown>) {
    return attempt(async () => {
      const { messages } = await api.get<{ messages: unknown[] }>('/google/gmail/messages', {
        query: { q: asText(args.query) || 'in:inbox', max_results: 10 },
      });
      return { success: true, messages };
    });
  }

  async function readGmail(args: Record<string, unknown>) {
    return attempt(async () => {
      const path = `/google/gmail/messages/${encodeURIComponent(asText(args.id))}`;
      const { message } = await api.get<{ message: unknown }>(path);
      return { success: true, message };
    });
  }

  async function sendGmail(args: Record<string, unknown>) {
    const to = asList(args.to);
    const body = asText(args.body);
    if (!to.length || !body) return { success: false, message: t('assistant.needRecipientBody') };
    const recipient = to.join(', ');
    const approved = await gate.allow({
      ...dialog(
        t('assistant.confirmGmailTitle'),
        t('assistant.confirmGmailBody', { recipient, subject: asText(args.subject), text: body }),
      ),
      channel: 'gmail',
      recipient,
      summary: asText(args.subject),
      expressOrder: args.express_order,
    });
    if (!approved) return { success: false, cancelled: true, sent: false };
    return attempt(async () => {
      await api.post('/google/gmail/send', {
        to,
        subject: asText(args.subject),
        body,
        reply_to_message_id: asText(args.reply_to_message_id) || null,
      });
      actionState.recordAction(t('assistant.actionGmail'), recipient, { announce: true });
      return { success: true, sent: true, recipient };
    });
  }

  async function archiveGmail(args: Record<string, unknown>) {
    return attempt(async () => {
      await api.post(`/google/gmail/messages/${encodeURIComponent(asText(args.id))}/archive`);
      return { success: true };
    });
  }

  // -- Google Calendar ----------------------------------------------------------

  async function listGoogleEvents(args: Record<string, unknown>) {
    return attempt(async () => {
      const { events } = await api.get<{ events: unknown[] }>('/google/calendar/events', {
        query: { range_start: asText(args.range_start), range_end: asText(args.range_end) },
      });
      return { success: true, events };
    });
  }

  /** Only an invitation leaves the app. An event for the user alone is theirs to undo. */
  async function inviteGate(args: Record<string, unknown>, attendees: string[]) {
    if (!attendees.length) return true;
    const recipient = attendees.join(', ');
    return gate.allow({
      ...dialog(
        t('assistant.confirmInviteTitle'),
        t('assistant.confirmInviteBody', { recipient, title: asText(args.title) }),
      ),
      channel: 'google_calendar',
      recipient,
      summary: asText(args.title),
      expressOrder: args.express_order,
    });
  }

  async function createGoogleEvent(args: Record<string, unknown>) {
    const attendees = asList(args.attendees);
    if (!(await inviteGate(args, attendees))) return { success: false, cancelled: true };
    return attempt(async () => {
      const { event } = await api.post<{ event: unknown }>('/google/calendar/events', {
        title: asText(args.title),
        starts_at: asText(args.starts_at),
        ends_at: asText(args.ends_at),
        description: asText(args.description) || null,
        location: asText(args.location) || null,
        attendees: attendees.length ? attendees : null,
      });
      return { success: true, event };
    });
  }

  async function updateGoogleEvent(args: Record<string, unknown>) {
    const attendees = asList(args.attendees);
    if (!(await inviteGate(args, attendees))) return { success: false, cancelled: true };
    return attempt(async () => {
      const { event } = await api.patch<{ event: unknown }>(
        `/google/calendar/events/${encodeURIComponent(asText(args.id))}`,
        {
          title: asText(args.title) || null,
          starts_at: asText(args.starts_at) || null,
          ends_at: asText(args.ends_at) || null,
          description: asText(args.description) || null,
          location: asText(args.location) || null,
          attendees: attendees.length ? attendees : null,
        },
      );
      return { success: true, event };
    });
  }

  async function deleteGoogleEvent(args: Record<string, unknown>) {
    const approved = await actionState.requestConfirmation(
      dialog(t('assistant.confirmDeleteEventTitle'), asText(args.title) || asText(args.id)),
    );
    if (!approved) return { success: false, cancelled: true };
    return attempt(async () => {
      await api.del(`/google/calendar/events/${encodeURIComponent(asText(args.id))}`);
      return { success: true };
    });
  }

  // -- registration -------------------------------------------------------------

  function registerAssistantTools(instance: Kwami) {
    instance.registerTool({
      name: 'create_reminder',
      description: t('assistant.tool.create_reminder'),
      parameters: {
        title: { type: 'string' },
        notes: { type: 'string' },
        run_at: { type: 'string' },
        recurrence: { type: 'string' },
        weekdays: { type: 'array' },
        local_time: { type: 'string' },
      },
      handler: async (args) => createReminder(args),
    });

    instance.registerTool({
      name: 'schedule_work',
      description: t('assistant.tool.schedule_work'),
      parameters: {
        title: { type: 'string' },
        instruction: { type: 'string' },
        run_at: { type: 'string' },
        recurrence: { type: 'string' },
        weekdays: { type: 'array' },
        local_time: { type: 'string' },
      },
      handler: async (args) => scheduleWork(args),
    });

    instance.registerTool({
      name: 'add_followup',
      description: t('assistant.tool.add_followup'),
      parameters: {
        title: { type: 'string' },
        notes: { type: 'string' },
      },
      handler: async (args) => addFollowup(args),
    });

    instance.registerTool({
      name: 'list_assistant_tasks',
      description: t('assistant.tool.list_assistant_tasks'),
      parameters: {
        status: { type: 'string' },
      },
      handler: async (args) => listTasks(args),
    });

    instance.registerTool({
      name: 'complete_assistant_task',
      description: t('assistant.tool.complete_assistant_task'),
      parameters: {
        id: { type: 'string' },
      },
      handler: async (args) => setTaskStatus(args, 'done'),
    });

    instance.registerTool({
      name: 'cancel_assistant_task',
      description: t('assistant.tool.cancel_assistant_task'),
      parameters: {
        id: { type: 'string' },
      },
      handler: async (args) => setTaskStatus(args, 'cancelled'),
    });

    instance.registerTool({
      name: 'read_assistant_notifications',
      description: t('assistant.tool.read_assistant_notifications'),
      parameters: {
        unread_only: { type: 'boolean' },
      },
      handler: async (args) => readNotifications(args),
    });

    instance.registerTool({
      name: 'list_gmail_messages',
      description: t('assistant.tool.list_gmail_messages'),
      parameters: {
        query: { type: 'string' },
      },
      handler: async (args) => listGmail(args),
    });

    instance.registerTool({
      name: 'read_gmail_message',
      description: t('assistant.tool.read_gmail_message'),
      parameters: {
        id: { type: 'string' },
      },
      handler: async (args) => readGmail(args),
    });

    instance.registerTool({
      name: 'send_gmail_message',
      description: t('assistant.tool.send_gmail_message'),
      parameters: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        reply_to_message_id: { type: 'string' },
        express_order: { type: 'string' },
      },
      handler: async (args) => sendGmail(args),
    });

    instance.registerTool({
      name: 'archive_gmail_message',
      description: t('assistant.tool.archive_gmail_message'),
      parameters: {
        id: { type: 'string' },
      },
      handler: async (args) => archiveGmail(args),
    });

    instance.registerTool({
      name: 'list_google_events',
      description: t('assistant.tool.list_google_events'),
      parameters: {
        range_start: { type: 'string' },
        range_end: { type: 'string' },
      },
      handler: async (args) => listGoogleEvents(args),
    });

    instance.registerTool({
      name: 'create_google_event',
      description: t('assistant.tool.create_google_event'),
      parameters: {
        title: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        attendees: { type: 'string' },
        express_order: { type: 'string' },
      },
      handler: async (args) => createGoogleEvent(args),
    });

    instance.registerTool({
      name: 'update_google_event',
      description: t('assistant.tool.update_google_event'),
      parameters: {
        id: { type: 'string' },
        title: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        attendees: { type: 'string' },
        express_order: { type: 'string' },
      },
      handler: async (args) => updateGoogleEvent(args),
    });

    instance.registerTool({
      name: 'delete_google_event',
      description: t('assistant.tool.delete_google_event'),
      parameters: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
      handler: async (args) => deleteGoogleEvent(args),
    });
  }

  return { registerAssistantTools };
}
