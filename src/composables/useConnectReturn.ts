import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { finishConnection } from '@/lib/connectFinish';
import { pendingConnections } from '@/lib/connectReturn';
import { useAuthStore } from '@/stores/auth';

/** Finishes what came back, as soon as someone is signed in. Call once, from the auth guard. */
export function useConnectReturn(): void {
  const authStore = useAuthStore();
  const toast = useToast();
  const { t } = useI18n();

  async function drain() {
    for (const item of pendingConnections.value.splice(0)) {
      const result = await finishConnection(item);
      if (result === 'ok') toast.success(t('assistant.connectDone'));
      else if (result === 'wrong-user') toast.error(t('assistant.connectWrongUser'));
      else toast.error(t('assistant.connectFailed'));
    }
  }

  watch(
    [() => authStore.isAuthenticated, () => pendingConnections.value.length],
    ([signedIn, waiting]) => {
      if (signedIn && waiting) void drain();
    },
    { immediate: true },
  );
}
