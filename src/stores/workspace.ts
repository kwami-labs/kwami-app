import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { KwamiConfig } from '@/composables/useKwamiConfigSync';

export interface KwamiWorkspace {
  id: string;
  name: string;
  emoji: string;
  colors: { x: string; y: string; z: string };
  config?: KwamiConfig;
  savedConfig?: KwamiConfig;
  hasUnsavedConfig?: boolean;
}

/**
 * DB-backed kwamis have a UUID id; locally-created ones do not exist in
 * `user_kwamis` yet, so they must not be sent to endpoints that validate
 * ownership against that table.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPersistedKwamiId(id: string): boolean {
  return UUID_RE.test(id);
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<KwamiWorkspace[]>([]);
  const activeWorkspaceId = ref<string>('');
  const loading = ref(false);
  const loadedFromDb = ref(false);
  const hasActiveUnsavedConfig = computed(() => Boolean(getActiveWorkspace()?.hasUnsavedConfig));

  const defaultColors = { x: '#00d9ff', y: '#a855f7', z: '#22c55e' };

  function cloneConfig<T extends KwamiConfig | undefined>(config: T): T {
    if (config == null) return config;
    return JSON.parse(JSON.stringify(config)) as T;
  }

  function configsEqual(a?: KwamiConfig, b?: KwamiConfig): boolean {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  }

  function syncDirtyState(workspace: KwamiWorkspace) {
    workspace.hasUnsavedConfig = !configsEqual(workspace.config, workspace.savedConfig);
  }

  function setWorkspaceConfig(workspace: KwamiWorkspace, config?: KwamiConfig, markAsSaved = false) {
    workspace.config = cloneConfig(config);
    if (markAsSaved) {
      workspace.savedConfig = cloneConfig(config);
    }
    syncDirtyState(workspace);
  }

  function generateRandomKwami(): Omit<KwamiWorkspace, 'config'> {
    const adjectives = [
      'Cosmic', 'Mystic', 'Neon', 'Stellar', 'Aurora', 'Crystal', 'Shadow', 'Prism',
    ];
    const nouns = ['Spark', 'Wave', 'Pulse', 'Echo', 'Drift', 'Glow', 'Flux', 'Vibe'];
    const randomColor = () =>
      '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)] || 'Cosmic';
    const noun = nouns[Math.floor(Math.random() * nouns.length)] || 'Spark';
    return {
      id: `kwami_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${adj} ${noun}`,
      emoji: '',
      colors: { x: randomColor(), y: randomColor(), z: randomColor() },
    };
  }

  function ensureLocalWorkspace() {
    if (workspaces.value.length === 0) {
      const initial = {
        ...generateRandomKwami(),
        config: undefined,
        savedConfig: undefined,
        hasUnsavedConfig: false,
      };
      workspaces.value.push(initial);
      activeWorkspaceId.value = initial.id;
    }
  }

  async function loadFromDb(userId: string) {
    if (loading.value || !userId) return;
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('user_kwamis')
        .select('id, name, emoji, colors, config')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as Array<{
        id: string;
        name: string;
        emoji: string;
        colors: { x: string; y: string; z: string };
        config?: KwamiConfig;
      }>;

      if (rows.length === 0) {
        const newKwami = await createKwamiInDb(userId, generateRandomKwami());
        if (newKwami) {
          workspaces.value = [newKwami];
          activeWorkspaceId.value = newKwami.id;
        }
      } else {
        workspaces.value = rows.map((r) => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          colors: r.colors || { x: '#00d9ff', y: '#a855f7', z: '#22c55e' },
          config: cloneConfig(r.config),
          savedConfig: cloneConfig(r.config),
          hasUnsavedConfig: false,
        }));
        activeWorkspaceId.value = workspaces.value[0]!.id;
      }
      loadedFromDb.value = true;
    } catch (e) {
      console.warn('Failed to load kwamis from DB:', e);
      ensureLocalWorkspace();
    } finally {
      loading.value = false;
    }
  }

  async function createKwamiInDb(
    userId: string,
    data: { name: string; emoji: string; colors: { x: string; y: string; z: string }; config?: KwamiConfig },
  ): Promise<KwamiWorkspace | null> {
    const { data: row, error } = await supabase
      .from('user_kwamis')
      .insert({
        user_id: userId,
        name: data.name,
        emoji: data.emoji,
        colors: data.colors,
        config: cloneConfig(data.config) ?? {},
      })
      .select('id, name, emoji, colors, config')
      .single();

    if (error) {
      console.warn('Failed to create kwami in DB:', error);
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      colors: row.colors || data.colors,
      config: cloneConfig(row.config),
      savedConfig: cloneConfig(row.config),
      hasUnsavedConfig: false,
    };
  }

  async function addKwami(
    userId: string | null,
    initial?: {
      name?: string;
      randomize?: boolean;
      colors?: { x: string; y: string; z: string };
      config?: KwamiConfig;
    },
  ): Promise<KwamiWorkspace> {
    const randomize = initial?.randomize ?? false;
    let name: string;
    let emoji: string;
    let colors: { x: string; y: string; z: string };
    let config: KwamiConfig | undefined;

    if (randomize) {
      const generated = generateRandomKwami();
      name = (initial?.name?.trim() || generated.name).slice(0, 64);
      emoji = '';
      colors = generated.colors;
      config = undefined;
    } else {
      const active = workspaces.value.find((w) => w.id === activeWorkspaceId.value);
      name = (initial?.name?.trim() || active?.name || 'Kwami').slice(0, 64);
      emoji = '';
      colors = initial?.colors && typeof initial.colors === 'object'
        ? { ...defaultColors, ...initial.colors }
        : (active?.colors ? { ...active.colors } : defaultColors);
      config = initial?.config ? JSON.parse(JSON.stringify(initial.config)) : (active?.config ? JSON.parse(JSON.stringify(active.config)) : undefined);
    }

    const payload = { name, emoji, colors, config };
    if (userId) {
      const created = await createKwamiInDb(userId, payload);
      if (created) {
        const withConfig: KwamiWorkspace = {
          ...created,
          config: cloneConfig(config),
          savedConfig: cloneConfig(config),
          hasUnsavedConfig: false,
        };
        workspaces.value.push(withConfig);
        activeWorkspaceId.value = withConfig.id;
        return withConfig;
      }
    }
    const local: KwamiWorkspace = {
      id: `kwami_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      emoji,
      colors,
      config: cloneConfig(config),
      savedConfig: cloneConfig(config),
      hasUnsavedConfig: false,
    };
    workspaces.value.push(local);
    activeWorkspaceId.value = local.id;
    return local;
  }

  async function deleteKwami(id: string, userId: string | null): Promise<boolean> {
    const idx = workspaces.value.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    const wasActive = activeWorkspaceId.value === id;
    const isDbId = isPersistedKwamiId(id);
    if (isDbId && userId) {
      const { error } = await supabase.from('user_kwamis').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        console.warn('Failed to delete kwami from DB:', error);
        return false;
      }
    }
    workspaces.value.splice(idx, 1);
    if (wasActive && workspaces.value.length > 0) {
      activeWorkspaceId.value = workspaces.value[0]!.id;
    } else if (workspaces.value.length === 0) {
      activeWorkspaceId.value = '';
      ensureLocalWorkspace();
    }
    return true;
  }

  async function updateKwami(
    id: string,
    payload: { name?: string; emoji?: string; colors?: { x: string; y: string; z: string } },
    userId: string | null,
  ): Promise<void> {
    const ws = workspaces.value.find((w) => w.id === id);
    if (!ws) return;
    if (payload.name !== undefined) ws.name = payload.name.trim().slice(0, 64);
    if (payload.emoji !== undefined) ws.emoji = payload.emoji;
    if (payload.colors !== undefined) ws.colors = { ...ws.colors, ...payload.colors };
    const isDbId = isPersistedKwamiId(id);
    if (!isDbId || !userId) return;
    try {
      const body: Record<string, unknown> = {};
      if (payload.name !== undefined) body.name = ws.name;
      if (payload.emoji !== undefined) body.emoji = ws.emoji;
      if (payload.colors !== undefined) body.colors = ws.colors;
      if (Object.keys(body).length === 0) return;
      const { error } = await supabase
        .from('user_kwamis')
        .update(body)
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      console.warn('Failed to update kwami:', e);
    }
  }

  function setActive(id: string) {
    if (workspaces.value.some((w) => w.id === id)) {
      activeWorkspaceId.value = id;
    }
  }

  /**
   * Pure read. It must NOT call ensureLocalWorkspace(): this runs from
   * computeds and from the config watcher's immediate pass, which fire before
   * loadFromDb() resolves. Creating a workspace here spawned a throwaway
   * "phantom" kwami that config was then rebased against, moments before
   * loadFromDb() replaced workspaces wholesale.
   *
   * The genuine "no workspaces yet" cases are handled explicitly by
   * loadFromDb() and deleteWorkspace().
   */
  function getActiveWorkspace(): KwamiWorkspace | undefined {
    return workspaces.value.find((w) => w.id === activeWorkspaceId.value);
  }

  function updateActiveConfigLocal(config: KwamiConfig) {
    const ws = getActiveWorkspace();
    if (!ws) return;
    setWorkspaceConfig(ws, config, false);
  }

  /**
   * Re-anchors savedConfig to the provided config without marking dirty.
   * Called after applyConfig so that store defaults for schema-evolved fields
   * (fields added after the config was originally saved) don't permanently
   * show as unsaved changes.
   */
  function rebaseActiveSavedConfig(config: KwamiConfig) {
    const ws = getActiveWorkspace();
    if (!ws) return;
    ws.savedConfig = cloneConfig(config);
    syncDirtyState(ws);
  }

  function getActiveSavedConfig(): KwamiConfig | undefined {
    const ws = getActiveWorkspace();
    return cloneConfig(ws?.savedConfig);
  }

  function discardActiveConfigChanges(): KwamiConfig | undefined {
    const ws = getActiveWorkspace();
    if (!ws) return undefined;
    setWorkspaceConfig(ws, ws.savedConfig, false);
    return cloneConfig(ws.config);
  }

  async function saveActiveConfig(config: KwamiConfig, userId: string | null): Promise<boolean> {
    if (!activeWorkspaceId.value) return false;
    const ws = workspaces.value.find((w) => w.id === activeWorkspaceId.value);
    if (!ws) return false;
    updateActiveConfigLocal(config);
    if (!userId) {
      setWorkspaceConfig(ws, config, true);
      return true;
    }
    // Only persist to DB when the active kwami has a DB id (UUID). Local-only kwamis have ids like kwami_*
    const id = activeWorkspaceId.value;
    const isDbId = isPersistedKwamiId(id);
    if (!isDbId) {
      setWorkspaceConfig(ws, config, true);
      return true;
    }
    try {
      const configPayload = JSON.parse(JSON.stringify(config)) as object;
      const { error } = await supabase
        .from('user_kwamis')
        .update({ config: configPayload })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase save kwami config failed:', error.message, error.details);
        throw error;
      }
      setWorkspaceConfig(ws, config, true);
      return true;
    } catch (e) {
      console.warn('Failed to save kwami config:', e);
      return false;
    }
  }

  return {
    workspaces,
    activeWorkspaceId,
    loading,
    loadedFromDb,
    hasActiveUnsavedConfig,
    addKwami,
    updateKwami,
    setActive,
    getActiveWorkspace,
    updateActiveConfigLocal,
    rebaseActiveSavedConfig,
    getActiveSavedConfig,
    discardActiveConfigChanges,
    loadFromDb,
    saveActiveConfig,
    ensureLocalWorkspace,
    deleteKwami,
  };
});
