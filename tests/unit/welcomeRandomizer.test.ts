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
import { useWelcomeBackground } from '@/composables/useWelcomeBackground';
import { useWelcomeSoundtrack } from '@/composables/useSoundtrack';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';
import type { Track } from '@/lib/soundtrack';

// The pill also drives the crate; that half has its own tests.
vi.mock('@/composables/useSoundtrack', async (importOriginal) => {
  const { ref, shallowRef } = await import('vue');
  const actual = await importOriginal<Record<string, unknown>>();
  const currentTrack = shallowRef(null);
  const isPlaying = ref(false);
  return {
    ...actual,
    useWelcomeSoundtrack: () => ({
      currentTrack,
      isPlaying,
      toggle: vi.fn(),
      next: vi.fn(),
      stop: vi.fn(),
      owns: () => currentTrack.value !== null,
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
  useWelcomeBackground().setVideo(null);
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
  useWelcomeBackground().setVideo(null);
  useWelcomeSoundtrack().currentTrack.value = null;
  useWelcomeSoundtrack().isPlaying.value = false;
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

  it('sits after the track, not where a player would put elapsed time', () => {
    useWelcomeSoundtrack().currentTrack.value = {
      title: 'Posterity',
      artist: 'Ludwig Göransson',
    } as Track;
    const wrapper = mountPill();
    const buttons = wrapper.findAll('.pill-btn');

    expect(buttons[0]!.classes()).toContain('pill-btn--main');
    expect(buttons[buttons.length - 1]!.classes()).toContain('pill-btn--rate');
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

describe('the play button', () => {
  it('rolls a backdrop clip when play is pressed on the gradient', async () => {
    const wrapper = mountPill();
    const bg = useWelcomeBackground();

    await wrapper.get('.pill-btn--main').trigger('click');

    expect(bg.video.value).not.toBeNull();
  });

  it('leaves a chosen clip alone when play is pressed', async () => {
    const bg = useWelcomeBackground();
    bg.setVideo(bg.presets[0]!.id);
    const wrapper = mountPill();

    await wrapper.get('.pill-btn--main').trigger('click');

    expect(bg.videoId.value).toBe(bg.presets[0]!.id);
  });

  it('does not roll a stock clip when the record has a youtube video', async () => {
    useWelcomeSoundtrack().currentTrack.value = {
      title: 'Road To Zion',
      youtube: 'https://www.youtube.com/watch?v=Jq2IfkMr_x0',
    } as Track;
    const wrapper = mountPill();

    await wrapper.get('.pill-btn--main').trigger('click');

    expect(useWelcomeBackground().video.value).toBeNull();
  });
});
