<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BasePanel from '@/components/ui/BasePanel.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { panelIcons } from '@/constants/panel-icons';
import { useWorkspaceStore } from '@/stores/workspace';
import { useContactsStore } from '@/stores/contacts';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const contactsStore = useContactsStore();

const selectedId = ref<string | null>(null);
const statusMessage = ref('');
const errorMessage = ref('');
const deletingId = ref<string | null>(null);

const form = reactive({
  displayName: '',
  phoneNumber: '',
  email: '',
  instagram: '',
  tiktok: '',
});

const activeKwamiName = computed(() => workspaceStore.getActiveWorkspace()?.name || 'Kwami');
const selectedContact = computed(() =>
  contactsStore.contacts.find((contact) => contact.id === selectedId.value) || null,
);
const isEditing = computed(() => Boolean(selectedContact.value));

function resetForm() {
  selectedId.value = null;
  form.displayName = '';
  form.phoneNumber = '';
  form.email = '';
  form.instagram = '';
  form.tiktok = '';
}

function fillFormFromSelection() {
  const contact = selectedContact.value;
  if (!contact) return;
  form.displayName = contact.display_name || '';
  form.phoneNumber = contact.phone_number || '';
  form.email = contact.email || '';
  form.instagram = contact.instagram || '';
  form.tiktok = contact.tiktok || '';
}

function selectContact(contactId: string) {
  selectedId.value = contactId;
  fillFormFromSelection();
  statusMessage.value = '';
  errorMessage.value = '';
}

async function refreshContacts() {
  errorMessage.value = '';
  try {
    await contactsStore.fetchContacts();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
  }
}

async function saveContact() {
  if (!form.displayName.trim() || !form.phoneNumber.trim()) {
    errorMessage.value = t('contacts.namePhoneRequired');
    return;
  }
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    const payload = {
      displayName: form.displayName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim() || undefined,
      instagram: form.instagram.trim() || undefined,
      tiktok: form.tiktok.trim() || undefined,
    };
    if (selectedId.value) {
      await contactsStore.updateContact(selectedId.value, payload);
      statusMessage.value = t('contacts.updated');
    } else {
      await contactsStore.createContact(payload);
      statusMessage.value = t('contacts.created');
    }
    resetForm();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
  }
}

async function removeContact(contactId: string) {
  deletingId.value = contactId;
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    await contactsStore.deleteContact(contactId);
    if (selectedId.value === contactId) resetForm();
    statusMessage.value = t('contacts.deleted');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    deletingId.value = null;
  }
}

watch(
  () => workspaceStore.activeWorkspaceId,
  () => {
    resetForm();
    void refreshContacts();
  },
  { immediate: true },
);

watch(
  () => contactsStore.query,
  async (q) => {
    if (!q.trim()) {
      await refreshContacts();
      return;
    }
    try {
      await contactsStore.fetchContacts(q);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err);
    }
  },
);

onMounted(() => {
  void refreshContacts();
});
</script>

<template>
  <BasePanel :title="t('sidebar.panels.contacts')" :icon="panelIcons.contacts" :no-padding="true">
    <div class="contacts-grid">
      <section class="contacts-list">
        <div class="section-header">
          <strong>{{ t('contacts.listTitle', { kwami: activeKwamiName }) }}</strong>
          <BaseButton
            variant="secondary"
            size="sm"
            icon="ph:arrows-clockwise-duotone"
            :loading="contactsStore.loading"
            @click="refreshContacts"
          >
            {{ t('contacts.refresh') }}
          </BaseButton>
        </div>
        <BaseInput
          v-model="contactsStore.query"
          :label="t('contacts.search')"
          :placeholder="t('contacts.searchPlaceholder')"
        />
        <p v-if="contactsStore.loading" class="muted">{{ t('contacts.loading') }}</p>
        <p v-else-if="contactsStore.filteredContacts.length === 0" class="muted">{{ t('contacts.empty') }}</p>
        <button
          v-for="contact in contactsStore.filteredContacts"
          :key="contact.id"
          class="contact-row"
          :class="{ active: selectedId === contact.id }"
          @click="selectContact(contact.id)"
        >
          <strong>{{ contact.display_name || contact.phone_number }}</strong>
          <small>{{ contact.phone_number }}</small>
          <small v-if="contact.email">{{ contact.email }}</small>
          <small v-if="contact.instagram">{{ contact.instagram }}</small>
          <small v-if="contact.tiktok">{{ contact.tiktok }}</small>
        </button>
      </section>

      <section class="contact-form">
        <div class="section-header">
          <strong>{{ isEditing ? t('contacts.editContact') : t('contacts.newContact') }}</strong>
          <BaseButton variant="ghost" size="sm" icon="ph:x-bold" @click="resetForm">
            {{ t('contacts.clear') }}
          </BaseButton>
        </div>

        <BaseInput
          v-model="form.displayName"
          :label="t('contacts.name')"
          :placeholder="t('contacts.namePlaceholder')"
        />
        <BaseInput
          v-model="form.phoneNumber"
          :label="t('contacts.phone')"
          placeholder="+14155550123"
          mono
        />
        <BaseInput
          v-model="form.email"
          :label="t('contacts.email')"
          placeholder="name@example.com"
        />
        <BaseInput
          v-model="form.instagram"
          :label="t('contacts.instagram')"
          placeholder="@username"
        />
        <BaseInput
          v-model="form.tiktok"
          :label="t('contacts.tiktok')"
          placeholder="@username"
        />

        <div class="form-actions">
          <BaseButton
            variant="primary"
            icon="ph:floppy-disk-duotone"
            :loading="contactsStore.saving"
            @click="saveContact"
          >
            {{ isEditing ? t('contacts.update') : t('contacts.create') }}
          </BaseButton>
          <BaseButton
            v-if="selectedContact"
            variant="danger"
            icon="ph:trash-duotone"
            :loading="deletingId === selectedContact.id && contactsStore.deleting"
            @click="removeContact(selectedContact.id)"
          >
            {{ t('contacts.delete') }}
          </BaseButton>
        </div>

        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </section>
    </div>
  </BasePanel>
</template>

<style scoped>
.contacts-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  padding: 14px 16px;
}

.contacts-list,
.contact-form {
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.contact-row {
  border: 1px solid var(--glass-border);
  background: var(--surface-2);
  color: var(--text-primary);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  text-align: left;
}

.contact-row.active {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}

.contact-row small,
.muted {
  color: var(--text-muted);
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.status {
  margin: 0;
  color: var(--accent-primary);
  font-size: 12px;
}

.error {
  margin: 0;
  color: var(--error);
  font-size: 12px;
}

@media (max-width: 960px) {
  .contacts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
