import { watch } from 'vue';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api } from '@/lib/apiClient';
import { pendingConnections } from '@/lib/connectReturn';
import { isTauri } from '@/lib/platform';
import { useAuthStore } from '@/stores/auth';

interface GoogleStatus {
  configured: boolean;
  accounts: { email: string; needs_reconnect: boolean }[];
}

/** Set before leaving, so closing Google's screen never turns into a redirect loop. */
const triedKey = (userId: string) => `kwami:google-auto-connect:${userId}`;

function alreadyTried(userId: string): boolean {
  try {
    return localStorage.getItem(triedKey(userId)) !== null;
  } catch {
    return true; // Without storage there is no way to stop at one try.
  }
}

async function connectIfMissing(userId: string): Promise<void> {
  const status = await api.get<GoogleStatus>('/google/status');
  if (!status.configured) return;
  if (status.accounts.length > 0 && !status.accounts.some((a) => a.needs_reconnect)) {
    // Working again: the next time it expires may send them back once more.
    localStorage.removeItem(triedKey(userId));
    return;
  }
  // On the web, nobody is asked for their mail until they choose to connect it.
  if (status.accounts.length === 0 && !isTauri()) return;
  if (alreadyTried(userId) || pendingConnections.value.length > 0) return;
  localStorage.setItem(triedKey(userId), new Date().toISOString());
  const { url } = await api.post<{ url: string }>('/google/connect', { desktop: isTauri() });
  if (isTauri()) await openUrl(url);
  else window.location.assign(url);
}

/** Signing in is the only step: Google's own screen follows, once. Call once, from the auth guard. */
export function useAutoConnectGoogle(): void {
  const authStore = useAuthStore();
  watch(
    () => authStore.userId,
    (userId) => {
      if (userId) connectIfMissing(userId).catch(() => undefined);
    },
    { immediate: true },
  );
}
