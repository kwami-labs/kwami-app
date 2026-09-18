/**
 * The login screen's randomize rate.
 *
 * `SoundtrackPill` sets it and `WelcomeBlob` reads it, and they are siblings
 * with no props between them — so the thing under test is really that both ends
 * see one value. The button's face is the contract the user reads, so it is
 * asserted as rendered text, not as the ref behind it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SoundtrackPill from '@/components/auth/SoundtrackPill.vue';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';

// The pill also drives the crate; that half has its own tests.
vi.mock('@/composables/useSoundtrack', async (importOriginal) => {
  const { ref, shallowRef } = await import('vue');
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useWelcomeSoundtrack: () => ({
      currentTrack: shallowRef(null),
      isPlaying: ref(false),
      toggle: vi.fn(),
      next: vi.fn(),
      stop: vi.fn(),
      owns: () => false,
      release: vi.fn(),
      dispose: vi.fn(),
    }),
  };
});

const rateButton = (wrapper: ReturnType<typeof mount>) => wrapper.get('.pill-btn--rate');

/**
 * Mount through here so nothing is left standing.
 *
 * Nothing in `tests/` calls `enableAutoUnmount`, so a wrapper that is never
 * unmounted stays live for the rest of the file — and every one of these is
 * subscribed to the `useWelcomeRandomizer` singleton, so leaked pills go on
 * reacting to rate changes in later tests.
 */
const mounted: { unmount: () => void }[] = [];

function mountPill() {
  const wrapper = mount(SoundtrackPill);
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  // Module state: put it back on the default between tests.
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

/**
 * Restoring on the way out, not just on the way in.
 *
 * `useWelcomeRandomizer` is a genuine app singleton, not a per-test double, so
 * a `beforeEach` alone only protects this file from its neighbours — it leaves
 * the rate wherever the last test put it for whatever runs next. That is
 * harmless while vitest isolates module state per file, but vitest prints
 * `isolate: false` as a performance suggestion in its own output on every run,
 * and the day someone takes it this file would quietly re-time other people's.
 */
afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

describe('the randomize rate', () => {
  it('offers every rate the design calls for', () => {
    expect(RANDOMIZE_INTERVALS_MS).toEqual([1_000, 2_000, 3_000, 5_000, 10_000, 30_000, 60_000]);
  });

  it('starts at one second', () => {
    expect(useWelcomeRandomizer().intervalMs.value).toBe(1_000);
    expect(rateButton(mountPill()).text()).toBe('1s');
  });

  it('steps through every rate and wraps back to the fastest', async () => {
    const wrapper = mountPill();
    const seen: string[] = [rateButton(wrapper).text()];

    for (let i = 0; i < RANDOMIZE_INTERVALS_MS.length; i += 1) {
      await rateButton(wrapper).trigger('click');
      seen.push(rateButton(wrapper).text());
    }

    expect(seen).toEqual(['1s', '2s', '3s', '5s', '10s', '30s', '60s', '1s']);
  });

  it('shows the blob and the button one value, not a copy each', async () => {
    const wrapper = mountPill();
    // Whoever else asks — `WelcomeBlob` does exactly this — sees the click.
    const elsewhere = useWelcomeRandomizer();

    await rateButton(wrapper).trigger('click');

    expect(elsewhere.intervalMs.value).toBe(2_000);
    expect(elsewhere.intervalSeconds.value).toBe(2);
  });

  it('names the current rate for screen readers', async () => {
    const wrapper = mountPill();

    expect(rateButton(wrapper).attributes('aria-label')).toContain('1s');
    await rateButton(wrapper).trigger('click');
    expect(rateButton(wrapper).attributes('aria-label')).toContain('2s');
  });

  it('recovers from a rate that is not one of the offered ones', () => {
    const { intervalMs, cycleInterval } = useWelcomeRandomizer();
    intervalMs.value = 4_321;

    cycleInterval();

    expect(intervalMs.value).toBe(1_000);
  });
});
