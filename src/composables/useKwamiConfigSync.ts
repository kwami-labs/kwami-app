import { watch, nextTick } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useAvatarStore } from '@/stores/avatar';
import { useVoiceStore } from '@/stores/voice';
import { useSceneStore } from '@/stores/scene';
import { useThemeStore } from '@/stores/theme';
import { useCommunicationsStore } from '@/stores/communications';

export type KwamiConfig = {
  avatar?: unknown;
  voice?: unknown;
  scene?: unknown;
  theme?: unknown;
  telephony?: unknown;
};

/** Clone config to a plain JSON-serializable object so DB/store never holds reactive refs and round-trip is safe. */
function safeConfigClone(config: KwamiConfig): KwamiConfig {
  try {
    return JSON.parse(JSON.stringify(config)) as KwamiConfig;
  } catch {
    return config;
  }
}

export function useKwamiConfigSync() {
  const workspaceStore = useWorkspaceStore();
  const authStore = useAuthStore();
  const avatarStore = useAvatarStore();
  const voiceStore = useVoiceStore();
  const sceneStore = useSceneStore();
  const themeStore = useThemeStore();
  const communicationsStore = useCommunicationsStore();

  function getConfig(): KwamiConfig {
    return {
      avatar: avatarStore.getSnapshot(),
      voice: voiceStore.getSnapshot(),
      scene: sceneStore.getSnapshot(),
      theme: themeStore.getSnapshot(), // mode, accent, glass, ui, accessibility, flashlight, effects
      telephony: communicationsStore.getSnapshot(),
    };
  }

  /** Save current config to the active workspace, then switch to the given kwami. Call this when switching kwamis so the previous one's config is not lost. */
  function switchToKwami(id: string) {
    const raw = getConfig();
    const plain = safeConfigClone(raw);
    workspaceStore.updateActiveConfigLocal(plain);
    workspaceStore.setActive(id);
  }

  async function saveCurrentConfig() {
    const plain = safeConfigClone(getConfig());
    return workspaceStore.saveActiveConfig(plain, authStore.userId);
  }

  function revertCurrentConfig() {
    const savedConfig = workspaceStore.discardActiveConfigChanges();
    if (savedConfig) {
      applyConfig(savedConfig);
    }
  }

  function applyConfig(config: KwamiConfig) {
    if (!config) return;
    try {
      if (config.theme && typeof config.theme === 'object' && Object.keys(config.theme as object).length > 0) {
        themeStore.applySnapshot(config.theme as Parameters<typeof themeStore.applySnapshot>[0]);
        nextTick(() => themeStore.applyTheme());
      }
      if (config.avatar && typeof config.avatar === 'object') {
        avatarStore.applySnapshot(config.avatar as Parameters<typeof avatarStore.applySnapshot>[0]);
      }
      if (config.voice && typeof config.voice === 'object') {
        voiceStore.applySnapshot(config.voice as Record<string, unknown>);
      }
      if (config.scene && typeof config.scene === 'object') {
        sceneStore.applySnapshot(config.scene as Parameters<typeof sceneStore.applySnapshot>[0]);
      }
      if (config.telephony && typeof config.telephony === 'object') {
        communicationsStore.applySnapshot(
          config.telephony as Parameters<typeof communicationsStore.applySnapshot>[0],
        );
      }
      window.dispatchEvent(new CustomEvent('kwami:configApplied'));
    } catch (e) {
      console.warn('Failed to apply kwami config:', e);
    }
  }

  return { getConfig, applyConfig, switchToKwami, saveCurrentConfig, revertCurrentConfig };
}

export function useKwamiConfigWatchers() {
  const { getConfig, applyConfig, switchToKwami } = useKwamiConfigSync();
  const workspaceStore = useWorkspaceStore();
  const themeStore = useThemeStore();
  const sceneStore = useSceneStore();

  // When active workspace changes, apply that kwami's config then rebase
  // savedConfig to what the stores actually emit. This ensures fields that were
  // added to the schema after a config was saved (and therefore absent from
  // savedConfig) don't permanently flag the config as unsaved.
  watch(
    () => workspaceStore.activeWorkspaceId,
    async (kwamiId) => {
      // Skip the immediate pass before a workspace is resolved: there is
      // nothing to apply, and rebasing against nothing is pure churn.
      if (!kwamiId) return;
      const config = workspaceStore.getActiveWorkspace()?.config;
      if (config && typeof config === 'object' && Object.keys(config as object).length > 0) {
        applyConfig(config as KwamiConfig);
      }
      // Wait for the post-flush syncDraftConfig watcher to run first,
      // then rebase so the normalized store output becomes the clean baseline.
      await nextTick();
      const normalized = safeConfigClone(getConfig());
      workspaceStore.rebaseActiveSavedConfig(normalized);
    },
    { immediate: true },
  );

  function syncDraftConfig() {
    try {
      const plain = safeConfigClone(getConfig());
      workspaceStore.updateActiveConfigLocal(plain);
    } catch (e) {
      console.warn('Failed to sync local kwami config:', e);
    }
  }

  // Watch all config and store it locally as a draft. Server persistence is explicit.
  watch(
    () => {
      try {
        return JSON.stringify(getConfig());
      } catch {
        return '';
      }
    },
    syncDraftConfig,
    { flush: 'post' },
  );

  // Scene store: deep watch so overlay/media/star-field edits mark workspace dirty & include in Save.
  watch(
    () => sceneStore.background,
    () => syncDraftConfig(),
    { deep: true, flush: 'post' },
  );

  // Explicit watch on theme so theme changes always sync the local draft.
  watch(
    () => JSON.stringify(themeStore.getSnapshot()),
    syncDraftConfig,
    { flush: 'post' },
  );

  return { applyConfig, getConfig, switchToKwami };
}
