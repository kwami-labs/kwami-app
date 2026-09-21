import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, createRequestGuard, isAbortError } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';

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

  // One guard key covers both racing callers: the kwami switch and the
  // undebounced search-as-you-type watcher. Both write contacts.value.
  const guard = createRequestGuard();

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
    const { signal, isCurrent } = guard.begin('list');
    try {
      const data = await api.get<{ contacts: ContactRecord[] }>('/contacts', {
        query: { kwamiId, q: search.trim() || undefined },
        signal,
      });
      if (!isCurrent()) return;
      if (!search.trim()) contactsByKwami.value[kwamiId] = data.contacts;
      contacts.value = data.contacts;
    } catch (e) {
      if (isAbortError(e)) return;
      throw e;
    } finally {
      if (isCurrent()) loading.value = false;
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
      await api.post<{ contact: ContactRecord }>('/contacts', { kwamiId, ...payload });
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
      await api.patch<{ contact: ContactRecord }>(`/contacts/${contactId}`, {
        kwamiId,
        ...payload,
      });
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
      await api.del<{ ok: boolean }>(`/contacts/${contactId}`, { query: { kwamiId } });
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
