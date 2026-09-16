<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BasePanel from '@/components/ui/BasePanel.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { ApiError } from '@/lib/apiClient';
import { translateApiUserMessage } from '@/utils/translateApiMessage';
import { panelIcons } from '@/constants/panel-icons';
import { useWalletStore } from '@/stores/wallet';
import { useWorkspaceStore } from '@/stores/workspace';

const { t } = useI18n();
const walletStore = useWalletStore();
const workspaceStore = useWorkspaceStore();

const fundingToken = ref('USDC');
const fundingAmount = ref(25);
const addTokenMint = ref('');
const addTokenSymbol = ref('');
const addTokenDecimals = ref(6);
const addTokenStablecoin = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const tokenOptions = computed(() => walletStore.allowlist);

const tokenSelectOptions = computed(() =>
  tokenOptions.value.map((token) => ({ label: token.symbol, value: token.symbol })),
);

/**
 * settings.wallet_enabled defaults to APP_ENV != 'production', so in prod every
 * wallet call returns 503. Render that as "unavailable" rather than a raw
 * FastAPI detail string.
 */
const isFeatureDisabled = ref(false);

/**
 * "Buy with Card" opens intent.provider_redirect_url, which is null unless a
 * card provider is actually integrated — so the button would silently do
 * nothing. Off by default until VITE_WALLET_CARD_FUNDING=true says otherwise.
 */
const cardFundingEnabled = import.meta.env.VITE_WALLET_CARD_FUNDING === 'true';

function report(e: unknown) {
  if (ApiError.is(e) && e.status === 503) {
    isFeatureDisabled.value = true;
    return;
  }
  error.value = translateApiUserMessage((e as Error).message, t);
}

const selectedToken = computed(
  () => tokenOptions.value.find((token) => token.symbol === fundingToken.value) || tokenOptions.value[0],
);

async function loadWalletPanel() {
  error.value = null;
  try {
    await walletStore.refresh();
  } catch (e) {
    report(e);
  }
}

async function createWallet() {
  error.value = null;
  notice.value = null;
  try {
    await walletStore.createWallet();
    notice.value = t('wallet.toasts.walletCreated');
  } catch (e) {
    report(e);
  }
}

async function connectPhantom() {
  error.value = null;
  try {
    const pubkey = await walletStore.connectPhantom();
    notice.value = pubkey
      ? t('wallet.toasts.phantomConnected', { pubkey: `${pubkey.slice(0, 8)}...` })
      : t('wallet.toasts.phantomConnectedNoKey');
  } catch (e) {
    report(e);
  }
}

async function fundWithPhantom() {
  error.value = null;
  notice.value = null;
  try {
    const token = selectedToken.value;
    if (!token) {
      error.value = t('wallet.errors.selectToken');
      return;
    }
    const intent = await walletStore.createFundingIntent({
      provider: 'phantom_transfer',
      assetMint: token.mint_address,
      assetSymbol: token.symbol,
      amount: fundingAmount.value,
    });
    notice.value = t('wallet.toasts.transferIntentCreated', {
      id: `${intent.id.slice(0, 8)}...`,
      amount: fundingAmount.value,
      symbol: token.symbol,
    });
  } catch (e) {
    report(e);
  }
}

async function buyWithCard() {
  error.value = null;
  notice.value = null;
  try {
    const token = selectedToken.value;
    if (!token) {
      error.value = t('wallet.errors.selectToken');
      return;
    }
    const intent = await walletStore.createFundingIntent({
      provider: 'card_provider',
      assetMint: token.mint_address,
      assetSymbol: token.symbol,
      amount: fundingAmount.value,
      amountUsd: fundingAmount.value,
    });
    if (intent.provider_redirect_url) {
      window.open(intent.provider_redirect_url, '_blank', 'noopener,noreferrer');
    }
    notice.value = t('wallet.toasts.cardIntentCreated', { id: `${intent.id.slice(0, 8)}...` });
  } catch (e) {
    report(e);
  }
}

async function addCustomToken() {
  error.value = null;
  notice.value = null;
  try {
    if (!addTokenMint.value.trim() || !addTokenSymbol.value.trim()) {
      error.value = t('wallet.errors.mintAndSymbolRequired');
      return;
    }
    await walletStore.addCustomToken({
      mintAddress: addTokenMint.value.trim(),
      symbol: addTokenSymbol.value.trim().toUpperCase(),
      decimals: addTokenDecimals.value,
      isStablecoin: addTokenStablecoin.value,
    });
    addTokenMint.value = '';
    addTokenSymbol.value = '';
    notice.value = t('wallet.toasts.tokenAdded');
  } catch (e) {
    report(e);
  }
}

watch(
  () => workspaceStore.activeWorkspaceId,
  () => {
    void loadWalletPanel();
  },
  { immediate: true },
);

onMounted(() => {
  void loadWalletPanel();
});
</script>

