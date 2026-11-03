import { nextTick, reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, success, error, auth } = vi.hoisted(() => ({
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  auth: { isAuthenticated: false },
}));
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {
    constructor(public status: number) {
      super('api');
    }
  }
  return { api: { post }, ApiError };
});
vi.mock('vue-toastification', () => ({ useToast: () => ({ success, error }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }));

const authState = reactive(auth);

import { ApiError } from '@/lib/apiClient';
import { useConnectReturn } from '../../src/composables/useConnectReturn';
import { CONNECT_DONE_EVENT, finishConnection } from '../../src/lib/connectFinish';
import {
  connectReturnFromDeepLink,
  parseConnectFragment,
  pendingConnections,
  queueConnectReturn,
  takeConnectReturnFromLocation,
} from '../../src/lib/connectReturn';

const FOUND = { provider: 'google', state: 's', grant: 'g' } as const;
const refused = (status: number) =>
  new (ApiError as unknown as new (status: number) => Error)(status);

beforeEach(() => {
  post.mockReset().mockResolvedValue({});
  success.mockReset();
  error.mockReset();
  authState.isAuthenticated = false;
  pendingConnections.value = [];
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('parseConnectFragment', () => {
  it('reads what the API passes on', () => {
    expect(parseConnectFragment('#connect=google&state=s&grant=g')).toEqual(FOUND);
  });

  it('keeps what was encoded', () => {
    expect(parseConnectFragment('connect=openrouter&state=a%3D&grant=c%26d')).toEqual({
      provider: 'openrouter',
      state: 'a=',
      grant: 'c&d',
    });
  });

  it.each([
    '',
    '#access_token=x',
    '#connect=evil&state=s&grant=g',
    '#connect=google&state=s',
    '#connect=google&grant=g',
  ])('ignores %s', (fragment) => {
    expect(parseConnectFragment(fragment)).toBeNull();
  });
});

describe('takeConnectReturnFromLocation', () => {
  it('takes the result out of the address', () => {
    window.location.hash = '#connect=google&state=s&grant=g';
    expect(takeConnectReturnFromLocation()).toEqual(FOUND);
    expect(window.location.hash).toBe('');
  });

  it("leaves someone else's fragment alone", () => {
    window.location.hash = '#access_token=x';
    expect(takeConnectReturnFromLocation()).toBeNull();
    expect(window.location.hash).toBe('#access_token=x');
  });
});

describe('connectReturnFromDeepLink', () => {
  it('reads the desktop link', () => {
    expect(
      connectReturnFromDeepLink('kwami://connect/callback#connect=google&state=s&grant=g'),
    ).toEqual(FOUND);
  });

  it.each([
    'kwami://auth/callback?code=abc',
    'https://connect/callback#connect=google&state=s&grant=g',
    'not a url',
  ])('ignores %s', (raw) => {
    expect(connectReturnFromDeepLink(raw)).toBeNull();
  });
});

describe('queueConnectReturn', () => {
  it('does not replay a link the app already took', () => {
    queueConnectReturn(FOUND);
    queueConnectReturn(FOUND);
    expect(pendingConnections.value).toHaveLength(1);
  });
});

describe('finishConnection', () => {
  it('finishes through the signed-in API, and says so', async () => {
    const done: string[] = [];
    const listener = (e: Event) => done.push((e as CustomEvent<string>).detail);
    window.addEventListener(CONNECT_DONE_EVENT, listener);

    expect(await finishConnection(FOUND)).toBe('ok');

    window.removeEventListener(CONNECT_DONE_EVENT, listener);
    expect(post).toHaveBeenCalledWith('/google/complete', { state: 's', code: 'g' });
    expect(done).toEqual(['google']);
  });

  it('sends OpenRouter to its own route', async () => {
    await finishConnection({ ...FOUND, provider: 'openrouter' });
    expect(post.mock.calls[0]?.[0]).toBe('/providers/openrouter/complete');
  });

  it('tells apart a link someone else started', async () => {
    post.mockRejectedValue(refused(403));
    expect(await finishConnection(FOUND)).toBe('wrong-user');
  });

  it('reports any other failure', async () => {
    post.mockRejectedValue(new Error('down'));
    expect(await finishConnection(FOUND)).toBe('failed');
  });
});

describe('useConnectReturn', () => {
  const settled = async () => {
    await nextTick();
    await vi.waitFor(() => expect(pendingConnections.value).toHaveLength(0));
    await nextTick();
    await Promise.resolve();
  };

  it('waits for someone to be signed in', async () => {
    queueConnectReturn(FOUND);
    useConnectReturn();
    await nextTick();
    expect(post).not.toHaveBeenCalled();

    authState.isAuthenticated = true;
    await settled();
    expect(post).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(success).toHaveBeenCalledWith('assistant.connectDone'));
  });

  it('says when the link was someone else', async () => {
    post.mockRejectedValue(refused(403));
    authState.isAuthenticated = true;
    useConnectReturn();
    queueConnectReturn(FOUND);
    await settled();
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('assistant.connectWrongUser'));
  });

  it('says when it could not finish', async () => {
    post.mockRejectedValue(new Error('down'));
    authState.isAuthenticated = true;
    useConnectReturn();
    queueConnectReturn(FOUND);
    await settled();
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('assistant.connectFailed'));
  });
});
