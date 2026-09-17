import { ref, computed } from 'vue';
import { api } from '@/lib/apiClient';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useVoiceStore } from '@/stores/voice';
import { useWorkspaceStore } from '@/stores/workspace';
import { useKwamiConfigSync } from '@/composables/useKwamiConfigSync';
import { useToast } from 'vue-toastification';


export interface KwamiForEdit {
  id: string;
  name: string;
  colors: { x: string; y: string; z: string };
}

export function useKwamiActions() {
  const { t } = useI18n();
  const authStore = useAuthStore();
  const voiceStore = useVoiceStore();
  const workspaceStore = useWorkspaceStore();
  const { getConfig } = useKwamiConfigSync();
  const toast = useToast();

  const showNewKwamiModal = ref(false);
  const showEditKwamiModal = ref(false);
  const showDeleteConfirm = ref(false);
  const editKwami = ref<KwamiForEdit | null>(null);
  const deleteKwamiId = ref('');
  const deleteKwamiName = ref('');

  const activeWorkspace = computed(() => workspaceStore.getActiveWorkspace());

  function openAdd() {
    showNewKwamiModal.value = true;
  }

  function openEdit(ws: KwamiForEdit) {
    editKwami.value = ws;
    showEditKwamiModal.value = true;
  }

  function closeNew() {
    showNewKwamiModal.value = false;
  }

  function closeEdit() {
    showEditKwamiModal.value = false;
    editKwami.value = null;
  }

  function closeDelete() {
    showDeleteConfirm.value = false;
    deleteKwamiId.value = '';
    deleteKwamiName.value = '';
  }

  function openDeleteFromEdit() {
    if (!editKwami.value) return;
    deleteKwamiId.value = editKwami.value.id;
    deleteKwamiName.value = editKwami.value.name;
    editKwami.value = null;
    showEditKwamiModal.value = false;
    showDeleteConfirm.value = true;
  }

  async function deleteKwamiZepMemory(kwamiId: string, userId: string | null): Promise<void> {
    if (!userId) return;
    const memoryUserId = `kwami_${userId}_${kwamiId}`;
    try {
      await api.del(`/memory/${memoryUserId}`);
    } catch (e) {
      // Swallowed deliberately: failing to purge remote memory must not block
      // deleting the kwami itself.
      console.warn('Failed to delete kwami memory:', e);
    }
  }

  async function onNewConfirm(payload: {
    name: string;
    randomize: boolean;
    colors: { x: string; y: string; z: string };
  }) {
    const initial: Parameters<typeof workspaceStore.addKwami>[1] = payload.name ? { name: payload.name } : {};
    initial.randomize = payload.randomize;
    initial.colors = { ...payload.colors };
    if (!payload.randomize && activeWorkspace.value) {
      initial.config = getConfig();
    }
    const newKwami = await workspaceStore.addKwami(authStore.userId, initial);
    voiceStore.soulConfig.name = newKwami.name;
    showNewKwamiModal.value = false;
    toast.success(
      t('kwamiActions.created', {
        name: newKwami.name,
        emoji: newKwami.emoji ? ` ${newKwami.emoji}` : '',
      }),
    );
    return newKwami;
  }

  async function onEditSave(payload: { name: string; colors: { x: string; y: string; z: string } }) {
    const kwami = editKwami.value;
    if (!kwami) return;
    await workspaceStore.updateKwami(kwami.id, payload, authStore.userId);
    if (workspaceStore.activeWorkspaceId === kwami.id) {
      voiceStore.soulConfig.name = payload.name;
    }
    showEditKwamiModal.value = false;
    editKwami.value = null;
    toast.success(t('kwamiActions.updated'));
  }

  async function onDeleteConfirm() {
    const id = deleteKwamiId.value;
    if (!id) {
      closeDelete();
      return;
    }
    const deleteFn = workspaceStore.deleteKwami;
    if (typeof deleteFn !== 'function') {
      toast.error(t('kwamiActions.refreshPage'));
      closeDelete();
      return;
    }
    const ok = await deleteFn(id, authStore.userId);
    closeDelete();
    if (ok) {
      await deleteKwamiZepMemory(id, authStore.userId);
      toast.success(t('kwamiActions.deleted'));
    } else {
      toast.error(t('kwamiActions.deleteFailed'));
    }
  }

  return {
    showNewKwamiModal,
    showEditKwamiModal,
    showDeleteConfirm,
    editKwami,
    deleteKwamiName,
    activeWorkspace,
    openAdd,
    openEdit,
    closeNew,
    closeEdit,
    closeDelete,
    openDeleteFromEdit,
    onNewConfirm,
    onEditSave,
    onDeleteConfirm,
  };
}