<template>
  <BasePanel :title="t('sidebar.panels.wallet')" :icon="panelIcons.wallet">
    <!-- wallet_enabled is off in production, so every call 503s there. -->
    <div v-if="isFeatureDisabled" class="center-state" role="status">
      <iconify-icon icon="ph:lock-simple-duotone" aria-hidden="true" />
      <p>{{ t('wallet.errors.featureDisabled') }}</p>
    </div>

    <div v-else-if="walletStore.loading && !walletStore.wallet" class="center-state" role="status">
      <iconify-icon icon="ph:spinner-gap-bold" class="spin" aria-hidden="true" />
      <p>{{ t('wallet.loading') }}</p>
    </div>

    <div v-else class="wallet-panel">
      <PanelSection :title="t('wallet.title')" icon="ph:wallet-duotone">
        <p v-if="walletStore.wallet" class="muted mono">{{ walletStore.wallet.public_key }}</p>
        <template v-else>
          <p class="muted">{{ t('wallet.createPrompt') }}</p>
          <BaseButton
            variant="primary"
            :loading="walletStore.creating"
            icon="ph:plus-circle-duotone"
            @click="createWallet"
          >
            {{ t('wallet.createWallet') }}
          </BaseButton>
        </template>
      </PanelSection>

      <template v-if="walletStore.wallet">
        <PanelSection :title="t('wallet.funding')" icon="ph:arrow-circle-down-duotone">
          <div class="row">
            <BaseSelect
              :label="t('wallet.token')"
              v-model="fundingToken"
              :options="tokenSelectOptions"
              :placeholder="t('wallet.noTokens')"
            />
            <BaseInput
              :label="t('wallet.amount')"
              v-model="fundingAmount"
              type="number"
            />
          </div>
          <div class="actions">
            <BaseButton icon="simple-icons:phantom" @click="connectPhantom">
              {{ t('wallet.connectPhantom') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              :loading="walletStore.funding"
              @click="fundWithPhantom"
            >
              {{ t('wallet.transferIn') }}
            </BaseButton>
            <BaseButton
              v-if="cardFundingEnabled"
              variant="primary"
              :loading="walletStore.funding"
              @click="buyWithCard"
            >
              {{ t('wallet.buyWithCard') }}
            </BaseButton>
          </div>
          <p v-if="walletStore.phantomPubkey" class="muted mono">
            {{ t('wallet.connectedAs', { pubkey: walletStore.phantomPubkey }) }}
          </p>
        </PanelSection>

        <PanelSection :title="t('wallet.balances')" icon="ph:coins-duotone">
          <p v-if="walletStore.balances.length === 0" class="muted">
            {{ t('wallet.noBalances') }}
          </p>
          <div
            v-for="balance in walletStore.balances"
            :key="balance.mint_address"
            class="balance-row"
          >
            <span>{{ balance.symbol }}</span>
            <span class="mono">{{ balance.amount }}</span>
          </div>
        </PanelSection>

        <PanelSection :title="t('wallet.allowlist')" icon="ph:list-checks-duotone" collapsible>
          <div class="allowlist">
            <span
              v-for="token in walletStore.allowlist"
              :key="token.id || token.mint_address"
              class="token-pill"
            >
              {{ token.symbol }}
            </span>
          </div>
          <div class="row">
            <BaseInput
              :label="t('wallet.tokenSymbol')"
              v-model="addTokenSymbol"
              :placeholder="t('wallet.tokenSymbolPlaceholder')"
            />
            <BaseInput
              :label="t('wallet.mintAddress')"
              v-model="addTokenMint"
              :placeholder="t('wallet.mintAddressPlaceholder')"
              mono
            />
          </div>
          <div class="row">
            <BaseInput :label="t('wallet.decimals')" v-model="addTokenDecimals" type="number" />
            <BaseToggle v-model="addTokenStablecoin" :label="t('wallet.stablecoin')" />
          </div>
          <BaseButton icon="ph:plus-duotone" @click="addCustomToken">
            {{ t('wallet.addToken') }}
          </BaseButton>
        </PanelSection>

        <PanelSection :title="t('wallet.recentFunding')" icon="ph:receipt-duotone" collapsible>
          <p v-if="walletStore.fundingIntents.length === 0" class="muted">
            {{ t('wallet.noFundingIntents') }}
          </p>
          <div v-for="intent in walletStore.fundingIntents" :key="intent.id" class="intent-row">
            <span>{{ intent.provider }}</span>
            <span class="mono">{{ intent.asset_symbol }} {{ intent.expected_amount }}</span>
            <span class="status">{{ intent.status }}</span>
          </div>
        </PanelSection>
      </template>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </div>
  </BasePanel>
</template>

<style scoped>
.wallet-panel {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 20px 20px;
}

.wallet-card {
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 12px;
  background: var(--glass-bg);
}

.wallet-card h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.muted {
  color: var(--text-muted);
  font-size: 12px;
}

.row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.input {
  flex: 1;
  min-width: 0;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  padding: 8px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface-2);
  color: var(--text-primary);
  cursor: pointer;
}

.btn.primary {
  background: var(--accent-primary);
  color: #fff;
  border-color: transparent;
}

.balance-row,
.intent-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
}

.allowlist {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.token-pill {
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.status {
  text-transform: capitalize;
}

.notice {
  color: #22c55e;
  font-size: 12px;
  margin: 0;
}

.error {
  color: #ef4444;
  font-size: 12px;
  margin: 0;
}
</style>
