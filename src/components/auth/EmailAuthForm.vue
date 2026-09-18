<script setup lang="ts">
/**
 * Email + password sign-in / sign-up.
 *
 * A real <form> rather than a pile of buttons: Enter submits, browsers offer
 * password-manager autofill, and the autocomplete hints tell them whether they
 * are saving a new credential or filling an existing one.
 *
 * `novalidate` is deliberate. `type="email"` still earns the right mobile
 * keyboard, but the browser's own validation bubble would block submit before
 * our checks ever run, and would arrive in the browser's language and styling
 * while the password-length error arrives in ours. One validation path, one
 * look, one language.
 */
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useEmailAuth } from '@/composables/useEmailAuth';

const { t } = useI18n();
const {
  email,
  password,
  confirmPassword,
  isLoading,
  error,
  notice,
  isSignUp,
  submitLabel,
  busyLabel,
  toggleMode,
  submit,
} = useEmailAuth();
</script>

<template>
  <form
    class="email-auth"
    novalidate
    :aria-label="t('auth.emailFormLabel')"
    @submit.prevent="submit"
  >
    <BaseInput
      v-model="email"
      type="email"
      block
      autocomplete="email"
      name="email"
      :label="t('auth.email')"
      :placeholder="t('auth.emailPlaceholder')"
      :disabled="isLoading"
    />

    <BaseInput
      v-model="password"
      type="password"
      block
      :autocomplete="isSignUp ? 'new-password' : 'current-password'"
      name="password"
      :label="t('auth.password')"
      :placeholder="isSignUp ? t('auth.passwordMinPlaceholder') : t('auth.passwordPlaceholder')"
      :disabled="isLoading"
    />

    <BaseInput
      v-if="isSignUp"
      v-model="confirmPassword"
      type="password"
      block
      autocomplete="new-password"
      name="confirmPassword"
      :label="t('auth.confirmPassword')"
      :placeholder="t('auth.confirmPasswordPlaceholder')"
      :disabled="isLoading"
    />

    <p v-if="error" class="email-auth__error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="email-auth__notice" role="status">{{ notice }}</p>

    <!-- The spinner alone does not say which request is in flight; naming it
         also gives screen readers the state change. -->
    <BaseButton type="submit" variant="primary" block :loading="isLoading">
      {{ isLoading ? busyLabel : submitLabel }}
    </BaseButton>

    <p class="email-auth__switch">
      {{ isSignUp ? t('auth.alreadyHaveAccount') : t('auth.noAccount') }}
      <button type="button" class="email-auth__switch-btn" :disabled="isLoading" @click="toggleMode">
        {{ isSignUp ? t('auth.signIn') : t('auth.signUp') }}
      </button>
    </p>
  </form>
</template>

<style scoped>
.email-auth {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.email-auth__error,
.email-auth__notice {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.email-auth__error {
  color: var(--error, #ef4444);
}

.email-auth__notice {
  color: var(--accent-primary, #359eee);
}

.email-auth__switch {
  margin: 0.15rem 0 0;
  font-size: 12px;
  text-align: center;
  color: rgba(194, 203, 227, 0.72);
}

.email-auth__switch-btn {
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: rgba(248, 252, 255, 0.95);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.email-auth__switch-btn:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
