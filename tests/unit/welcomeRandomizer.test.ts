/**
 * The login screen's randomize rate.
 *
 * `SoundtrackPill` sets it and `WelcomeBlob` reads it, and they are siblings
 * with no props between them — so the thing under test is really that both ends
 * see one value. The button's face is the contract the user reads, so it is
 * asserted as rendered text, not as the ref behind it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  // Module state: put it back on the default between tests.
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

describe('the randomize rate', () => {
  it('offers every rate the design calls for', () => {
    expect(RANDOMIZE_INTERVALS_MS).toEqual([1_000, 2_000, 3_000, 5_000, 10_000, 30_000, 60_000]);
  });

  it('starts at one second', () => {
    expect(useWelcomeRandomizer().intervalMs.value).toBe(1_000);
    expect(rateButton(mount(SoundtrackPill)).text()).toBe('1s');
  });

  it('steps through every rate and wraps back to the fastest', async () => {
    const wrapper = mount(SoundtrackPill);
    const seen: string[] = [rateButton(wrapper).text()];

    for (let i = 0; i < RANDOMIZE_INTERVALS_MS.length; i += 1) {
      await rateButton(wrapper).trigger('click');
      seen.push(rateButton(wrapper).text());
    }

    expect(seen).toEqual(['1s', '2s', '3s', '5s', '10s', '30s', '60s', '1s']);
  });

  it('shows the blob and the button one value, not a copy each', async () => {
    const wrapper = mount(SoundtrackPill);
    // Whoever else asks — `WelcomeBlob` does exactly this — sees the click.
    const elsewhere = useWelcomeRandomizer();

    await rateButton(wrapper).trigger('click');

    expect(elsewhere.intervalMs.value).toBe(2_000);
    expect(elsewhere.intervalSeconds.value).toBe(2);
  });

  it('names the current rate for screen readers', async () => {
    const wrapper = mount(SoundtrackPill);

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
