/**
 * Google beyond reading and sending. What matters: the work needs no dialog, what speaks
 * to someone else does, and the account named is the one the call goes to.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useGoogleWorkspaceAgentTools } from '@/composables/useGoogleWorkspaceAgentTools';
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
  put: vi.fn(),
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

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  live.value = [];
  vi.clearAllMocks();
  for (const method of Object.values(api)) method.mockResolvedValue({ ok: true });
  resetOutboundGate();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
  const Host = defineComponent({
    setup() {
      const { registerGoogleWorkspaceTools } = useGoogleWorkspaceAgentTools();
      registerGoogleWorkspaceTools({
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
    expect(registered.size).toBe(8);
    for (const [name, def] of registered) {
      expect(def.description, name).toBeTruthy();
      expect(def.description).not.toContain('assistant.tool');
      // vue-i18n reads these as its own syntax.
      expect(def.description, name).not.toMatch(/[{}|]/);
    }
  });

  it('lists the linked accounts', async () => {
    api.get.mockResolvedValue({ accounts: [{ email: 'a@b.c' }] });
    expect((await tool('list_google_accounts')({})).accounts).toEqual([{ email: 'a@b.c' }]);
    api.get.mockRejectedValue(new Error('down'));
    expect(await tool('list_google_accounts')({})).toEqual({ success: false, message: 'down' });
  });
});

describe('actions', () => {
  it('names the choices when the action is unknown', async () => {
    const answer = await tool('manage_google_docs')({ action: 'erase' });
    expect(answer.success).toBe(false);
    expect(answer.message).toContain('create, append, replace');
  });

  it('turns a failed call into an answer', async () => {
    api.get.mockRejectedValue(new Error('nope'));
    const answer = await tool('manage_google_drive')({ action: 'search' });
    expect(answer).toEqual({ success: false, message: 'nope' });
    api.get.mockRejectedValue('text');
    expect((await tool('manage_google_drive')({ action: 'search' })).message).toBe('text');
  });

  it('sends the call to the account it names, and to no account otherwise', async () => {
    await tool('manage_google_drive')({ action: 'search', query: 'q', account: 'a@b.c' });
    expect(api.get).toHaveBeenLastCalledWith('/google/drive/files', {
      query: { q: 'q', account: 'a@b.c' },
    });
    await tool('manage_google_drive')({ action: 'search', query: 'q' });
    expect(api.get).toHaveBeenLastCalledWith('/google/drive/files', { query: { q: 'q' } });
  });
});

describe('work that needs no dialog', () => {
  const cases: [
    string,
    Record<string, unknown>,
    'get' | 'post' | 'put' | 'patch' | 'del',
    string,
  ][] = [
    ['manage_gmail', { action: 'labels' }, 'get', '/google/gmail/labels'],
    ['manage_gmail', { action: 'create_label', name: 'n' }, 'post', '/google/gmail/labels'],
    [
      'manage_gmail',
      { action: 'label', id: 'm', add: 'A,B' },
      'post',
      '/google/gmail/messages/m/labels',
    ],
    ['manage_gmail', { action: 'trash', id: 'm' }, 'post', '/google/gmail/messages/m/trash'],
    ['manage_gmail', { action: 'untrash', id: 'm' }, 'post', '/google/gmail/messages/m/untrash'],
    [
      'manage_gmail',
      { action: 'attachment', id: 'm', attachment_id: 'a' },
      'get',
      '/google/gmail/messages/m/attachments/a',
    ],
    ['manage_gmail', { action: 'drafts' }, 'get', '/google/gmail/drafts'],
    ['manage_gmail', { action: 'draft', to: 'a@b.c', body: 'b' }, 'post', '/google/gmail/drafts'],
    ['manage_gmail', { action: 'filters' }, 'get', '/google/gmail/filters'],
    ['manage_gmail', { action: 'delete_filter', id: 'f' }, 'del', '/google/gmail/filters/f'],
    ['manage_google_drive', { action: 'read', id: 'f' }, 'get', '/google/drive/files/f'],
    [
      'manage_google_drive',
      { action: 'create', name: 'n', content: 'c' },
      'post',
      '/google/drive/files',
    ],
    ['manage_google_drive', { action: 'create', name: 'n' }, 'post', '/google/drive/files'],
    [
      'manage_google_drive',
      { action: 'write', id: 'f', content: 'c' },
      'put',
      '/google/drive/files/f/content',
    ],
    ['manage_google_drive', { action: 'write', id: 'f' }, 'put', '/google/drive/files/f/content'],
    ['manage_google_drive', { action: 'folder', name: 'n' }, 'post', '/google/drive/folders'],
    [
      'manage_google_drive',
      { action: 'rename', id: 'f', name: 'n' },
      'patch',
      '/google/drive/files/f',
    ],
    [
      'manage_google_drive',
      { action: 'move', id: 'f', parent_id: 'p' },
      'patch',
      '/google/drive/files/f',
    ],
    ['manage_google_drive', { action: 'copy', id: 'f' }, 'post', '/google/drive/files/f/copy'],
    ['manage_google_drive', { action: 'trash', id: 'f' }, 'post', '/google/drive/files/f/trash'],
    [
      'manage_google_drive',
      { action: 'untrash', id: 'f' },
      'post',
      '/google/drive/files/f/untrash',
    ],
    [
      'manage_google_drive',
      { action: 'permissions', id: 'f' },
      'get',
      '/google/drive/files/f/permissions',
    ],
    [
      'manage_google_drive',
      { action: 'unshare', id: 'f', permission_id: 'p' },
      'del',
      '/google/drive/files/f/permissions/p',
    ],
    ['manage_google_docs', { action: 'create', title: 't', text: 'x' }, 'post', '/google/docs'],
    ['manage_google_docs', { action: 'create', title: 't' }, 'post', '/google/docs'],
    [
      'manage_google_docs',
      { action: 'append', id: 'd', text: 'x' },
      'post',
      '/google/docs/d/append',
    ],
    [
      'manage_google_docs',
      { action: 'replace', id: 'd', find: 'a', replace: 'b' },
      'post',
      '/google/docs/d/replace',
    ],
    ['manage_google_sheets', { action: 'create', title: 't' }, 'post', '/google/sheets'],
    [
      'manage_google_sheets',
      { action: 'read', id: 's', range: 'A1' },
      'get',
      '/google/sheets/s/values',
    ],
    ['manage_google_slides', { action: 'create', title: 't' }, 'post', '/google/slides'],
    [
      'manage_google_slides',
      { action: 'add_slide', id: 'p', title: 't' },
      'post',
      '/google/slides/p/slides',
    ],
    ['manage_google_contacts', { action: 'search', query: 'a' }, 'get', '/google/contacts'],
    ['manage_google_contacts', { action: 'create', name: 'n' }, 'post', '/google/contacts'],
    [
      'manage_google_contacts',
      { action: 'update', id: 'people/c1', phone: '1' },
      'patch',
      '/google/contacts/people/c1',
    ],
    ['manage_google_tasks', { action: 'lists' }, 'get', '/google/tasks/lists'],
    ['manage_google_tasks', { action: 'list' }, 'get', '/google/tasks'],
    ['manage_google_tasks', { action: 'create', title: 't' }, 'post', '/google/tasks'],
    ['manage_google_tasks', { action: 'update', id: 't', done: true }, 'patch', '/google/tasks/t'],
    [
      'manage_google_tasks',
      { action: 'update', id: 't', task_list: 'l' },
      'patch',
      '/google/tasks/t',
    ],
  ];

  it.each(cases)('%s %j', async (name, args, method, path) => {
    const answer = await tool(name)(args);
    expect(answer.success, JSON.stringify(answer)).toBe(true);
    expect(api[method].mock.calls[0]?.[0]).toBe(path);
    expect(confirmations).toHaveLength(0);
  });

  it('takes rows as JSON text or as a list', async () => {
    const values = [['=1+1', 2]];
    await tool('manage_google_sheets')({
      action: 'write',
      id: 's',
      range: 'A1',
      values: JSON.stringify(values),
    });
    expect(api.put.mock.calls[0]?.[1]).toEqual({ range: 'A1', values });
    await tool('manage_google_sheets')({ action: 'append', id: 's', range: 'A1', values });
    expect(api.post.mock.calls[0]?.[1]).toEqual({ range: 'A1', values });
    const bad = await tool('manage_google_sheets')({ action: 'write', id: 's', values: '[1]' });
    expect(bad.message).toContain('rows');
  });

  it('takes a filter as JSON text or as an object', async () => {
    await tool('manage_gmail')({
      action: 'create_filter',
      criteria: '{"from":"a@b.c"}',
      filter_action: { addLabelIds: ['L'] },
    });
    expect(api.post.mock.calls[0]?.[1]).toEqual({
      criteria: { from: 'a@b.c' },
      action: { addLabelIds: ['L'] },
    });
    const bad = await tool('manage_gmail')({ action: 'create_filter', criteria: '[]' });
    expect(bad.message).toContain('object');
  });
});

describe('attachments', () => {
  it('a draft carries Drive files', async () => {
    await tool('manage_gmail')({ action: 'draft', to: 'a@b.c', attachment_file_ids: 'f1, f2' });
    expect(api.post.mock.calls[0]?.[1].attachment_file_ids).toEqual(['f1', 'f2']);
  });

  it('an attachment can be saved to Drive', async () => {
    await tool('manage_gmail')({
      action: 'save_attachment',
      id: 'm',
      attachment_id: 'a',
      name: 'f.pdf',
      mime_type: 'application/pdf',
    });
    expect(api.post.mock.calls[0]?.[0]).toBe('/google/gmail/messages/m/attachments/a/save');
    expect(api.post.mock.calls[0]?.[1]).toEqual({
      filename: 'f.pdf',
      mime_type: 'application/pdf',
      parent_id: null,
    });
    expect(confirmations).toHaveLength(0);
    await tool('manage_gmail')({ action: 'save_attachment', id: 'm', attachment_id: 'a' });
    expect(api.post.mock.calls[1]?.[1].mime_type).toBe('application/octet-stream');
  });
});

describe('what speaks to someone else', () => {
  it('a declined share gives nobody access', async () => {
    approve.value = false;
    const answer = await tool('manage_google_drive')({ action: 'share', id: 'f', email: 'a@b.c' });
    expect(answer.cancelled).toBe(true);
    expect(confirmations).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('an approved share goes through', async () => {
    await tool('manage_google_drive')({
      action: 'share',
      id: 'f',
      name: 'Informe',
      email: 'a@b.c',
      role: 'writer',
    });
    expect(api.post.mock.calls[0]?.[1]).toEqual({ email: 'a@b.c', role: 'writer' });
    await tool('manage_google_drive')({ action: 'share', id: 'f', email: 'a@b.c' });
    expect(api.post.mock.calls[1]?.[1]).toEqual({ email: 'a@b.c', role: 'reader' });
  });

  it('a declined draft stays a draft', async () => {
    approve.value = false;
    const answer = await tool('manage_gmail')({ action: 'send_draft', id: 'd' });
    expect(answer.sent).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('an approved draft is sent', async () => {
    const answer = await tool('manage_gmail')({ action: 'send_draft', id: 'd', to: 'a@b.c' });
    expect(answer.sent).toBe(true);
    expect(api.post.mock.calls[0]?.[0]).toBe('/google/gmail/drafts/d/send');
  });
});
