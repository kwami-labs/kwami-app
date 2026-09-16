import { api } from '@/lib/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditBalance {
  balance: number;
  balance_credits: number;
  lifetime_purchased: number;
  lifetime_used: number;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  price_display: string;
  popular: boolean;
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'bonus' | 'refund';
  amount: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreditUsageLog {
  id: string;
  session_id: string;
  model_type: 'stt' | 'llm' | 'tts' | 'realtime';
  model_id: string;
  units_used: number;
  cost_usd: number;
  credits_charged: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchBalance(): Promise<CreditBalance> {
  return api.get<CreditBalance>('/credits/balance');
}

export async function fetchPacks(): Promise<CreditPack[]> {
  // Public catalogue: no bearer token needed.
  const data = await api.get<{ packs: CreditPack[] }>('/credits/packs', { auth: false });
  return data.packs;
}

export async function createCheckoutSession(
  packId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const data = await api.post<{ checkout_url: string }>(
    '/credits/purchase',
    { pack_id: packId, success_url: successUrl, cancel_url: cancelUrl },
    // Money movement: never retried, and a payment provider can be slow.
    { retry: false, timeoutMs: 30_000 },
  );
  return data.checkout_url;
}

export async function fetchTransactions(
  limit = 50,
  offset = 0,
): Promise<{ transactions: CreditTransaction[]; count: number }> {
  return api.get<{ transactions: CreditTransaction[]; count: number }>('/credits/transactions', {
    query: { limit, offset },
  });
}

export async function fetchUsageLogs(
  limit = 50,
  offset = 0,
  sessionId?: string,
): Promise<{ logs: CreditUsageLog[]; count: number }> {
  return api.get<{ logs: CreditUsageLog[]; count: number }>('/credits/usage', {
    query: { limit, offset, session_id: sessionId },
  });
}
