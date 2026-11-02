import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { useOutboundGate } from '@/composables/useOutboundGate';
import { api } from '@/lib/apiClient';

/**
 * The rest of the user's Google accounts: labels, drafts and filters in Gmail, Drive,
 * Docs, Sheets, Slides, Contacts and Tasks.
 *
 * One tool per product with an `action`, because every tool's description travels with
 * every request and a voice prompt has little room. The user decided the assistant works
 * here without asking, except for what speaks to someone else in their name: sharing a
 * file and sending a draft go through the outbound gate. Nothing here deletes for good,
 * because the API has no such call: what is removed goes to the bin.
 */

type Args = Record<string, unknown>;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asList(value: unknown): string[] {
  return asText(value)
    .split(/[,;]\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function segment(value: unknown): string {
  return encodeURIComponent(asText(value));
}

function options(args: Args, query: Record<string, string | number | boolean> = {}) {
  const account = asText(args.account);
  return { query: account ? { ...query, account } : query };
}

/** Rows arrive as an array, or as JSON text from a model that only passes strings. */
function asRows(value: unknown): unknown[][] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || !parsed.every(Array.isArray)) {
    throw new Error('values must be a list of rows');
  }
  return parsed as unknown[][];
}

function asObject(value: unknown): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected an object');
  }
  return parsed as Record<string, unknown>;
}

