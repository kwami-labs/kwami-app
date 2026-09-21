/**
 * Email + password sign-in and sign-up.
 *
 * The landing page offered OAuth and wallets only, while the i18n bundles
 * already carried a full set of email/password strings — the form itself was
 * never built. This is that form's logic, kept out of the component so the
 * validation and error mapping are unit-testable without mounting anything.
 *
 * Supabase drives the session: a successful call fires `onAuthStateChange`,
 * which the auth store already listens to, so nothing here touches the store.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type EmailAuthMode = 'signIn' | 'signUp';

/** Supabase's own default minimum; the i18n strings promise the same number. */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Deliberately permissive. The authoritative check is the confirmation mail;
 * a stricter pattern here only rejects addresses that are in fact deliverable.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useEmailAuth() {
  const { t } = useI18n();

  const mode = ref<EmailAuthMode>('signIn');
  const email = ref('');
  const password = ref('');
  const confirmPassword = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  /** Non-error outcome that still leaves the user signed out, e.g. "confirm your email". */
  const notice = ref<string | null>(null);

  const isSignUp = computed(() => mode.value === 'signUp');
  const submitLabel = computed(() => (isSignUp.value ? t('auth.signUp') : t('auth.signIn')));
  const busyLabel = computed(() => (isSignUp.value ? t('auth.signingUp') : t('auth.signingIn')));

  function setMode(next: EmailAuthMode) {
    if (mode.value === next) return;
    mode.value = next;
    // Errors belong to the mode that produced them: "invalid credentials" makes
    // no sense still sitting above a sign-up form.
    error.value = null;
    notice.value = null;
    confirmPassword.value = '';
  }

  function toggleMode() {
    setMode(isSignUp.value ? 'signIn' : 'signUp');
  }

  /** Returns a translated message, or null when the input is usable. */
  function validate(): string | null {
    if (!EMAIL_PATTERN.test(email.value.trim())) return t('auth.invalidEmail');
    if (password.value.length < MIN_PASSWORD_LENGTH) return t('auth.passwordTooShort');
    if (isSignUp.value && password.value !== confirmPassword.value) {
      return t('auth.passwordsDoNotMatch');
    }
    return null;
  }

  /**
   * Maps a GoTrue failure onto a message worth showing.
   *
   * `code` is the stable identifier; the message match is a fallback for older
   * gotrue responses that predate it.
   */
  function mapError(authError: AuthError): string {
    const code = (authError as AuthError & { code?: string }).code ?? '';
    const message = authError.message.toLowerCase();

    if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
      return t('auth.emailNotConfirmed');
    }
    if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
      return t('auth.invalidCredentialsSuggestSignup');
    }
    if (code === 'user_already_exists' || message.includes('already registered')) {
      return t('auth.accountExists');
    }
    if (code === 'weak_password') return t('auth.passwordTooShort');

    // Rate limits and provider-disabled errors carry text worth reading verbatim.
    return authError.message || (isSignUp.value ? t('auth.failedSignUp') : t('auth.failedSignIn'));
  }

  async function runSignUp() {
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      error.value = mapError(authError);
      return;
    }

    // With email-confirmation enabled, signing up an address that already has a
    // confirmed account returns a fake user with no identities instead of an
    // error — Supabase's enumeration protection. Surfacing it costs that
    // protection but saves the user waiting for a mail that never arrives;
    // drop this branch to fall back to the neutral "check your email" notice.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      // setMode clears error/notice, so switch first and explain second —
      // otherwise the user is bounced to sign-in with no reason given.
      setMode('signIn');
      error.value = t('auth.accountExists');
      return;
    }

    // No session means a confirmation link is on its way; with confirmations
    // off, the session arrives now and onAuthStateChange dismisses the form.
    if (!data.session) notice.value = t('auth.confirmByEmail');
  }

  async function runSignIn() {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    });

    if (authError) error.value = mapError(authError);
  }

  async function submit() {
    if (isLoading.value) return;

    error.value = null;
    notice.value = null;

    const invalid = validate();
    if (invalid) {
      error.value = invalid;
      return;
    }

    isLoading.value = true;
    try {
      if (isSignUp.value) await runSignUp();
      else await runSignIn();
    } catch (e: unknown) {
      console.error('Email auth error:', e);
      error.value = e instanceof Error ? e.message : t('auth.failedSignIn');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    mode,
    email,
    password,
    confirmPassword,
    isLoading,
    error,
    notice,
    isSignUp,
    submitLabel,
    busyLabel,
    setMode,
    toggleMode,
    validate,
    submit,
  };
}
