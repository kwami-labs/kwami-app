/**
 * The rate button has to actually move the blob's timer.
 *
 * `setInterval` cannot have its period changed once running, so `WelcomeBlob`
 * re-arms on every rate change. That is the part a user would notice breaking —
 * the button face would step through 1s, 2s, 3s while the avatar kept flipping
 * at whatever rate it started on — and it is what this file holds.
 *
 * `switchRenderer` is the probe because it is the one call every tick makes
 * unconditionally. `randomize()` used to serve, but the blob path no longer
 * calls it: it re-rolled the blob's resolution, and a resolution change rebuilds
 * a 26k-vertex geometry and wipes the SDK's per-vertex audio smoothing, which
 * is a dropped frame and a reset envelope every second. The SDK returns early
 * from a switch to the renderer already up, so calling it every tick is free.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';

const avatar = {
  randomize: vi.fn(),
  switchRenderer: vi.fn(),
  setSkin: vi.fn(),
  setScale: vi.fn(),
  setShininess: vi.fn(),
  setWireframe: vi.fn(),
  getEyeIris: vi.fn(() => null),
  getAudio: vi.fn(() => ({
    getAudioElement: () => ({ paused: true }),
    getFrequencyData: () => new Uint8Array(0),
  })),
  getBlob: vi.fn(() => ({
    getMesh: () => ({ rotation: { x: 0, y: 0, z: 0 } }),
    setTouchStrength: vi.fn(),
    setTouchDuration: vi.fn(),
    setMaxTouchPoints: vi.fn(),
    setColors: vi.fn(),
    setSpikes: vi.fn(),
    setAmplitude: vi.fn(),
    setTime: vi.fn(),
  })),
};

// The shared stub's avatar has no audio object or blob mesh, so `WelcomeBlob`
// bails before it ever arms a timer. This file needs both.
vi.mock('kwami', () => ({
  Kwami: vi.fn(function Kwami() {
    return { avatar, dispose: vi.fn(async () => undefined) };
  }),
  randomBlobSkinType: () => 'radial',
}));

// Every mount arms a real interval, so an instance left standing keeps
// randomizing through the tests that follow and poisons their counts.
const mounted: { unmount: () => void }[] = [];

/** Mount, then run out the `await`s in `onMounted` before the first tick. */
async function mountBlob() {
  const WelcomeBlob = (await import('@/components/auth/WelcomeBlob.vue')).default;
  const wrapper = mount(WelcomeBlob, { attachTo: document.body });
  mounted.push(wrapper);
  await vi.advanceTimersByTimeAsync(50);
  return wrapper;
}

beforeEach(() => {
  vi.useFakeTimers();
  avatar.switchRenderer.mockClear();
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

afterEach(async () => {
  while (mounted.length) mounted.pop()?.unmount();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
});

describe('the welcome blob timer', () => {
  it('randomizes once a second by default', async () => {
    await mountBlob();
    // One on arrival, so the screen never opens on the same avatar twice.
    const onArrival = avatar.switchRenderer.mock.calls.length;
    expect(onArrival).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(3_000);

    expect(avatar.switchRenderer.mock.calls.length - onArrival).toBe(3);
  });

  it('re-arms at the new rate rather than finishing the old interval', async () => {
    await mountBlob();
    const { cycleInterval } = useWelcomeRandomizer();

    await vi.advanceTimersByTimeAsync(900);
    cycleInterval(); // 1s -> 2s, 100ms before the pending tick would have fired
    await vi.advanceTimersByTimeAsync(0);
    const baseline = avatar.switchRenderer.mock.calls.length;

    // The old 1s tick is gone: nothing at 900ms + 100ms.
    await vi.advanceTimersByTimeAsync(1_100);
    expect(avatar.switchRenderer.mock.calls.length).toBe(baseline);

    // The new 2s one fires on its own schedule.
    await vi.advanceTimersByTimeAsync(900);
    expect(avatar.switchRenderer.mock.calls.length).toBe(baseline + 1);
  });

  it('stops randomizing once the login screen is gone', async () => {
    const wrapper = await mountBlob();

    mounted.pop();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(0);
    const afterUnmount = avatar.switchRenderer.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);

    expect(avatar.switchRenderer.mock.calls.length).toBe(afterUnmount);
  });

  it('does not leave a watcher driving a disposed kwami', async () => {
    const wrapper = await mountBlob();
    mounted.pop();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(0);
    const afterUnmount = avatar.switchRenderer.mock.calls.length;

    // A later rate change must not re-arm a timer for a screen that is gone.
    useWelcomeRandomizer().cycleInterval();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(avatar.switchRenderer.mock.calls.length).toBe(afterUnmount);
  });
});