export function useGoogleWorkspaceAgentTools() {
  const { t } = useI18n();
  const actionState = useAgentActionState();
  const gate = useOutboundGate();

  async function run(
    args: Args,
    actions: Record<string, () => Promise<Record<string, unknown>>>,
  ): Promise<Record<string, unknown>> {
    const action = actions[asText(args.action)];
    if (!action) {
      return {
        success: false,
        message: `Unknown action. Use one of: ${Object.keys(actions).join(', ')}`,
      };
    }
    try {
      return { success: true, ...(await action()) };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  function outbound(
    args: Args,
    title: string,
    message: string,
    recipient: string,
    summary: string,
  ) {
    return gate.allow({
      title,
      message,
      confirmLabel: t('assistant.confirmSend'),
      cancelLabel: t('assistant.confirmCancel'),
      channel: 'google',
      recipient,
      summary,
      expressOrder: args.express_order,
    });
  }

  function message(args: Args) {
    return {
      to: asList(args.to),
      cc: asList(args.cc),
      subject: asText(args.subject),
      body: asText(args.body),
      reply_to_message_id: asText(args.reply_to_message_id) || null,
      attachment_file_ids: asList(args.attachment_file_ids),
    };
  }

  function gmail(args: Args) {
    const id = segment(args.id);
    const base = '/google/gmail';
    return run(args, {
      labels: () => api.get(`${base}/labels`, options(args)),
      create_label: () => api.post(`${base}/labels`, { name: asText(args.name) }, options(args)),
      label: () =>
        api.post(
          `${base}/messages/${id}/labels`,
          { add: asList(args.add), remove: asList(args.remove) },
          options(args),
        ),
      trash: () => api.post(`${base}/messages/${id}/trash`, undefined, options(args)),
      untrash: () => api.post(`${base}/messages/${id}/untrash`, undefined, options(args)),
      attachment: () =>
        api.get(`${base}/messages/${id}/attachments/${segment(args.attachment_id)}`, options(args)),
      save_attachment: () =>
        api.post(
          `${base}/messages/${id}/attachments/${segment(args.attachment_id)}/save`,
          {
            filename: asText(args.name),
            mime_type: asText(args.mime_type) || 'application/octet-stream',
            parent_id: asText(args.parent_id) || null,
          },
          options(args),
        ),
      drafts: () => api.get(`${base}/drafts`, options(args)),
      draft: () => api.post(`${base}/drafts`, message(args), options(args)),
      send_draft: async () => {
        const recipient = asText(args.to) || t('assistant.draftRecipient');
        const approved = await outbound(
          args,
          t('assistant.confirmGmailTitle'),
          t('assistant.confirmDraftBody', { recipient }),
          recipient,
          asText(args.subject),
        );
        if (!approved) return { success: false, cancelled: true, sent: false };
        const sent = await api.post<Record<string, unknown>>(
          `${base}/drafts/${id}/send`,
          undefined,
          options(args),
        );
        actionState.recordAction(t('assistant.actionGmail'), recipient, { announce: true });
        return { ...sent, sent: true };
      },
      filters: () => api.get(`${base}/filters`, options(args)),
      create_filter: () =>
        api.post(
          `${base}/filters`,
          { criteria: asObject(args.criteria), action: asObject(args.filter_action) },
          options(args),
        ),
      delete_filter: () => api.del(`${base}/filters/${id}`, options(args)),
    });
  }

  function drive(args: Args) {
    const id = segment(args.id);
    const base = '/google/drive';
    return run(args, {
      search: () => api.get(`${base}/files`, options(args, { q: asText(args.query) })),
      read: () => api.get(`${base}/files/${id}`, options(args)),
      create: () =>
        api.post(
          `${base}/files`,
          {
            name: asText(args.name),
            content: typeof args.content === 'string' ? args.content : '',
            mime_type: asText(args.mime_type) || 'text/plain',
            parent_id: asText(args.parent_id) || null,
          },
          options(args),
        ),
      write: () =>
        api.put(
          `${base}/files/${id}/content`,
          {
            content: typeof args.content === 'string' ? args.content : '',
            mime_type: asText(args.mime_type) || 'text/plain',
          },
          options(args),
        ),
      folder: () =>
        api.post(
          `${base}/folders`,
          { name: asText(args.name), parent_id: asText(args.parent_id) || null },
          options(args),
        ),
      rename: () => api.patch(`${base}/files/${id}`, { name: asText(args.name) }, options(args)),
      move: () =>
        api.patch(
          `${base}/files/${id}`,
          {
            add_parent: asText(args.parent_id) || null,
            remove_parent: asText(args.from_parent_id) || null,
          },
          options(args),
        ),
      copy: () =>
        api.post(`${base}/files/${id}/copy`, { name: asText(args.name) || null }, options(args)),
      trash: () => api.post(`${base}/files/${id}/trash`, undefined, options(args)),
      untrash: () => api.post(`${base}/files/${id}/untrash`, undefined, options(args)),
      permissions: () => api.get(`${base}/files/${id}/permissions`, options(args)),
      share: async () => {
        const email = asText(args.email);
        const name = asText(args.name) || asText(args.id);
        const approved = await outbound(
          args,
          t('assistant.confirmShareTitle'),
          t('assistant.confirmShareBody', { recipient: email, name }),
          email,
          name,
        );
        if (!approved) return { success: false, cancelled: true };
        const shared = await api.post<Record<string, unknown>>(
          `${base}/files/${id}/permissions`,
          { email, role: asText(args.role) || 'reader' },
          options(args),
        );
        actionState.recordAction(t('assistant.actionShare'), email, { announce: true });
        return shared;
      },
      unshare: () =>
        api.del(`${base}/files/${id}/permissions/${segment(args.permission_id)}`, options(args)),
    });
  }

  function docs(args: Args) {
    const id = segment(args.id);
    return run(args, {
      create: () =>
        api.post(
          '/google/docs',
          { title: asText(args.title), text: typeof args.text === 'string' ? args.text : '' },
          options(args),
        ),
      append: () => api.post(`/google/docs/${id}/append`, { text: args.text }, options(args)),
      replace: () =>
        api.post(
          `/google/docs/${id}/replace`,
          { find: args.find, replace: args.replace },
          options(args),
        ),
    });
  }

  function sheets(args: Args) {
    const id = segment(args.id);
    const values = `/google/sheets/${id}/values`;
    const range = asText(args.range);
    return run(args, {
      create: () => api.post('/google/sheets', { title: asText(args.title) }, options(args)),
      read: () => api.get(values, options(args, { range })),
      write: () => api.put(values, { range, values: asRows(args.values) }, options(args)),
      append: () => api.post(values, { range, values: asRows(args.values) }, options(args)),
    });
  }

  function slides(args: Args) {
    return run(args, {
      create: () => api.post('/google/slides', { title: asText(args.title) }, options(args)),
      add_slide: () =>
        api.post(
          `/google/slides/${segment(args.id)}/slides`,
          { title: asText(args.title), body: asText(args.body) },
          options(args),
        ),
    });
  }

  function contact(args: Args) {
    return {
      name: asText(args.name) || null,
      email: asText(args.email) || null,
      phone: asText(args.phone) || null,
      organization: asText(args.organization) || null,
    };
  }

  function contacts(args: Args) {
    return run(args, {
      search: () => api.get('/google/contacts', options(args, { q: asText(args.query) })),
      create: () => api.post('/google/contacts', contact(args), options(args)),
      // The id is `people/c123`, whose slash is part of the path.
      update: () => api.patch(`/google/contacts/${asText(args.id)}`, contact(args), options(args)),
    });
  }

  function tasks(args: Args) {
    const task_list = asText(args.task_list) || '@default';
    return run(args, {
      lists: () => api.get('/google/tasks/lists', options(args)),
      list: () =>
        api.get('/google/tasks', options(args, { task_list, show_done: args.show_done === true })),
      create: () =>
        api.post(
          '/google/tasks',
          {
            title: asText(args.title),
            notes: asText(args.notes) || null,
            due: asText(args.due) || null,
            task_list,
          },
          options(args),
        ),
      update: () =>
        api.patch(
          `/google/tasks/${segment(args.id)}`,
          {
            title: asText(args.title) || null,
            notes: asText(args.notes) || null,
            due: asText(args.due) || null,
            done: typeof args.done === 'boolean' ? args.done : null,
            task_list,
          },
          options(args),
        ),
    });
  }

  async function accounts() {
    try {
      const status = await api.get<{ accounts: unknown[] }>('/google/status');
      return { success: true, accounts: status.accounts };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  function registerGoogleWorkspaceTools(instance: Kwami) {
    const text = { type: 'string' } as const;
    const common = { action: text, id: text, account: text };

    instance.registerTool({
      name: 'list_google_accounts',
      description: t('assistant.tool.list_google_accounts'),
      parameters: {},
      handler: async () => accounts(),
    });
    instance.registerTool({
      name: 'manage_gmail',
      description: t('assistant.tool.manage_gmail'),
      parameters: {
        ...common,
        name: text,
        add: text,
        remove: text,
        attachment_id: text,
        mime_type: text,
        parent_id: text,
        attachment_file_ids: text,
        to: text,
        cc: text,
        subject: text,
        body: text,
        reply_to_message_id: text,
        criteria: text,
        filter_action: text,
        express_order: text,
      },
      handler: async (args) => gmail(args),
    });
    instance.registerTool({
      name: 'manage_google_drive',
      description: t('assistant.tool.manage_google_drive'),
      parameters: {
        ...common,
        query: text,
        name: text,
        content: text,
        mime_type: text,
        parent_id: text,
        from_parent_id: text,
        email: text,
        role: text,
        permission_id: text,
        express_order: text,
      },
      handler: async (args) => drive(args),
    });
    instance.registerTool({
      name: 'manage_google_docs',
      description: t('assistant.tool.manage_google_docs'),
      parameters: { ...common, title: text, text, find: text, replace: text },
      handler: async (args) => docs(args),
    });
    instance.registerTool({
      name: 'manage_google_sheets',
      description: t('assistant.tool.manage_google_sheets'),
      parameters: { ...common, title: text, range: text, values: text },
      handler: async (args) => sheets(args),
    });
    instance.registerTool({
      name: 'manage_google_slides',
      description: t('assistant.tool.manage_google_slides'),
      parameters: { ...common, title: text, body: text },
      handler: async (args) => slides(args),
    });
    instance.registerTool({
      name: 'manage_google_contacts',
      description: t('assistant.tool.manage_google_contacts'),
      parameters: {
        ...common,
        query: text,
        name: text,
        email: text,
        phone: text,
        organization: text,
      },
      handler: async (args) => contacts(args),
    });
    instance.registerTool({
      name: 'manage_google_tasks',
      description: t('assistant.tool.manage_google_tasks'),
      parameters: {
        ...common,
        task_list: text,
        title: text,
        notes: text,
        due: text,
        done: { type: 'boolean' },
        show_done: { type: 'boolean' },
      },
      handler: async (args) => tasks(args),
    });
  }

  return { registerGoogleWorkspaceTools };
}
