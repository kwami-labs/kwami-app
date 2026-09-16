import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

async function authHeaders(): Promise<HeadersInit> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = err.detail ?? err.message;
    throw new Error(typeof detail === 'string' ? detail : `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
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

  // Guards against a stale response landing after the user switched kwami.
  let refreshRequestNonce = 0;

  function activeKwamiId(): string {
    return useWorkspaceStore().activeWorkspaceId;
  }

  async function refresh() {
    const kwamiId = activeKwamiId();
    if (!kwamiId) return;
    loading.value = true;
    const requestNonce = ++refreshRequestNonce;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/wallets/kwamis/${kwamiId}`, { headers });
      const data = await parseJson<{
        wallet: KwamiWallet | null;
        balances: WalletBalance[];
        transactions: Record<string, unknown>[];
        allowlist: WalletToken[];
        funding_intents: FundingIntent[];
      }>(res);
      if (requestNonce !== refreshRequestNonce) return;
      wallet.value = data.wallet;
      balances.value = data.balances || [];
      transactions.value = data.transactions || [];
      allowlist.value = data.allowlist || [];
      fundingIntents.value = data.funding_intents || [];
    } finally {
      if (requestNonce === refreshRequestNonce) loading.value = false;
    }
  }

  async function createWallet() {
    const kwamiId = activeKwamiId();
    if (!kwamiId) throw new Error('No active kwami selected');
    creating.value = true;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/wallets/kwamis/${kwamiId}`, {
        method: 'POST',
        headers,
      });
      const data = await parseJson<{ wallet: KwamiWallet }>(res);
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
      const headers = await authHeaders();
      const route = payload.provider === 'phantom_transfer'
        ? 'phantom-intent'
        : 'card-intent';
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`${API_BASE}/wallets/kwamis/${kwamiId}/fund/${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assetMint: payload.assetMint,
          assetSymbol: payload.assetSymbol,
          amount: payload.amount,
          amountUsd: payload.amountUsd,
          senderWalletPubkey: phantomPubkey.value,
          idempotencyKey,
        }),
      });
      const data = await parseJson<{ intent: FundingIntent }>(res);
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
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/wallets/allowlist`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    await parseJson<{ token: WalletToken }>(res);
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
