import { ref } from 'vue';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api, ApiError } from '@/lib/apiClient';
import { isTauri } from '@/lib/platform';
import type { BrainProvider } from '@/lib/brain';

/**
 * The model accounts this user connected, through the API (`/providers`).
 *
 * A key goes straight to the API and is forgotten here: it is never kept in the
 * store, in a snapshot or on the data channel, and the API only ever hands back its
 * last characters. Shared across the panel: what one card connects, the others see.
 */
interface Connections {
  enabled: boolean;
  connected: Partial<Record<BrainProvider, { hint: string }>>;
}

/** Not asked yet, or the API could not say. */
const connections = ref<Connections | null>(null);

export type ConnectResult = 'ok' | 'refused' | 'failed';

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) await openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

export function useProviderConnections() {
  async function refresh(): Promise<void> {
    try {
      connections.value = await api.get<Connections>('/providers');
    } catch {
      connections.value = null;
    }
  }

  async function saveKey(provider: BrainProvider, key: string): Promise<ConnectResult> {
    try {
      await api.put(`/providers/${provider}/key`, { key });
    } catch (e) {
      return e instanceof ApiError && e.status === 400 ? 'refused' : 'failed';
    }
    await refresh();
    return 'ok';
  }

  async function disconnect(provider: BrainProvider): Promise<void> {
    await api.del(`/providers/${provider}`);
    await refresh();
  }

  /** OpenRouter's own consent page. The key arrives at the API, not here. */
  async function signInOpenRouter(): Promise<void> {
    const { url } = await api.post<{ url: string }>('/providers/openrouter/connect');
    await openExternal(url);
  }

  return { connections, refresh, saveKey, disconnect, signInOpenRouter };
}
