import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type EmailCategory =
  | 'all'
  | 'travel'
  | 'bills'
  | 'events'
  | 'newsletters'
  | 'personal'
  | 'notifications'
  | 'shopping'
  | 'work'
  | 'uncategorized';

export interface EmailAccount {
  id: string;
  username: string;
  email_address: string;
  is_active: boolean;
}

export interface EmailMessage {
  id: string;
  account_id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  body_html: string;
  category: EmailCategory;
  action_card_data: Record<string, unknown>;
  is_read: boolean;
  is_archived: boolean;
  is_starred: boolean;
  received_at: string;
  created_at: string;
}

export interface EmailConversation {
  address: string;
  displayName: string;
  lastMessage: EmailMessage;
  unreadCount: number;
  messageCount: number;
  category: EmailCategory;
}

async function authHeaders(): Promise<HeadersInit> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = err.detail ?? err.message;
    throw new Error(
      typeof detail === 'string' ? detail : `Request failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

/** Bare email for grouping and sending; handles `Name <a@b.com>`, mailto:, etc. */
export function normalizeEmail(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim().replace(/^mailto:/i, '');
  const angle = s.match(/<([^<>]+@[^<>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  const at = /\b[^\s<>]+@[^\s<>]+\b/.exec(s);
  if (at?.[0]) return at[0].toLowerCase();
  return s.toLowerCase();
}

/** Display name for a peer, using From headers when available. */
export function peerDisplayName(msgs: EmailMessage[], canonical: string): string {
  for (const msg of msgs) {
    if (msg.direction !== 'inbound') continue;
    const raw = msg.from_address;
    if (normalizeEmail(raw) !== canonical) continue;
    const quoted = /^"([^"]+)"\s*</.exec(raw);
    if (quoted?.[1]?.trim()) return quoted[1].trim();
    const unquoted = /^([^<]+)<[^>]+>/.exec(raw);
    if (unquoted?.[1]?.trim()) {
      return unquoted[1].replace(/^['"]|['"]$/g, '').trim();
    }
    break;
  }
  const local = canonical.split('@')[0];
  return local || canonical;
}

export const useEmailStore = defineStore('email', () => {
  const account = ref<EmailAccount | null>(null);
  const messages = ref<EmailMessage[]>([]);
  const activeCategory = ref<EmailCategory>('all');
  const unreadCounts = ref<Record<string, number>>({});
  const selectedMessageId = ref<string | null>(null);

  const isLoading = ref(false);
  const isActivating = ref(false);
  const isCheckingUsername = ref(false);
  const isSending = ref(false);
  const accountByKwami = ref<Record<string, EmailAccount | null>>({});
  const messagesByKwami = ref<Record<string, EmailMessage[]>>({});
  const unreadByKwami = ref<Record<string, Record<string, number>>>({});

  let accountRequestNonce = 0;
  let inboxRequestNonce = 0;
  let unreadRequestNonce = 0;

  const selectedConversationAddress = ref<string | null>(null);

  const isActivated = computed(() => !!account.value?.is_active);
  const totalUnread = computed(() =>
    Object.values(unreadCounts.value).reduce((a, b) => a + b, 0),
  );
  const selectedMessage = computed(() =>
    messages.value.find((m) => m.id === selectedMessageId.value) ?? null,
  );

  function _counterparty(msg: EmailMessage): string {
    const own = account.value?.email_address
      ? normalizeEmail(account.value.email_address)
      : '';
    if (msg.direction === 'inbound') return normalizeEmail(msg.from_address);
    for (const raw of msg.to_addresses) {
      const c = normalizeEmail(raw);
      if (c && c !== own) return c;
    }
    const fallback = msg.to_addresses[0] ? normalizeEmail(msg.to_addresses[0]) : '';
    return fallback || own;
  }

  const conversations = computed<EmailConversation[]>(() => {
    const map = new Map<string, EmailMessage[]>();
    for (const msg of messages.value) {
      const key = _counterparty(msg);
      const list = map.get(key);
      if (list) list.push(msg);
      else map.set(key, [msg]);
    }

    const result: EmailConversation[] = [];
    for (const [address, msgs] of map) {
      msgs.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
      const last = msgs[0];
      // A key only exists in the map because a message was pushed under it.
      if (!last) continue;
      result.push({
        address,
        displayName: peerDisplayName(msgs, address),
        lastMessage: last,
        unreadCount: msgs.filter((m) => !m.is_read).length,
        messageCount: msgs.length,
        category: last.category,
      });
    }

    result.sort((a, b) =>
      new Date(b.lastMessage.received_at).getTime() - new Date(a.lastMessage.received_at).getTime(),
    );
    return result;
  });

  const conversationMessages = computed<EmailMessage[]>(() => {
    if (!selectedConversationAddress.value) return [];
    const addr = selectedConversationAddress.value;
    return messages.value
      .filter((m) => _counterparty(m) === addr)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  });

  function _kwamiId(): string {
    const ws = useWorkspaceStore();
    return ws.activeWorkspaceId;
  }

  // ----- Account -----

  async function fetchAccount() {
    const kwamiId = _kwamiId();
    if (!kwamiId) {
      account.value = null;
      return;
    }
    account.value = accountByKwami.value[kwamiId] ?? null;
    const requestNonce = ++accountRequestNonce;
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_BASE}/email/account?kwami_id=${encodeURIComponent(kwamiId)}`,
        { headers },
      );
      const data = await parseJson<{ account: EmailAccount | null }>(res);
      if (requestNonce !== accountRequestNonce) return;
      accountByKwami.value[kwamiId] = data.account;
      account.value = data.account;
    } catch (e) {
      console.warn('Failed to fetch email account:', e);
      if (requestNonce !== accountRequestNonce) return;
      account.value = null;
    }
  }

  async function checkUsername(username: string): Promise<{ available: boolean; error?: string }> {
    isCheckingUsername.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/email/check-username`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username }),
      });
      return await parseJson<{ available: boolean; error?: string }>(res);
    } finally {
      isCheckingUsername.value = false;
    }
  }

  async function activateEmail(username: string) {
    const kwamiId = _kwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    isActivating.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/email/activate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ kwami_id: kwamiId, username }),
      });
      const data = await parseJson<EmailAccount>(res);
      accountByKwami.value[kwamiId] = data;
      account.value = data;
      return data;
    } finally {
      isActivating.value = false;
    }
  }

  async function deactivateEmail() {
    const kwamiId = _kwamiId();
    if (!kwamiId) return;
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/email/account?kwami_id=${encodeURIComponent(kwamiId)}`,
      { method: 'DELETE', headers },
    );
    await parseJson<{ ok: boolean }>(res);
    accountByKwami.value[kwamiId] = null;
    messagesByKwami.value[kwamiId] = [];
    unreadByKwami.value[kwamiId] = {};
    account.value = null;
    messages.value = [];
    unreadCounts.value = {};
    activeCategory.value = 'all';
    selectedMessageId.value = null;
  }

  // ----- Inbox -----

  async function fetchInbox(category?: EmailCategory, page = 1) {
    isLoading.value = true;
    try {
      const kwamiId = _kwamiId();
      if (!kwamiId) {
        messages.value = [];
        return;
      }
      if (page === 1) {
        messages.value = messagesByKwami.value[kwamiId] ?? [];
      }
      const requestNonce = ++inboxRequestNonce;
      const params = new URLSearchParams({ kwami_id: kwamiId, page: String(page) });
      if (category && category !== 'all') params.set('category', category);
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/email/inbox?${params}`, { headers });
      const data = await parseJson<{ messages: EmailMessage[] }>(res);
      if (requestNonce !== inboxRequestNonce) return;
      if (page === 1) {
        messages.value = data.messages;
      } else {
        messages.value = [...messages.value, ...data.messages];
      }
      messagesByKwami.value[kwamiId] = messages.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchUnreadCounts() {
    const kwamiId = _kwamiId();
    if (!kwamiId) {
      unreadCounts.value = {};
      return;
    }
    unreadCounts.value = unreadByKwami.value[kwamiId] ?? {};
    const requestNonce = ++unreadRequestNonce;
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_BASE}/email/unread-counts?kwami_id=${encodeURIComponent(kwamiId)}`,
        { headers },
      );
      const data = await parseJson<{ counts: Record<string, number> }>(res);
      if (requestNonce !== unreadRequestNonce) return;
      unreadByKwami.value[kwamiId] = data.counts;
      unreadCounts.value = data.counts;
    } catch (e) {
      // Unread badges are decoration: a failure here must not reject out of
      // refreshInbox() and take the whole inbox load down with it.
      console.warn('Failed to fetch unread counts:', e);
    }
  }

  async function refreshInbox() {
    await Promise.all([fetchInbox(activeCategory.value), fetchUnreadCounts()]);
  }

  // ----- Single message -----

  async function fetchMessage(messageId: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/email/messages/${messageId}`, { headers });
    const data = await parseJson<{ message: EmailMessage }>(res);
    const idx = messages.value.findIndex((m) => m.id === messageId);
    if (idx !== -1) messages.value[idx] = data.message;
    return data.message;
  }

  async function markRead(messageId: string) {
    return _patchMessage(messageId, { is_read: true });
  }

  async function toggleStar(messageId: string) {
    const msg = messages.value.find((m) => m.id === messageId);
    if (!msg) return;
    return _patchMessage(messageId, { is_starred: !msg.is_starred });
  }

  async function archiveMessage(messageId: string) {
    return _patchMessage(messageId, { is_archived: true });
  }

  async function _patchMessage(messageId: string, fields: Record<string, boolean>) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/email/messages/${messageId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(fields),
    });
    const data = await parseJson<{ message: EmailMessage }>(res);
    const idx = messages.value.findIndex((m) => m.id === messageId);
    if (idx !== -1) messages.value[idx] = data.message;
    if (fields.is_archived) {
      messages.value = messages.value.filter((m) => m.id !== messageId);
    }
    await fetchUnreadCounts();
    return data.message;
  }

  // ----- Send -----

  async function sendEmail(params: {
    to: string[];
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    cc?: string[];
  }) {
    isSending.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/email/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kwami_id: _kwamiId(),
          to_addresses: params.to,
          cc_addresses: params.cc ?? [],
          subject: params.subject,
          body_text: params.bodyText,
          body_html: params.bodyHtml ?? '',
        }),
      });
      const data = await parseJson<{ ok: boolean; message: EmailMessage }>(res);
      return data.message;
    } finally {
      isSending.value = false;
    }
  }

  // ----- Selection helpers -----

  function selectMessage(id: string | null) {
    selectedMessageId.value = id;
  }

  function selectConversation(address: string | null) {
    selectedConversationAddress.value = address;
  }

  function setCategory(cat: EmailCategory) {
    activeCategory.value = cat;
    messages.value = [];
    void fetchInbox(cat).catch((e) => {
      console.error('Failed to load inbox for category:', cat, e);
    });
  }

  return {
    account,
    messages,
    activeCategory,
    unreadCounts,
    selectedMessageId,
    selectedMessage,
    selectedConversationAddress,
    conversations,
    conversationMessages,
    isLoading,
    isActivating,
    isCheckingUsername,
    isSending,
    isActivated,
    totalUnread,
    fetchAccount,
    checkUsername,
    activateEmail,
    deactivateEmail,
    fetchInbox,
    fetchUnreadCounts,
    refreshInbox,
    fetchMessage,
    markRead,
    toggleStar,
    archiveMessage,
    sendEmail,
    selectMessage,
    selectConversation,
    setCategory,
  };
});
