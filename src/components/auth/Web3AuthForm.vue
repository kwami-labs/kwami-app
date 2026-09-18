<script setup lang="ts">
/**
 * Wallet sign-in, matching the email / phone forms' density.
 *
 * ProviderButton is a single pill — fine for a third OAuth option under Google,
 * empty as the whole Web3 tab. These cards carry the chain, whether the
 * extension is actually injected, and an install path when it is not.
 */
import { computed, onMounted, onUnmounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  requestEthereumProviders,
  useWeb3SignIn,
  type Web3Wallet,
} from '@/composables/useWeb3SignIn';
import { enabledWeb3Providers } from './providers';
import type { ProviderDef } from './providers';

const { t } = useI18n();
const { signIn, isAvailable, isHandheld, isLoading, pendingWallet, error, installLink } =
  useWeb3SignIn();

const detected = reactive<Record<string, boolean>>({});
/**
 * Resolved during setup, not on mount: a phone would otherwise paint "Install
 * Phantom" for a frame before correcting itself to "Open in Phantom". The
 * pointer does not change mid-session, so once is enough.
 */
const handheld = isHandheld();

/** Reads the current detection state without re-asking the wallets. */
function syncDetected() {
  for (const provider of enabledWeb3Providers) {
    detected[provider.id] = isAvailable(provider.id as Web3Wallet);
  }
  // Nothing left to find, so stop spending a timer on it for the rest of the
  // session. A wallet installed *while* the panel is open still lands, via the
  // focus listener when the user comes back from the store tab.
  if (enabledWeb3Providers.every((p) => detected[p.id])) stopPolling();
}

/** Asks every EVM wallet to announce itself, then reads the result. */
function refreshDetected() {
  requestEthereumProviders();
  syncDetected();
}

function isPending(provider: ProviderDef) {
  return pendingWallet.value === provider.id;
}

/**
 * What the card actually does, spelled out for the accessible name.
 *
 * It used to announce "Continue with Phantom" on a card whose only effect was
 * to open the Chrome Web Store — one action read out, a different one
 * performed.
 */
function cardLabel(provider: ProviderDef): string {
  const wallet = t(provider.labelKey);
  if (detected[provider.id]) {
    return provider.chain
      ? t('auth.connectWalletWithChain', { wallet, chain: t(provider.chainKey ?? 'auth.tabWeb3') })
      : t('auth.connectWallet', { wallet });
  }
  return handheld ? t('auth.walletOpenApp', { wallet }) : t('auth.walletInstall', { wallet });
}

/**
 * The visible chip. One or two words, and never the wallet name — it is
 * already the heading immediately to the left, and repeating it wrapped the
 * status line onto four lines at phone width.
 */
function actionLabel(provider: ProviderDef): string {
  if (detected[provider.id]) return t('auth.walletActionConnect');
  return handheld ? t('auth.walletActionOpenApp') : t('auth.walletActionInstall');
}

/** The fallback link under the list, when the pop-up was blocked. */
const fallbackLabel = computed(() => {
  const link = installLink.value;
  if (!link) return '';
  return link.mode === 'app'
    ? t('auth.walletOpenApp', {
        wallet: t(link.wallet === 'phantom' ? 'auth.providerPhantom' : 'auth.providerMetaMask'),
      })
    : t('auth.walletInstallOpen');
});

function onChoose(provider: ProviderDef) {
  void signIn(provider.id as Web3Wallet);
}

// Extensions inject after first paint; a short poll catches that without
// leaving the card stuck on "Not installed" for a wallet that is present.
const DETECT_POLL_MS = 1500;
let detectTimer: number | null = null;

function startPolling() {
  if (detectTimer !== null) return;
  detectTimer = window.setInterval(refreshDetected, DETECT_POLL_MS);
}

function stopPolling() {
  if (detectTimer === null) return;
  window.clearInterval(detectTimer);
  detectTimer = null;
}

/**
 * EIP-6963 is an announcement, not a query: a wallet can speak up at any point
 * after its content script runs. Listening means a late MetaMask flips the card
 * the moment it announces instead of up to a poll later.
 *
 * This one only reads — re-asking here would answer our own announcement and
 * spin forever.
 */
function onAnnounce() {
  syncDetected();
}

function onVisibility() {
  if (document.hidden) stopPolling();
  else {
    refreshDetected();
    startPolling();
  }
}

onMounted(() => {
  refreshDetected();
  window.addEventListener('focus', refreshDetected);
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  document.addEventListener('visibilitychange', onVisibility);
  startPolling();
});

