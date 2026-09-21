import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import type { AuthError } from '@supabase/supabase-js';
import { normalizePhone, usePhoneAuth } from '../../src/composables/usePhoneAuth';
import { en } from '../../src/i18n/translations/en';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signInWithOtp = vi.mocked(supabase.auth.signInWithOtp);
const verifyOtp = vi.mocked(supabase.auth.verifyOtp);

function harness() {
  const Host = defineComponent({
    setup: () => ({ auth: usePhoneAuth() }),
    template: '<div />',
  });
  return mount(Host).vm.auth;
}

function authError(code: string, message: string) {
  return { code, message, name: 'AuthApiError', status: 400 } as unknown as AuthError;
}

const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
  signInWithOtp.mockResolvedValue(ok({}) as never);
  verifyOtp.mockResolvedValue(ok({ user: {}, session: {} }) as never);
});

describe('normalizePhone', () => {
  it('turns decorated national input into E.164', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('returns empty when there are no digits', () => {
    expect(normalizePhone('   ')).toBe('');
    expect(normalizePhone('+')).toBe('');
  });
});

describe('usePhoneAuth send', () => {
  it('rejects a number that is not E.164 before calling Supabase', async () => {
    const auth = harness();
    auth.phone.value = '555-1234';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.invalidPhone);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends a trimmed E.164 number and moves to the OTP step', async () => {
    const auth = harness();
    auth.phone.value = ' +1 (555) 123-4567 ';

    await auth.submit();

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: '+15551234567',
      options: { shouldCreateUser: true, channel: 'sms' },
    });
    expect(auth.step.value).toBe('otp');
    expect(auth.phone.value).toBe('+15551234567');
    expect(auth.notice.value).toBe(en.auth.codeSent.replace('{phone}', '+15551234567'));
    expect(auth.resendIn.value).toBe(60);
  });

  it('surfaces a rate-limit as the wait-and-retry copy', async () => {
    signInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('over_sms_send_rate_limit', 'SMS rate limit exceeded'),
    } as never);
    const auth = harness();
    auth.phone.value = '+15551234567';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.smsRateLimit);
    expect(auth.step.value).toBe('phone');
  });

  it('does not re-enter while a request is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    signInWithOtp.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const auth = harness();
    auth.phone.value = '+15551234567';

    const first = auth.submit();
    await auth.submit();
    release(ok({}));
    await first;

    expect(signInWithOtp).toHaveBeenCalledOnce();
  });
});

describe('usePhoneAuth verify', () => {
  async function reachOtp(auth: ReturnType<typeof harness>) {
    auth.phone.value = '+15551234567';
    await auth.submit();
    auth.error.value = null;
    auth.notice.value = null;
  }

  it('rejects a short code before calling verify', async () => {
    const auth = harness();
    await reachOtp(auth);
    auth.otp.value = '123';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.invalidOtp);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies the six-digit token against the same phone', async () => {
    const auth = harness();
    await reachOtp(auth);
    auth.otp.value = '123 456';

    await auth.submit();

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+15551234567',
      token: '123456',
      type: 'sms',
    });
  });

  it('maps an expired OTP onto the request-a-new-one copy', async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('otp_expired', 'OTP has expired'),
    } as never);
    const auth = harness();
    await reachOtp(auth);
    auth.otp.value = '123456';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.otpExpired);
  });

  it('maps an invalid token onto the check-and-retry copy', async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('otp_disabled', 'Token has expired or is invalid'),
    } as never);
    const auth = harness();
    await reachOtp(auth);
    auth.otp.value = '000000';

    await auth.submit();

    expect(auth.error.value).toBe(en.auth.otpInvalid);
  });
});

describe('usePhoneAuth navigation', () => {
  it('returns to the phone step and clears the code', async () => {
    const auth = harness();
    auth.phone.value = '+15551234567';
    await auth.submit();
    auth.otp.value = '123456';
    auth.error.value = 'stale';

    auth.changePhone();

    expect(auth.step.value).toBe('phone');
    expect(auth.otp.value).toBe('');
    expect(auth.error.value).toBeNull();
    expect(auth.resendIn.value).toBe(0);
  });

  it('blocks resend until the cooldown elapses', async () => {
    const auth = harness();
    auth.phone.value = '+15551234567';
    await auth.submit();
    signInWithOtp.mockClear();

    await auth.resend();

    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(auth.canResend.value).toBe(false);
  });
});
