import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, createRequestGuard, isAbortError } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';


export interface WalletToken {
  id: string;
  mint_address: string;
  symbol: string;
  decimals: number;
  is_stablecoin: boolean;
  is_default: boolean;
}

export interface KwamiWallet {
  id: string;
  kwami_id: string;
  public_key: string;
  status: string;
  custody_type: string;
  network: string;
  connected_wallet_pubkey?: string | null;
}

export interface WalletBalance {
  mint_address: string;
  symbol: string;
  amount: string;
  amount_usd?: string | null;
}

export interface FundingIntent {
  id: string;
  provider: 'phantom_transfer' | 'card_provider';
  status: string;
  asset_symbol: string;
  expected_amount: string;
  provider_redirect_url?: string | null;
  created_at: string;
}


export const useWalletStore = defineStore('wallet', () => {
  const loading = ref(false);
  const creating = ref(false);
  const funding = ref(false);
  const wallet = ref<KwamiWallet | null>(null);
  const balances = ref<WalletBalance[]>([]);
  const transactions = ref<Record<string, unknown>[]>([]);
  const allowlist = ref<WalletToken[]>([]);
  const fundingIntents = ref<FundingIntent[]>([]);
  const phantomPubkey = ref<string | null>(null);

  // Aborts the previous overview load when the user switches kwami.
  const guard = createRequestGuard();

  function activeKwamiId(): string {
    return useWorkspaceStore().activeWorkspaceId;
  }

  async function refresh() {
    const kwamiId = activeKwamiId();
    if (!kwamiId) return;
    loading.value = true;
    const { signal, isCurrent } = guard.begin();
    try {
      const data = await api.get<{
        wallet: KwamiWallet | null;
        balances: WalletBalance[];
        transactions: Record<string, unknown>[];
        allowlist: WalletToken[];
        funding_intents: FundingIntent[];
      }>(`/wallets/kwamis/${kwamiId}`, { signal });
      if (!isCurrent()) return;
      wallet.value = data.wallet;
      balances.value = data.balances || [];
      transactions.value = data.transactions || [];
      allowlist.value = data.allowlist || [];
      fundingIntents.value = data.funding_intents || [];
    } catch (e) {
      if (isAbortError(e)) return;
      throw e;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  async function createWallet() {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    creating.value = true;
    try {
      const data = await api.post<{ wallet: KwamiWallet }>(`/wallets/kwamis/${kwamiId}`);
      wallet.value = data.wallet;
      await refresh();
    } finally {
      creating.value = false;
    }
  }

  async function connectPhantom() {
    const provider = window.solana;
    if (!provider?.isPhantom) throw new Error('Phantom wallet not found');
    const response = await provider.connect();
    phantomPubkey.value = response?.publicKey?.toString?.() || null;
    return phantomPubkey.value;
  }

  async function createFundingIntent(payload: {
    provider: 'phantom_transfer' | 'card_provider';
    assetMint: string;
    assetSymbol: string;
    amount: number;
    amountUsd?: number;
  }): Promise<FundingIntent> {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    funding.value = true;
    try {
      const route = payload.provider === 'phantom_transfer' ? 'phantom-intent' : 'card-intent';
      const idempotencyKey = crypto.randomUUID();
      const data = await api.post<{ intent: FundingIntent }>(
        `/wallets/kwamis/${kwamiId}/fund/${route}`,
        {
          assetMint: payload.assetMint,
          assetSymbol: payload.assetSymbol,
          amount: payload.amount,
          amountUsd: payload.amountUsd,
          senderWalletPubkey: phantomPubkey.value,
          idempotencyKey,
        },
        // Money movement: the key makes this the one POST safe to retry, and
        // a slow funding provider needs more than the default budget.
        { idempotencyKey, timeoutMs: 30_000 },
      );
      await refresh();
      return data.intent;
    } finally {
      funding.value = false;
    }
  }

  async function addCustomToken(payload: {
    mintAddress: string;
    symbol: string;
    decimals: number;
    isStablecoin: boolean;
  }) {
    await api.post<{ token: WalletToken }>('/wallets/allowlist', payload);
    await refresh();
  }

  return {
    loading,
    creating,
    funding,
    wallet,
    balances,
    transactions,
    allowlist,
    fundingIntents,
    phantomPubkey,
    refresh,
    createWallet,
    connectPhantom,
    createFundingIntent,
    addCustomToken,
  };
});
