import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  fetchBalance,
  fetchPacks,
  fetchTransactions,
  fetchUsageLogs,
  createCheckoutSession,
  type CreditBalance,
  type CreditPack,
  type CreditTransaction,
  type CreditUsageLog,
} from '@/composables/useCreditsApi';

const MICRO_CREDITS_PER_CREDIT = 1000;

/**
 * What a minute of voice conversation costs with the default models, measured
 * on real sessions (2026-11). Only for the "about N minutes" hint: the ledger
 * charges what each session really used.
 */
export const ENERGY_PER_VOICE_MINUTE = 70;

export function energyToMinutes(energy: number): number {
  return Math.floor(energy / ENERGY_PER_VOICE_MINUTE);
}

export const useCreditsStore = defineStore('credits', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const balance = ref<CreditBalance | null>(null);
  const balanceError = ref<string | null>(null);
  const packs = ref<CreditPack[]>([]);
  const transactions = ref<CreditTransaction[]>([]);
  const usageLogs = ref<CreditUsageLog[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  const displayBalance = computed(() => {
    if (!balance.value) return 0;
    return Math.floor(balance.value.balance / MICRO_CREDITS_PER_CREDIT);
  });

  // Null means "could not ask", which is not the same as an empty balance.
  const balanceKnown = computed(() => balance.value !== null);

  const estimatedMinutes = computed(() => energyToMinutes(displayBalance.value));

  const balanceCredits = computed(() => {
    return balance.value?.balance_credits ?? 0;
  });

  const hasCredits = computed(() => {
    return (balance.value?.balance ?? 0) > 0;
  });

  const lifetimePurchased = computed(() => {
    if (!balance.value) return 0;
    return Math.floor(balance.value.lifetime_purchased / MICRO_CREDITS_PER_CREDIT);
  });

  const lifetimeUsed = computed(() => {
    if (!balance.value) return 0;
    return Math.floor(balance.value.lifetime_used / MICRO_CREDITS_PER_CREDIT);
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function loadBalance() {
    try {
      balance.value = await fetchBalance();
      balanceError.value = null;
    } catch (e) {
      // The last balance read stays on screen: a network blip spends nothing.
      balanceError.value = (e as Error).message;
      console.error('Failed to load credit balance:', e);
    }
  }

  async function loadPacks() {
    try {
      packs.value = await fetchPacks();
    } catch (e) {
      console.error('Failed to load credit packs:', e);
    }
  }

  async function loadTransactions(limit = 50, offset = 0) {
    loading.value = true;
    error.value = null;
    try {
      const data = await fetchTransactions(limit, offset);
      transactions.value = data.transactions;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function loadUsageLogs(limit = 50, offset = 0, sessionId?: string) {
    loading.value = true;
    error.value = null;
    try {
      const data = await fetchUsageLogs(limit, offset, sessionId);
      usageLogs.value = data.logs;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function purchaseCredits(packId: string) {
    loading.value = true;
    error.value = null;
    try {
      const currentUrl = window.location.href;
      const checkoutUrl = await createCheckoutSession(
        packId,
        currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'payment=success',
        currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'payment=cancelled',
      );
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (e) {
      error.value = (e as Error).message;
      loading.value = false;
    }
  }

  /**
   * Initialize credits data. Call after authentication.
   */
  async function init() {
    await Promise.all([loadBalance(), loadPacks()]);

    // Check for payment return
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      // Refresh balance after successful payment
      await loadBalance();
      // Clean up URL
      urlParams.delete('payment');
      const cleanUrl = urlParams.toString()
        ? `${window.location.pathname}?${urlParams}`
        : window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } else if (paymentStatus === 'cancelled') {
      urlParams.delete('payment');
      const cleanUrl = urlParams.toString()
        ? `${window.location.pathname}?${urlParams}`
        : window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  return {
    // State
    balance,
    balanceError,
    packs,
    transactions,
    usageLogs,
    loading,
    error,
    // Getters
    displayBalance,
    balanceKnown,
    estimatedMinutes,
    balanceCredits,
    hasCredits,
    lifetimePurchased,
    lifetimeUsed,
    // Actions
    loadBalance,
    loadPacks,
    loadTransactions,
    loadUsageLogs,
    purchaseCredits,
    init,
  };
});
