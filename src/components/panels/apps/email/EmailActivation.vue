<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEmailStore } from '@/stores/email';
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';

const { t } = useI18n();
const emailStore = useEmailStore();
const authStore = useAuthStore();

const username = ref(suggestUsername());
const availabilityResult = ref<{ available: boolean; error?: string } | null>(null);
const activationError = ref('');
const activationSuccess = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function suggestUsername(): string {
  const email = authStore.userEmail || '';
  const prefix = email.split('@')[0] || '';
  return prefix.replace(/[^a-z0-9._-]/gi, '').toLowerCase().slice(0, 30);
}

const validationError = computed(() => {
  const val = username.value.toLowerCase();
  if (!val) return t('email.activation.usernameRequired');
  if (val.length < 3) return t('email.activation.usernameTooShort');
  if (val.length > 30) return t('email.activation.usernameTooLong');
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(val)) return t('email.activation.usernameInvalid');
  return '';
});

const isAvailable = computed(() => {
  if (validationError.value) return false;
  return availabilityResult.value?.available === true;
});

const canActivate = computed(
  () => !validationError.value && isAvailable.value && !emailStore.isActivating,
);

watch(username, (val) => {
  availabilityResult.value = null;
  activationError.value = '';
  if (debounceTimer) clearTimeout(debounceTimer);
  if (validationError.value) return;
  debounceTimer = setTimeout(async () => {
    availabilityResult.value = await emailStore.checkUsername(val);
  }, 400);
});

async function activate() {
  activationError.value = '';
  try {
    await emailStore.activateEmail(username.value);
    activationSuccess.value = true;
  } catch (e: unknown) {
    activationError.value =
      e instanceof Error && e.message ? e.message : t('email.activation.error');
  }
}
</script>

<template>
  <div class="activation">
    <div v-if="!activationSuccess" class="activation-form">
      <div class="activation-hero">
        <iconify-icon icon="ph:envelope-duotone" class="hero-icon"></iconify-icon>
        <h3>{{ t('email.activation.title') }}</h3>
        <p class="hero-desc">{{ t('email.activation.description') }}</p>
      </div>

      <div class="username-field">
        <label class="field-label">{{ t('email.activation.chooseUsername') }}</label>
        <div class="username-input-row">
          <input
            v-model="username"
            type="text"
            :placeholder="t('email.activation.usernamePlaceholder')"
            class="username-input"
            maxlength="30"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="domain-suffix">@kwami.io</span>
        </div>

        <div class="status-row">
          <template v-if="emailStore.isCheckingUsername">
            <iconify-icon icon="ph:spinner-gap-bold" class="spin status-icon checking"></iconify-icon>
            <span class="status-text checking">{{ t('email.activation.checking') }}</span>
          </template>
          <template v-else-if="validationError">
            <iconify-icon icon="ph:warning-circle-fill" class="status-icon error"></iconify-icon>
            <span class="status-text error">{{ validationError }}</span>
          </template>
          <template v-else-if="availabilityResult && !availabilityResult.available">
            <iconify-icon icon="ph:x-circle-fill" class="status-icon error"></iconify-icon>
            <span class="status-text error">{{ t('email.activation.usernameTaken') }}</span>
          </template>
          <template v-else-if="isAvailable">
            <iconify-icon icon="ph:check-circle-fill" class="status-icon success"></iconify-icon>
            <span class="status-text success">{{ t('email.activation.usernameAvailable') }}</span>
          </template>
        </div>
      </div>

      <div v-if="activationError" class="activation-error">
        <iconify-icon icon="ph:warning-circle-fill"></iconify-icon>
        {{ activationError }}
      </div>

      <BaseButton
        variant="primary"
        block
        :disabled="!canActivate"
        :loading="emailStore.isActivating"
        icon="ph:envelope-simple-duotone"
        @click="activate"
      >
        {{ t('email.activation.activate') }}
      </BaseButton>
    </div>

    <div v-else class="activation-success">
      <iconify-icon icon="ph:check-circle-duotone" class="success-icon"></iconify-icon>
      <h3>{{ t('email.activation.successTitle') }}</h3>
      <p class="email-address">{{ emailStore.account?.email_address }}</p>
      <p class="success-desc">{{ t('email.activation.successDescription') }}</p>
    </div>
  </div>
</template>

<style scoped>
.activation {
  padding: 20px;
  display: flex;
  flex-direction: column;
  grid-column: 1 / -1;
}

.activation-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.activation-hero {
  text-align: center;
  padding: 20px 0;
}

.hero-icon {
  font-size: 56px;
  color: var(--accent-primary);
  opacity: 0.7;
  margin-bottom: 12px;
}

.activation-hero h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.hero-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.username-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.username-input-row {
  display: flex;
  align-items: center;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--duration-fast) ease;
}

.username-input-row:focus-within {
  border-color: var(--accent-primary);
}

.username-input {
  flex: 1;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.3px;
  outline: none;
}

.username-input::placeholder {
  color: var(--text-muted);
}

.domain-suffix {
  padding: 12px 14px;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
  background: var(--surface-2);
  border-left: 1px solid var(--glass-border);
  white-space: nowrap;
  letter-spacing: -0.3px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}

.status-icon {
  font-size: 14px;
}

.status-icon.checking { color: var(--text-muted); }
.status-icon.error { color: var(--error); }
.status-icon.success { color: var(--success, #22c55e); }

.status-text {
  font-size: 11px;
  font-weight: 500;
}

.status-text.checking { color: var(--text-muted); }
.status-text.error { color: var(--error); }
.status-text.success { color: var(--success, #22c55e); }

.activation-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--error-glow, rgba(248, 113, 113, 0.1));
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--error);
}

.activation-success {
  text-align: center;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success-icon {
  font-size: 64px;
  color: var(--success, #22c55e);
}

.activation-success h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.email-address {
  font-size: 16px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-primary);
  margin: 0;
  padding: 8px 16px;
  background: var(--accent-glow);
  border-radius: var(--radius-md);
  letter-spacing: -0.3px;
}

.success-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
