<script setup lang="ts">
/**
 * Wallet sign-in, matching the email / phone forms' density.
 *
 * ProviderButton is a single pill — fine for a third OAuth option under Google,
 * empty as the whole Web3 tab. These cards carry the chain, whether the
 * extension is actually injected, and an install path when it is not.
 */
import { onMounted, onUnmounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWeb3SignIn, type Web3Wallet } from '@/composables/useWeb3SignIn';
import { enabledWeb3Providers } from './providers';
import type { ProviderDef } from './providers';

const { t } = useI18n();
const { signIn, isAvailable, isLoading, error, installUrl } = useWeb3SignIn();

const detected = reactive<Record<string, boolean>>({});

function refreshDetected() {
  for (const provider of enabledWeb3Providers) {
    detected[provider.id] = isAvailable(provider.id as Web3Wallet);
  }
}

function onChoose(provider: ProviderDef) {
  void signIn(provider.id as Web3Wallet);
}

let detectTimer: number | null = null;

onMounted(() => {
  refreshDetected();
  window.addEventListener('focus', refreshDetected);
  // Extensions inject after first paint; a short poll catches that without
  // leaving the card stuck on "Not installed" for a wallet that is present.
  detectTimer = window.setInterval(refreshDetected, 1500);
});

onUnmounted(() => {
  window.removeEventListener('focus', refreshDetected);
  if (detectTimer !== null) window.clearInterval(detectTimer);
});
</script>

<template>
  <div class="web3-auth" role="group" :aria-label="t('auth.web3FormLabel')">
    <p class="web3-auth__hint">{{ t('auth.web3Hint') }}</p>

    <div class="wallet-list">
      <button
        v-for="provider in enabledWeb3Providers"
        :key="provider.id"
        type="button"
        class="wallet-card"
        :class="[`wallet-card--${provider.id}`, { 'wallet-card--ready': detected[provider.id] }]"
        :aria-label="t('auth.continueWith', { provider: t(provider.labelKey) })"
        :disabled="isLoading"
        @click="onChoose(provider)"
      >
        <span class="wallet-card__icon" aria-hidden="true">
          <svg
            v-if="provider.id === 'phantom'"
            class="wallet-card__mark"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2c5.2 0 9 3.7 9 9.2 0 4.1-1.6 6.8-3.2 8.7-.5.6-1.4.3-1.4-.5v-2.2c0-1.4-1.1-2.5-2.4-2.5H10c-1.3 0-2.4 1.1-2.4 2.5v2.2c0 .8-.9 1.1-1.4.5C4.6 18 3 15.3 3 11.2 3 5.7 6.8 2 12 2zm-3.2 8.2a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zm6.4 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z"
            />
          </svg>
          <svg
            v-else-if="provider.id === 'metamask'"
            class="wallet-card__mark"
            viewBox="0 0 24 24"
          >
            <path fill="#E2761B" d="M4.6 4.2 11.8 9l-1.3 3.2-6.8-1.6 1-6.4zm14.8 0 1 6.4-6.8 1.6L12.2 9l7.2-4.8zM8.4 14.2l1.6 5.6L7 21.8l1.4-7.6zm7.2 0L17 21.8l-3-2-1.6-5.6z" />
            <path fill="#F5AE31" d="m8.4 14.2 3.6 1.1 3.6-1.1-1.5 3.2H9.9z" />
          </svg>
          <iconify-icon v-else :icon="provider.icon" />
        </span>
        <span class="wallet-card__copy">
          <span class="wallet-card__name">{{ t(provider.labelKey) }}</span>
          <span class="wallet-card__meta">
            <span class="wallet-card__chain">{{ t(provider.chainKey ?? 'auth.tabWeb3') }}</span>
            <span class="wallet-card__dot" aria-hidden="true" />
            <span :class="detected[provider.id] ? 'wallet-card__ok' : 'wallet-card__miss'">
              {{ detected[provider.id] ? t('auth.walletDetected') : t('auth.walletMissing') }}
            </span>
          </span>
        </span>
        <span class="wallet-card__action">
          {{
            detected[provider.id]
              ? t('auth.continue')
              : t('auth.walletInstall', { wallet: t(provider.labelKey) })
          }}
        </span>
      </button>
    </div>

    <p v-if="error" class="provider-error" role="alert">{{ error }}</p>
    <a
      v-if="installUrl"
      class="provider-install"
      :href="installUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t('auth.walletInstallOpen') }}
    </a>

    <p class="web3-auth__note">{{ t('auth.web3Note') }}</p>
  </div>
</template>

<style scoped>
.web3-auth {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.web3-auth__hint,
.web3-auth__note {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
  color: var(--auth-text-dim);
}

.web3-auth__hint {
  margin-bottom: 0.1rem;
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.wallet-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.78rem 0.9rem;
  border-radius: 16px;
  border: 1px solid var(--auth-field-border);
  background: var(--auth-field-bg);
  color: var(--auth-field-text);
  text-align: left;
  cursor: pointer;
  transition:
    background 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.wallet-card:hover:not(:disabled) {
  background: var(--auth-field-bg-hover);
  border-color: var(--auth-field-border-hover);
  transform: translateY(-1px);
}

.wallet-card:disabled {
  cursor: default;
  opacity: 0.7;
}

.wallet-card--phantom.wallet-card--ready {
  border-color: var(--auth-phantom-border);
  background: linear-gradient(135deg, rgba(53, 158, 238, 0.22), rgba(75, 70, 200, 0.16));
}

.wallet-card--metamask.wallet-card--ready {
  border-color: rgba(246, 133, 27, 0.5);
  background: linear-gradient(135deg, rgba(246, 133, 27, 0.18), rgba(228, 89, 17, 0.12));
}

.wallet-card__icon {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #c4b5fd;
}

.wallet-card--metamask .wallet-card__icon {
  color: #e2761b;
}

.wallet-card__mark {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}

.wallet-card__icon iconify-icon {
  font-size: 1.2rem;
}

.wallet-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.wallet-card__name {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.wallet-card__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--auth-text-dim);
}

.wallet-card__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
}

.wallet-card__ok {
  color: #03cea4;
}

.wallet-card__miss {
  color: var(--auth-text-dim);
}

.wallet-card__action {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--auth-text);
  white-space: nowrap;
}

.provider-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger, #ef4444);
  text-align: center;
}

.provider-install {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  color: var(--auth-text);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
