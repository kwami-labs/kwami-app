import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import type { AuthError } from '@supabase/supabase-js';
import { useEmailAuth } from '../../src/composables/useEmailAuth';
import { en } from '../../src/i18n/translations/en';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: vi.fn(), signInWithPassword: vi.fn() } },
}));

// Imported after the mock so this is the mocked client.
const { supabase } = await import('@/lib/supabase');
const signUp = vi.mocked(supabase.auth.signUp);
const signInWithPassword = vi.mocked(supabase.auth.signInWithPassword);

/** Mounts the composable in a throwaway component so useI18n has an app context. */
function harness() {
  const Host = defineComponent({
    setup: () => ({ auth: useEmailAuth() }),
    template: '<div />',
  });
  return mount(Host).vm.auth;
}

/** A GoTrue failure, reduced to the two fields mapError actually reads. */
function authError(code: string, message: string) {
  return { code, message, name: 'AuthApiError', status: 400 } as unknown as AuthError;
}

const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  signUp.mockReset();
  signInWithPassword.mockReset();
  signUp.mockResolvedValue(ok({ user: { identities: [{ provider: 'email' }] }, session: {} }) as never);
  signInWithPassword.mockResolvedValue(ok({ user: {}, session: {} }) as never);
});

describe('useEmailAuth validation', () => {
  it('rejects a malformed email before calling Supabase', async () => {
    const auth = harness();
    auth.email.value = 'not-an-email';
    auth.password.value = 'hunter2';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.invalidEmail);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects a password under the minimum length', async () => {
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'short';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.passwordTooShort);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects a sign-up whose confirmation does not match', async () => {
    const auth = harness();
    auth.setMode('signUp');
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'hunter3';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.passwordsDoNotMatch);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('ignores the mismatch rule when signing in', async () => {
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'stale';

    await auth.submit();

    expect(auth.error.value).toBeNull();
    expect(signInWithPassword).toHaveBeenCalledOnce();
  });
});

describe('useEmailAuth sign in', () => {
  it('submits the trimmed email and the password verbatim', async () => {
    const auth = harness();
    auth.email.value = '  ada@kwami.io  ';
    auth.password.value = ' hunter2 ';

    await auth.submit();

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@kwami.io',
      password: ' hunter2 ',
    });
  });

  it('turns invalid_credentials into the sign-up suggestion', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('invalid_credentials', 'Invalid login credentials'),
    } as never);
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.invalidCredentialsSuggestSignup);
  });

  it('turns email_not_confirmed into the confirm-your-email message', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('email_not_confirmed', 'Email not confirmed'),
    } as never);
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.emailNotConfirmed);
  });

  it('falls back to the server message for errors it does not special-case', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('over_request_rate_limit', 'Email rate limit exceeded'),
    } as never);
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    await auth.submit();

    expect(auth.error.value).toBe('Email rate limit exceeded');
  });

  it('clears the loading flag after a failure', async () => {
    signInWithPassword.mockRejectedValue(new Error('network down'));
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    await auth.submit();

    expect(auth.isLoading.value).toBe(false);
    expect(auth.error.value).toBe('network down');
  });
});

describe('useEmailAuth sign up', () => {
  it('sends emailRedirectTo so the confirmation link returns to the app', async () => {
    const auth = harness();
    auth.setMode('signUp');
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'hunter2';

    await auth.submit();

    expect(signUp).toHaveBeenCalledWith({
      email: 'ada@kwami.io',
      password: 'hunter2',
      options: { emailRedirectTo: window.location.origin },
    });
  });

  it('shows the check-your-email notice when no session comes back', async () => {
    signUp.mockResolvedValue(
      ok({ user: { identities: [{ provider: 'email' }] }, session: null }) as never,
    );
    const auth = harness();
    auth.setMode('signUp');
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'hunter2';

    await auth.submit();

    expect(auth.notice.value).toBe(en.auth.confirmByEmail);
    expect(auth.error.value).toBeNull();
  });

  it('stays quiet when a session comes back immediately', async () => {
    const auth = harness();
    auth.setMode('signUp');
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'hunter2';

    await auth.submit();

    expect(auth.notice.value).toBeNull();
    expect(auth.error.value).toBeNull();
  });

  it('reads an empty identities array as an existing account and flips to sign in', async () => {
    signUp.mockResolvedValue(ok({ user: { identities: [] }, session: null }) as never);
    const auth = harness();
    auth.setMode('signUp');
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';
    auth.confirmPassword.value = 'hunter2';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.accountExists);
    expect(auth.mode.value).toBe('signIn');
    // The switch must not swallow the reason for it.
    expect(auth.notice.value).toBeNull();
  });
});

describe('useEmailAuth mode switching', () => {
  it('clears the previous mode error and the stale confirmation', () => {
    const auth = harness();
    auth.error.value = 'boom';
    auth.confirmPassword.value = 'hunter2';

    auth.toggleMode();

    expect(auth.mode.value).toBe('signUp');
    expect(auth.error.value).toBeNull();
    expect(auth.confirmPassword.value).toBe('');
  });

  it('keeps the email and password across a switch', () => {
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    auth.toggleMode();

    expect(auth.email.value).toBe('ada@kwami.io');
    expect(auth.password.value).toBe('hunter2');
  });

  it('does not re-enter while a request is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const auth = harness();
    auth.email.value = 'ada@kwami.io';
    auth.password.value = 'hunter2';

    const first = auth.submit();
    await auth.submit();
    release(ok({ user: {}, session: {} }));
    await first;

    expect(signInWithPassword).toHaveBeenCalledOnce();
  });
});