onUnmounted(() => {
  window.removeEventListener('focus', refreshDetected);
  window.removeEventListener('eip6963:announceProvider', onAnnounce);
  document.removeEventListener('visibilitychange', onVisibility);
  stopPolling();
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
        :class="[
          `wallet-card--${provider.id}`,
          {
            'wallet-card--ready': detected[provider.id],
            'wallet-card--pending': isPending(provider),
          },
        ]"
        :aria-label="cardLabel(provider)"
        :aria-busy="isPending(provider)"
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
          <svg v-else-if="provider.id === 'metamask'" class="wallet-card__mark" viewBox="0 0 24 24">
            <path
              fill="#E2761B"
              d="M4.6 4.2 11.8 9l-1.3 3.2-6.8-1.6 1-6.4zm14.8 0 1 6.4-6.8 1.6L12.2 9l7.2-4.8zM8.4 14.2l1.6 5.6L7 21.8l1.4-7.6zm7.2 0L17 21.8l-3-2-1.6-5.6z"
            />
            <path fill="#F5AE31" d="m8.4 14.2 3.6 1.1 3.6-1.1-1.5 3.2H9.9z" />
          </svg>
          <iconify-icon v-else :icon="provider.icon" />
        </span>
        <span class="wallet-card__copy">
          <span class="wallet-card__name">{{ t(provider.labelKey) }}</span>
          <span class="wallet-card__meta">
            <template v-if="isPending(provider)">
              <span class="wallet-card__waiting">
                {{ t('auth.walletConnecting', { wallet: t(provider.labelKey) }) }}
              </span>
            </template>
            <template v-else>
              <span class="wallet-card__badge">{{ t(provider.chainKey ?? 'auth.tabWeb3') }}</span>
              <template v-if="!handheld">
                <span
                  class="wallet-card__status"
                  :class="detected[provider.id] ? 'wallet-card__ok' : 'wallet-card__miss'"
                >
                  <span class="wallet-card__pip" aria-hidden="true" />
                  {{ detected[provider.id] ? t('auth.walletDetected') : t('auth.walletMissing') }}
                </span>
              </template>
            </template>
          </span>
        </span>
        <span class="wallet-card__action">
          <span v-if="isPending(provider)" class="wallet-card__spinner" aria-hidden="true" />
          <span v-else class="wallet-card__cta">{{ actionLabel(provider) }}</span>
        </span>
      </button>
    </div>

    <p v-if="error" class="provider-error" role="alert">{{ error }}</p>
    <a
      v-if="installLink"
      class="provider-install"
      :href="installLink.href"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ fallbackLabel }}
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
  gap: 0.8rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  border-radius: 18px;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition:
    filter 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
}

.wallet-card--phantom {
  background: var(--auth-wallet-phantom-fill);
  color: var(--auth-wallet-phantom-ink);
}

.wallet-card--metamask {
  background: var(--auth-wallet-metamask-fill);
  color: var(--auth-wallet-metamask-ink);
}

.wallet-card:hover:not(:disabled) {
  transform: translateY(-1px);
}

.wallet-card--phantom:hover:not(:disabled) {
  background: var(--auth-wallet-phantom-fill-hover);
}

.wallet-card--metamask:hover:not(:disabled) {
  background: var(--auth-wallet-metamask-fill-hover);
}

.wallet-card:focus-visible {
  outline: 2px solid var(--auth-focus-ring);
  outline-offset: 2px;
}

/* One attempt at a time, but the card that is actually waiting stays lit —
   dimming all three would hide which wallet the pop-up belongs to. */
.wallet-card:disabled {
  cursor: default;
  opacity: 0.55;
}

.wallet-card--pending:disabled {
  opacity: 1;
  filter: brightness(1.06);
}

.wallet-card__icon {
  display: grid;
  place-items: center;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 14px;
  background: var(--auth-wallet-phantom-icon-bg);
  color: var(--auth-wallet-phantom-icon);
}

.wallet-card--metamask .wallet-card__icon {
  background: var(--auth-wallet-metamask-icon-bg);
  color: var(--auth-wallet-metamask-icon);
}

.wallet-card__mark {
  width: 1.4rem;
  height: 1.4rem;
  display: block;
}

.wallet-card__icon iconify-icon {
  font-size: 1.3rem;
}

.wallet-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
  overflow: hidden;
}

.wallet-card__name {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.wallet-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wallet-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: var(--auth-wallet-badge-bg);
  font-weight: 800;
}

.wallet-card__status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  opacity: 0.88;
}

/* The status was two words that read the same at a glance. The pip is what
   tells you which row is live before you have read anything. */
.wallet-card__pip {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.wallet-card__ok {
  color: var(--auth-wallet-ready);
}

.wallet-card__ok .wallet-card__pip {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-wallet-ready) 28%, transparent);
}

.wallet-card__miss {
  opacity: 0.72;
}

.wallet-card__miss .wallet-card__pip {
  background: transparent;
  border: 1px solid currentColor;
}

.wallet-card__waiting {
  font-weight: 700;
}

.wallet-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 1.1rem;
  color: inherit;
  white-space: nowrap;
}

.wallet-card__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.6rem;
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  background: var(--auth-wallet-cta-bg);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.wallet-card__spinner {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
  border-top-color: currentColor;
  animation: wallet-spin 720ms linear infinite;
}

@keyframes wallet-spin {
  to {
    transform: rotate(360deg);
  }
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

@media (prefers-reduced-motion: reduce) {
  .wallet-card,
  .wallet-card:hover:not(:disabled) {
    transition: none;
    transform: none;
  }

  /* The spinner is the only thing saying "still waiting", so it keeps moving —
     just slowly enough not to read as a flicker. */
  .wallet-card__spinner {
    animation-duration: 2.4s;
  }
}
</style>
