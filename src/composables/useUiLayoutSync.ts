import { onBeforeUnmount, watch } from 'vue';
import { loadUserLocaleFromDb, loadUserUiFromDb, saveUserUiToDb } from '@/lib/userAppSettings';
import { useAuthStore } from '@/stores/auth';
import { useUIStore, type UiLayoutSnapshot } from '@/stores/ui';

const SAVE_DELAY_MS = 800;

/**
 * Keeps the panel layout in the user's account, so it follows them across devices.
 *
 * The locale goes first: it is what seeds the settings row, and a save that created
 * the row itself would leave the default locale in it. Nothing is saved until the
 * account's layout has been read, or this device's would overwrite it on sign-in.
 */
export function useUiLayoutSync() {
  const authStore = useAuthStore();
  const uiStore = useUIStore();
  let loadedFor: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(userId: string) {
    await loadUserLocaleFromDb(userId);
    const saved = await loadUserUiFromDb(userId);
    if (authStore.userId !== userId) return;
    if (saved && Object.keys(saved).length > 0) {
      uiStore.applyLayoutSnapshot(saved as Partial<UiLayoutSnapshot>);
    }
    loadedFor = userId;
  }

  watch(
    () => (authStore.isAuthenticated ? authStore.userId : null),
    (userId) => {
      loadedFor = null;
      if (userId) void load(userId);
    },
    { immediate: true },
  );

  watch(
    () => JSON.stringify(uiStore.getLayoutSnapshot()),
    (snapshot) => {
      const userId = loadedFor;
      if (!userId) return;
      clearTimeout(timer);
      timer = setTimeout(() => void saveUserUiToDb(userId, JSON.parse(snapshot)), SAVE_DELAY_MS);
    },
  );

  onBeforeUnmount(() => clearTimeout(timer));
}
