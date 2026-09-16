<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BasePanel from '@/components/ui/BasePanel.vue';
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

const tokenOptions = computed(() =>
  walletStore.allowlist.length
    ? walletStore.allowlist
    : [
      { symbol: 'SOL', mint_address: 'So11111111111111111111111111111111111111112', decimals: 9, is_stablecoin: false },
      { symbol: 'USDC', mint_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, is_stablecoin: true },
    ],
);

const selectedToken = computed(
  () => tokenOptions.value.find((token) => token.symbol === fundingToken.value) || tokenOptions.value[0],
);

async function loadWalletPanel() {
  error.value = null;
  try {
    await walletStore.refresh();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function createWallet() {
  error.value = null;
  notice.value = null;
  try {
    await walletStore.createWallet();
    notice.value = 'Wallet created successfully.';
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function connectPhantom() {
  error.value = null;
  try {
    const pubkey = await walletStore.connectPhantom();
    notice.value = pubkey ? `Connected Phantom wallet ${pubkey.slice(0, 8)}...` : 'Phantom connected.';
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function fundWithPhantom() {
  error.value = null;
  notice.value = null;
  try {
    const token = selectedToken.value;
    if (!token) throw new Error('Select a token first');
    const intent = await walletStore.createFundingIntent({
      provider: 'phantom_transfer',
      assetMint: token.mint_address,
      assetSymbol: token.symbol,
      amount: fundingAmount.value,
    });
    notice.value = `Transfer intent created (${intent.id.slice(0, 8)}...). Send ${fundingAmount.value} ${token.symbol} from Phantom.`;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function buyWithCard() {
  error.value = null;
  notice.value = null;
  try {
    const token = selectedToken.value;
    if (!token) throw new Error('Select a token first');
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
    notice.value = `Card purchase intent created (${intent.id.slice(0, 8)}...).`;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function addCustomToken() {
  error.value = null;
  notice.value = null;
  try {
    if (!addTokenMint.value.trim() || !addTokenSymbol.value.trim()) {
      throw new Error('Mint and symbol are required');
    }
    await walletStore.addCustomToken({
      mintAddress: addTokenMint.value.trim(),
      symbol: addTokenSymbol.value.trim().toUpperCase(),
      decimals: addTokenDecimals.value,
      isStablecoin: addTokenStablecoin.value,
    });
    addTokenMint.value = '';
    addTokenSymbol.value = '';
    notice.value = 'Token added to allowlist.';
  } catch (e) {
    error.value = (e as Error).message;
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
    <div class="wallet-panel">
      <div class="wallet-card">
        <h3>Kwami Wallet</h3>
        <p v-if="walletStore.wallet" class="muted">
          {{ walletStore.wallet.public_key }}
        </p>
        <p v-else class="muted">
          Create a dedicated Solana wallet for this kwami.
        </p>
        <button v-if="!walletStore.wallet" class="btn primary" :disabled="walletStore.creating" @click="createWallet">
          {{ walletStore.creating ? 'Creating...' : 'Create Wallet' }}
        </button>
      </div>

      <div v-if="walletStore.wallet" class="wallet-card">
        <h3>Funding</h3>
        <div class="row">
          <select v-model="fundingToken" class="input">
            <option v-for="token in tokenOptions" :key="token.mint_address" :value="token.symbol">
              {{ token.symbol }}
            </option>
          </select>
          <input v-model.number="fundingAmount" class="input" type="number" min="0.01" step="0.01" />
        </div>
        <div class="actions">
          <button class="btn" @click="connectPhantom">Connect Phantom</button>
          <button class="btn primary" :disabled="walletStore.funding" @click="fundWithPhantom">Transfer In</button>
          <button class="btn primary" :disabled="walletStore.funding" @click="buyWithCard">Buy with Card</button>
        </div>
        <p class="muted" v-if="walletStore.phantomPubkey">
          Connected: {{ walletStore.phantomPubkey }}
        </p>
      </div>

      <div v-if="walletStore.wallet" class="wallet-card">
        <h3>Balances</h3>
        <div v-if="walletStore.balances.length === 0" class="muted">No balances yet.</div>
        <div v-for="balance in walletStore.balances" :key="balance.mint_address" class="balance-row">
          <span>{{ balance.symbol }}</span>
          <span>{{ balance.amount }}</span>
        </div>
      </div>

      <div v-if="walletStore.wallet" class="wallet-card">
        <h3>Token Allowlist</h3>
        <div class="allowlist">
          <span v-for="token in walletStore.allowlist" :key="token.id || token.mint_address" class="token-pill">
            {{ token.symbol }}
          </span>
        </div>
        <div class="row">
          <input v-model="addTokenSymbol" class="input" placeholder="Token symbol" />
          <input v-model="addTokenMint" class="input" placeholder="Mint address" />
        </div>
        <div class="row">
          <input v-model.number="addTokenDecimals" class="input" type="number" min="0" max="18" />
          <label class="checkbox">
            <input v-model="addTokenStablecoin" type="checkbox" />
            Stablecoin
          </label>
          <button class="btn" @click="addCustomToken">Add Token</button>
        </div>
      </div>

      <div v-if="walletStore.wallet" class="wallet-card">
        <h3>Recent Funding</h3>
        <div v-if="walletStore.fundingIntents.length === 0" class="muted">No funding intents yet.</div>
        <div v-for="intent in walletStore.fundingIntents" :key="intent.id" class="intent-row">
          <span>{{ intent.provider }}</span>
          <span>{{ intent.asset_symbol }} {{ intent.expected_amount }}</span>
          <span class="status">{{ intent.status }}</span>
        </div>
      </div>

      <p v-if="notice" class="notice">{{ notice }}</p>
      <p v-if="error" class="error">{{ error }}</p>
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
