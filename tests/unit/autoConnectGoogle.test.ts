import { flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, openUrl, tauri, auth } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  openUrl: vi.fn(),
  tauri: { value: true },
  auth: { userId: null as string | null },
}));
vi.mock('@/lib/apiClient', () => ({ api: { get, post } }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));
vi.mock('@/lib/platform', () => ({ isTauri: () => tauri.value }));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }));

const authState = reactive(auth);

import { useAutoConnectGoogle } from '../../src/composables/useAutoConnectGoogle';
import { pendingConnections } from '../../src/lib/connectReturn';

const CONSENT = 'https://accounts.google.com/o/oauth2/auth?x=1';
const missing = { configured: true, accounts: [] };
const healthy = { configured: true, accounts: [{ email: 'a@b.c', needs_reconnect: false }] };

async function signIn() {
  authState.userId = 'u1';
  useAutoConnectGoogle();
  await flushPromises();
}

beforeEach(() => {
  get.mockReset().mockResolvedValue(missing);
  post.mockReset().mockResolvedValue({ url: CONSENT });
  openUrl.mockReset().mockResolvedValue(undefined);
  tauri.value = true;
  authState.userId = null;
  pendingConnections.value = [];
  localStorage.clear();
});

describe('useAutoConnectGoogle', () => {
  it('does nothing until someone is signed in', async () => {
    useAutoConnectGoogle();
    await flushPromises();
    expect(get).not.toHaveBeenCalled();
  });

  it('opens Google in the system browser on desktop', async () => {
    await signIn();
    expect(post).toHaveBeenCalledWith('/google/connect', { desktop: true });
    expect(openUrl).toHaveBeenCalledWith(CONSENT);
  });

  it('goes only once, even if they closed the screen', async () => {
    await signIn();
    await signIn();
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it('leaves a working account alone', async () => {
    get.mockResolvedValue(healthy);
    await signIn();
    expect(post).not.toHaveBeenCalled();
  });

  it('goes back once when the connection expired', async () => {
    get.mockResolvedValue({
      configured: true,
      accounts: [{ email: 'a@b.c', needs_reconnect: true }],
    });
    await signIn();
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it('can go again after it worked and later expired', async () => {
    await signIn();
    get.mockResolvedValue(healthy);
    await signIn();
    get.mockResolvedValue(missing);
    await signIn();
    expect(openUrl).toHaveBeenCalledTimes(2);
  });

  it('stays put when Google is not configured here', async () => {
    get.mockResolvedValue({ configured: false, accounts: [] });
    await signIn();
    expect(post).not.toHaveBeenCalled();
  });

  it('does not interrupt a connection that is being finished', async () => {
    pendingConnections.value = [{ provider: 'google', state: 's', grant: 'g' }];
    await signIn();
    expect(post).not.toHaveBeenCalled();
  });

  it('never breaks the app when the API is down', async () => {
    get.mockRejectedValue(new Error('down'));
    await expect(signIn()).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
});
