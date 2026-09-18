/**
 * Phone-number sign-in via Supabase SMS OTP.
 *
 * There is no separate sign-up: `signInWithOtp` creates the user on first
 * verify when Phone is enabled in the project. A successful `verifyOtp` fires
 * `onAuthStateChange`, which the auth store already listens to.
 */
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type PhoneAuthStep = 'phone' | 'otp';

/** ITU-T E.164: + then 8–15 digits, first digit not 0. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const OTP_LENGTH = 6;

export const RESEND_COOLDOWN_S = 60;

/**
 * Strips decoration and guarantees a leading `+`.
 *
 * `+1 (555) 123-4567` and `15551234567` both become `+15551234567`. An empty
 * or punctuation-only string stays empty so validation can reject it.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

export function usePhoneAuth() {
  const { t } = useI18n();

  const step = ref<PhoneAuthStep>('phone');
  const phone = ref('');
  const otp = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const notice = ref<string | null>(null);
  const resendIn = ref(0);

  let resendTimer: ReturnType<typeof setInterval> | null = null;

  const normalizedPhone = computed(() => normalizePhone(phone.value));
  const canResend = computed(() => step.value === 'otp' && resendIn.value <= 0 && !isLoading.value);
  const submitLabel = computed(() =>
    step.value === 'otp' ? t('auth.verifyCode') : t('auth.sendCode'),
  );
  const busyLabel = computed(() =>
    step.value === 'otp' ? t('auth.verifyingCode') : t('auth.sendingCode'),
  );

  function clearResendTimer() {
    if (resendTimer !== null) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
  }

  function startCooldown() {
    clearResendTimer();
    resendIn.value = RESEND_COOLDOWN_S;
    resendTimer = setInterval(() => {
      resendIn.value = Math.max(0, resendIn.value - 1);
      if (resendIn.value <= 0) clearResendTimer();
    }, 1000);
  }

  function mapError(authError: AuthError, fallback: string): string {
    const code = (authError as AuthError & { code?: string }).code ?? '';
    const message = authError.message.toLowerCase();

    if (code === 'otp_expired') {
      return t('auth.otpExpired');
    }
    if (
      code === 'otp_disabled' ||
      message.includes('token has expired or is invalid') ||
      message.includes('invalid otp') ||
      message.includes('invalid token')
    ) {
      return t('auth.otpInvalid');
    }
    if (message.includes('expired')) {
      return t('auth.otpExpired');
    }
    if (
      code === 'over_sms_send_rate_limit' ||
      code === 'over_request_rate_limit' ||
      message.includes('rate limit')
    ) {
      return t('auth.smsRateLimit');
    }

    return authError.message || fallback;
  }

  function validatePhone(): string | null {
    if (!E164_PATTERN.test(normalizedPhone.value)) return t('auth.invalidPhone');
    return null;
  }

  function validateOtp(): string | null {
    const token = otp.value.replace(/\D/g, '');
    if (token.length !== OTP_LENGTH) return t('auth.invalidOtp');
    return null;
  }

  async function sendCode() {
    const invalid = validatePhone();
    if (invalid) {
      error.value = invalid;
      return;
    }

    isLoading.value = true;
    error.value = null;
    notice.value = null;
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone.value,
        options: { shouldCreateUser: true, channel: 'sms' },
      });

      if (authError) {
        error.value = mapError(authError, t('auth.failedSendCode'));
        return;
      }

      phone.value = normalizedPhone.value;
      otp.value = '';
      step.value = 'otp';
      notice.value = t('auth.codeSent', { phone: normalizedPhone.value });
      startCooldown();
    } catch (e: unknown) {
      console.error('Phone OTP send error:', e);
      error.value = e instanceof Error ? e.message : t('auth.failedSendCode');
    } finally {
      isLoading.value = false;
    }
  }

  async function verifyCode() {
    const invalid = validateOtp();
    if (invalid) {
      error.value = invalid;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone.value,
        token: otp.value.replace(/\D/g, ''),
        type: 'sms',
      });

      if (authError) error.value = mapError(authError, t('auth.failedVerifyCode'));
    } catch (e: unknown) {
      console.error('Phone OTP verify error:', e);
      error.value = e instanceof Error ? e.message : t('auth.failedVerifyCode');
    } finally {
      isLoading.value = false;
    }
  }

  async function submit() {
    if (isLoading.value) return;
    if (step.value === 'otp') await verifyCode();
    else await sendCode();
  }

  async function resend() {
    if (!canResend.value) return;
    await sendCode();
  }

  function changePhone() {
    step.value = 'phone';
    otp.value = '';
    error.value = null;
    notice.value = null;
    resendIn.value = 0;
    clearResendTimer();
  }

  onUnmounted(() => {
    clearResendTimer();
  });

  return {
    step,
    phone,
    otp,
    isLoading,
    error,
    notice,
    resendIn,
    normalizedPhone,
    canResend,
    submitLabel,
    busyLabel,
    submit,
    resend,
    changePhone,
  };
}
