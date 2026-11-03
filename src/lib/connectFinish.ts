import { api, ApiError } from '@/lib/apiClient';
import type { ConnectReturn } from '@/lib/connectReturn';

export type ConnectResult = 'ok' | 'wrong-user' | 'failed';

/** Window event fired once a connection is finished; `detail` is the provider. */
export const CONNECT_DONE_EVENT = 'kwami-connect-done';

const COMPLETE_PATHS: Record<ConnectReturn['provider'], string> = {
  google: '/google/complete',
  openrouter: '/providers/openrouter/complete',
};

export async function finishConnection(found: ConnectReturn): Promise<ConnectResult> {
  try {
    await api.post(COMPLETE_PATHS[found.provider], { state: found.state, code: found.grant });
  } catch (e) {
    return e instanceof ApiError && e.status === 403 ? 'wrong-user' : 'failed';
  }
  window.dispatchEvent(new CustomEvent(CONNECT_DONE_EVENT, { detail: found.provider }));
  return 'ok';
}
