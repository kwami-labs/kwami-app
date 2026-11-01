import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { exchangeCodeForSession } },
}));

import {
  AUTH_CALLBACK_EVENT,
  authRedirectUrl,
  handleAuthCallback,
  type AuthCallbackDetail,
} from '../../src/lib/desktopAuth';

function captureCallbacks() {
  const seen: AuthCallbackDetail[] = [];
  window.addEventListener(AUTH_CALLBACK_EVENT, (e) =>
    seen.push((e as CustomEvent<AuthCallbackDetail>).detail),
  );
  return seen;
}

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  sessionStorage.clear();
});

describe('handleAuthCallback', () => {
  it('exchanges the PKCE code from kwami://auth/callback', async () => {
    const seen = captureCallbacks();

    await handleAuthCallback('kwami://auth/callback?code=abc123');

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(seen.at(-1)).toEqual({});
  });

  it('reports the provider error instead of exchanging', async () => {
    const seen = captureCallbacks();

    await handleAuthCallback(
      'kwami://auth/callback#error=access_denied&error_description=User%20cancelled',
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(seen.at(-1)).toEqual({ error: 'User cancelled' });
  });

  it('surfaces a failed exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid flow state' } });
    const seen = captureCallbacks();

    await handleAuthCallback('kwami://auth/callback?code=stale');

    expect(seen.at(-1)).toEqual({ error: 'invalid flow state' });
  });

  it('does not replay a code it already redeemed', async () => {
    await handleAuthCallback('kwami://auth/callback?code=once');
    await handleAuthCallback('kwami://auth/callback?code=once');

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('ignores other kwami:// routes and foreign schemes', async () => {
    await handleAuthCallback('kwami://settings?code=abc');
    await handleAuthCallback('https://auth/callback?code=abc');
    await handleAuthCallback('not a url');

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('authRedirectUrl', () => {
  it('keeps the web origin outside Tauri', () => {
    expect(authRedirectUrl()).toBe(window.location.origin);
  });

  it('uses the deep link inside Tauri', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    try {
      expect(authRedirectUrl()).toBe('kwami://auth/callback');
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });
});
