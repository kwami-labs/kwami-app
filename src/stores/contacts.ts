import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ContactRecord {
  id: string;
  kwami_id: string;
  display_name: string;
  phone_number: string;
  whatsapp_address: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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
    throw new Error(typeof detail === 'string' ? detail : `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const useContactsStore = defineStore('contacts', () => {
  const contacts = ref<ContactRecord[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const query = ref('');
  const contactsByKwami = ref<Record<string, ContactRecord[]>>({});

  const filteredContacts = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return contacts.value;
    return contacts.value.filter((contact) =>
      [
        contact.display_name,
        contact.phone_number,
        contact.whatsapp_address,
        contact.email,
        contact.instagram,
        contact.tiktok,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  });

  // Guards against a stale response landing after a kwami switch or a newer
  // search keystroke.
  let contactsRequestNonce = 0;

  function activeKwamiId(): string {
    const workspaceStore = useWorkspaceStore();
    return workspaceStore.activeWorkspaceId;
  }

  async function fetchContacts(search = '') {
    const kwamiId = activeKwamiId();
    if (!kwamiId) {
      contacts.value = [];
      return;
    }
    loading.value = true;
    if (!search) {
      contacts.value = contactsByKwami.value[kwamiId] ?? [];
    }
    // One nonce covers both racing callers: the kwami switch and the
    // search-as-you-type watcher. Both write contacts.value.
    const requestNonce = ++contactsRequestNonce;
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({ kwamiId });
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`${API_BASE}/contacts?${params.toString()}`, { headers });
      const data = await parseJson<{ contacts: ContactRecord[] }>(res);
      if (requestNonce !== contactsRequestNonce) return;
      if (!search.trim()) contactsByKwami.value[kwamiId] = data.contacts;
      contacts.value = data.contacts;
    } finally {
      if (requestNonce === contactsRequestNonce) loading.value = false;
    }
  }

  async function createContact(payload: {
    displayName: string;
    phoneNumber: string;
    whatsappAddress?: string;
    email?: string;
    instagram?: string;
    tiktok?: string;
  }) {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    saving.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ kwamiId, ...payload }),
      });
      await parseJson<{ contact: ContactRecord }>(res);
      await fetchContacts();
    } finally {
      saving.value = false;
    }
  }

  async function updateContact(
    contactId: string,
    payload: {
      displayName: string;
      phoneNumber: string;
      whatsappAddress?: string;
      email?: string;
      instagram?: string;
      tiktok?: string;
    },
  ) {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    saving.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/contacts/${contactId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ kwamiId, ...payload }),
      });
      await parseJson<{ contact: ContactRecord }>(res);
      await fetchContacts();
    } finally {
      saving.value = false;
    }
  }

  async function deleteContact(contactId: string) {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    deleting.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_BASE}/contacts/${contactId}?kwamiId=${encodeURIComponent(kwamiId)}`,
        { method: 'DELETE', headers },
      );
      await parseJson<{ ok: boolean }>(res);
      await fetchContacts();
    } finally {
      deleting.value = false;
    }
  }

  return {
    contacts,
    query,
    loading,
    saving,
    deleting,
    filteredContacts,
    fetchContacts,
    createContact,
    updateContact,
    deleteContact,
  };
});
