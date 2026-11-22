import { onBeforeUnmount, watch } from 'vue';
import { loadUserLocaleFromDb, loadUserUiFromDb, saveUserUiToDb } from '@/lib/userAppSettings';
import { useAuthStore } from '@/stores/auth';
import { useUIStore, type UiLayoutSnapshot } from '@/stores/ui';
import { isBlankHudState, useHudStore, type HudAccountState } from '@/stores/hud';

const SAVE_DELAY_MS = 800;

/**
 * Keeps the panel layout and Jarvis's HUD (screens, windows, documents, settings) in
 * the user's account, so whatever device they sign in on is as they left it.
 *
 * The locale goes first: it is what seeds the settings row, and a save that created
 * the row itself would leave the default locale in it. Nothing is saved until the
 * account's layout has been read, or this device's would overwrite it on sign-in.
 * The account's HUD wins over this device's, unless the account has none yet: then
 * this device's, if the user made anything on it, becomes the account's.
 */
export function useUiLayoutSync() {
  const authStore = useAuthStore();
  const uiStore = useUIStore();
  const hudStore = useHudStore();
  let loadedFor: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSaved = '';

  function snapshot(): string {
    return JSON.stringify({ ...uiStore.getLayoutSnapshot(), hud: hudStore.accountState() });
  }

  function save(now = false) {
    const userId = loadedFor;
    if (!userId) return;
    clearTimeout(timer);
    const write = () => {
      if (loadedFor !== userId) return;
      const text = snapshot();
      if (text === lastSaved) return;
      lastSaved = text;
      void saveUserUiToDb(userId, JSON.parse(text) as Record<string, unknown>);
    };
    if (now) write();
    else timer = setTimeout(write, SAVE_DELAY_MS);
  }

  async function load(userId: string) {
    await loadUserLocaleFromDb(userId);
    const saved = await loadUserUiFromDb(userId);
    if (authStore.userId !== userId) return;
    if (saved && Object.keys(saved).length > 0) {
      uiStore.applyLayoutSnapshot(saved as Partial<UiLayoutSnapshot>);
    }
    const accountHud = saved?.hud as HudAccountState | undefined;
    // An account HUD with nothing in it (written by a device never used) is no HUD.
    const accountHasHud =
      isHudState(accountHud) &&
      !isBlankHudState(accountHud) &&
      hudStore.adoptAccountState(accountHud);
    loadedFor = userId;
    lastSaved = saved ? JSON.stringify(saved) : '';
    // The account had no HUD of its own: this device's becomes it, if there is one.
    if (!accountHasHud && !isBlankHudState(hudStore.accountState())) save(true);
  }

  /** Enough of a saved HUD to tell whether it is blank; `adoptAccountState` checks the rest. */
  function isHudState(value: unknown): value is HudAccountState {
    const v = value as Partial<HudAccountState> | null | undefined;
    return (
      typeof v === 'object' &&
      v !== null &&
      Array.isArray(v.windows) &&
      Array.isArray(v.documents) &&
      Array.isArray(v.screens) &&
      typeof v.learned === 'object' &&
      v.learned !== null &&
      typeof v.prefs === 'object'
    );
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
    () => save(),
  );
  // The HUD changes on every drag; what is sent is worked out once it settles.
  watch(
    [
      () => hudStore.widgets,
      () => hudStore.screens,
      () => hudStore.activeScreen,
      () => hudStore.documents,
      () => hudStore.prefs,
      () => hudStore.learned,
    ],
    () => save(),
    { deep: true },
  );

  onBeforeUnmount(() => clearTimeout(timer));
}
