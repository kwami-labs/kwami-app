<script setup lang="ts">
/**
 * Phone + SMS OTP sign-in.
 *
 * Same form contract as EmailAuthForm: a real <form>, novalidate so our copy
 * owns validation, Enter submits, and browsers can autofill `tel` / the SMS
 * one-time-code.
 */
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { usePhoneAuth } from '@/composables/usePhoneAuth';

const { t } = useI18n();
const {
  step,
  phone,
  otp,
  isLoading,
  error,
  notice,
  resendIn,
  canResend,
  submitLabel,
  busyLabel,
  submit,
  resend,
  changePhone,
} = usePhoneAuth();
</script>

<template>
  <form
    class="phone-auth"
    novalidate
    :aria-label="t('auth.phoneFormLabel')"
    @submit.prevent="submit"
  >
    <p class="phone-auth__hint">{{ t('auth.phoneHint') }}</p>

    <BaseInput
      v-if="step === 'phone'"
      v-model="phone"
      type="tel"
      block
      autocomplete="tel"
      name="phone"
      inputmode="tel"
      :label="t('auth.phone')"
      :placeholder="t('auth.phonePlaceholder')"
      :disabled="isLoading"
    />

    <template v-else>
      <BaseInput
        v-model="otp"
        type="text"
        block
        autocomplete="one-time-code"
        name="otp"
        inputmode="numeric"
        maxlength="6"
        :label="t('auth.otp')"
        :placeholder="t('auth.otpPlaceholder')"
        :disabled="isLoading"
      />
      <button
        type="button"
        class="phone-auth__change"
        :disabled="isLoading"
        @click="changePhone"
      >
        {{ t('auth.changePhone') }}
      </button>
    </template>

    <p v-if="error" class="phone-auth__error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="phone-auth__notice" role="status">{{ notice }}</p>

    <BaseButton type="submit" variant="primary" block :loading="isLoading">
      {{ isLoading ? busyLabel : submitLabel }}
    </BaseButton>

    <p v-if="step === 'otp'" class="phone-auth__resend">
      <button
        v-if="canResend"
        type="button"
        class="phone-auth__resend-btn"
        @click="resend"
      >
        {{ t('auth.resendCode') }}
      </button>
      <span v-else>{{ t('auth.resendCodeIn', { seconds: resendIn }) }}</span>
    </p>
  </form>
</template>

<style scoped>
.phone-auth {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.phone-auth__hint {
  margin: 0 0 0.15rem;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
  color: var(--auth-text-dim);
}

.phone-auth__error,
.phone-auth__notice {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.phone-auth__error {
  color: var(--error, #ef4444);
}

.phone-auth__notice {
  color: var(--accent-primary, #359eee);
}

.phone-auth__change,
.phone-auth__resend-btn {
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--auth-text);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.phone-auth__change {
  align-self: center;
}

.phone-auth__change:disabled {
  cursor: default;
  opacity: 0.6;
}

.phone-auth__resend {
  margin: 0.15rem 0 0;
  font-size: 12px;
  text-align: center;
  color: var(--auth-text-dim);
}
</style>
