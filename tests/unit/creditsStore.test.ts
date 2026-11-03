/**
 * "No energy" and "could not ask" must stay different answers. The panel showed
 * 0 and told people to recharge whenever the API was unreachable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { energyToMinutes, useCreditsStore } from '@/stores/credits';
import { fetchBalance } from '@/composables/useCreditsApi';

vi.mock('@/composables/useCreditsApi', () => ({
  fetchBalance: vi.fn(),
  fetchPacks: vi.fn(),
  fetchTransactions: vi.fn(),
  fetchUsageLogs: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

const funded = {
  balance: 993_739_108,
  balance_credits: 993_739,
  lifetime_purchased: 1_000_000_000,
  lifetime_used: 6_760_892,
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.mocked(fetchBalance).mockReset();
});

describe('loadBalance', () => {
  it('reports an unreachable API as unknown, not as empty', async () => {
    vi.mocked(fetchBalance).mockRejectedValue(new Error('Failed to fetch'));
    const credits = useCreditsStore();

    await credits.loadBalance();

    expect(credits.balanceKnown).toBe(false);
    expect(credits.balanceError).toBe('Failed to fetch');
  });

  it('keeps the last balance through a network blip', async () => {
    vi.mocked(fetchBalance).mockResolvedValueOnce(funded);
    vi.mocked(fetchBalance).mockRejectedValueOnce(new Error('Failed to fetch'));
    const credits = useCreditsStore();

    await credits.loadBalance();
    await credits.loadBalance();

    expect(credits.displayBalance).toBe(993_739);
    expect(credits.hasCredits).toBe(true);
    expect(credits.balanceError).toBe('Failed to fetch');
  });

  it('clears the error once the API answers', async () => {
    vi.mocked(fetchBalance).mockRejectedValueOnce(new Error('Failed to fetch'));
    vi.mocked(fetchBalance).mockResolvedValueOnce({ ...funded, balance: 0, balance_credits: 0 });
    const credits = useCreditsStore();

    await credits.loadBalance();
    await credits.loadBalance();

    expect(credits.balanceError).toBeNull();
    expect(credits.balanceKnown).toBe(true);
    expect(credits.hasCredits).toBe(false);
  });
});

describe('energyToMinutes', () => {
  it('turns a pack into the time it buys', () => {
    expect(energyToMinutes(5_000)).toBe(71);
    expect(energyToMinutes(0)).toBe(0);
  });
});
