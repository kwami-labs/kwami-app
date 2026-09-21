/**
 * The welcome blob has to *move*, not jump.
 *
 * The tween's maths is covered in `blobTween.test.ts`, and the rate button's
 * timer in `welcomeBlobRandomize.test.ts` — but between them sat a gap nobody
 * had closed: that the tween is actually pushed at the SDK every frame, rather
 * than computed and then applied as one cut per tick. That is the whole
 * difference between an avatar that drifts and the strobe this replaced, and it
 * is invisible to both of those files.
 *
 * Watching real pixels would be the direct test, and three attempts at it ran
 * out of budget (a renderer switch swaps the canvas node, and clipped
 * screenshots at 100ms blow the Playwright deadline). This measures the same
 * property one layer in, at `setSpikes` — where a hard cut would show as a
 * single frame carrying the entire journey.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { useWelcomeRandomizer, RANDOMIZE_INTERVALS_MS } from '@/composables/useWelcomeRandomizer';

const analyser = { smoothingTimeConstant: 0.35 };

/**
 * One blob for the whole file, unlike the sibling spec's per-call object: the
 * point here is to accumulate every `setSpikes` of a run and look at the shape
 * of the series, which a fresh spy each frame would throw away.
 */
const blob = {
  getMesh: () => ({ rotation: { x: 0, y: 0, z: 0 } }),
  setTouchStrength: vi.fn(),
  setTouchDuration: vi.fn(),
  setMaxTouchPoints: vi.fn(),
  setColors: vi.fn(),
  setSpikes: vi.fn(),
  setAmplitude: vi.fn(),
  setTime: vi.fn(),
};

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
    getAnalyser: () => analyser,
  })),
  getBlob: vi.fn(() => blob),
};

vi.mock('kwami', () => ({
  Kwami: vi.fn(function Kwami() {
    return { avatar, dispose: vi.fn(async () => undefined) };
  }),
  randomBlobSkinType: () => 'radial',
}));

const mounted: { unmount: () => void }[] = [];

/**
 * Mount, then put the fake clock in the same place on every run.
 *
 * `onMounted` does two kinds of waiting, and the bug was mixing them. It sleeps
 * on a 10ms timer (`WelcomeBlob.vue`), which only fake time crosses, and it
 * awaits two real dynamic `import()`s, which no amount of fake time helps
 * because they are real I/O. The earlier helper waited for both by advancing
 * 20ms of fake time per iteration until the component armed — so the fake clock
 * moved by `iterations x 20`, and `iterations` was set by how busy the machine
 * was. Measurement then began at a different fake timestamp every run, which is
 * fatal to files asserting on per-frame step sizes.
 *
 * So the two waits are separated: a fixed advance for the timer, then yields
 * that cost no fake time at all for the imports, then a fixed settle. Total
 * fake time here is a constant, on a quiet machine and under 36 parallel files
 * alike. (`performance.now()` is not the culprit and was measured out: vitest
 * fakes it, and it advances exactly with the fake clock.)
 */
async function mountBlob() {
  const before = avatar.switchRenderer.mock.calls.length;
  const WelcomeBlob = (await import('@/components/auth/WelcomeBlob.vue')).default;
  const wrapper = mount(WelcomeBlob, { attachTo: document.body });
  mounted.push(wrapper);

  // Cross the 10ms sleep. Fixed.
  await vi.advanceTimersByTimeAsync(10);

  // Let the dynamic imports land. Each yield turns the real event loop and
  // advances the fake clock by zero, so a slow machine costs wall time here
  // and nothing else.
  for (let i = 0; i < 500; i += 1) {
    if (avatar.switchRenderer.mock.calls.length > before) break;
    await vi.advanceTimersByTimeAsync(0);
  }
  if (avatar.switchRenderer.mock.calls.length === before) {
    throw new Error('WelcomeBlob never armed its randomize loop');
  }

  // Settle the first frame. Fixed.
  await vi.advanceTimersByTimeAsync(64);
  return wrapper;
}

/** The x-axis spike value of every `setSpikes` since it was last cleared. */
function spikeSeries(): number[] {
  return blob.setSpikes.mock.calls.map((c) => c[0] as number);
}

/**
 * The largest single-frame move as a fraction of the distance actually walked.
 *
 * Against total travel, not against `max - min`. The drift targets are drawn at
 * random, so a tick can happen to aim somewhere very close to where the blob
 * already is; the span between extremes is then tiny, ordinary frame steps
 * become a large fraction of it, and the measurement fails on a run where
 * nothing is wrong. Summed travel scales with the size of the drift exactly as
 * the steps do, so the ratio means the same thing whether the blob crossed the
 * room or shuffled: a tween spreads the journey over frames and scores about
 * 1/frames, a cut puts it all in one and scores about 1.
 */
function worstStepFraction(series: number[]): number {
  let worst = 0;
  let travelled = 0;
  for (let i = 1; i < series.length; i += 1) {
    const step = Math.abs(series[i]! - series[i - 1]!);
    travelled += step;
    worst = Math.max(worst, step);
  }
  if (travelled === 0) return 0;
  return worst / travelled;
}

beforeEach(() => {
  vi.useFakeTimers();

  /**
   * Keep the welcome avatar a blob.
   *
   * `pickRendererByProbability` rolls on every tick and returns `eye-iris` one
   * time in twenty — and that path sets no blob spikes at all, so this file has
   * nothing to measure and fails outright, with nothing whatsoever wrong. Two
   * ticks a test made that roughly a one-in-ten false red, which is precisely
   * the kind of guard that teaches people to re-run instead of read.
   *
   * So randomness becomes a seeded sequence capped below the renderer
   * threshold: reproducible run to run, still varied enough that the drift
   * actually moves, and never able to wander onto the path this file cannot
   * see. The cap is what makes it robust to the seed rather than lucky in it.
   */
  let seed = 0x2f6e2b1;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0x1_0000_0000) * 0.9;
  });

  blob.setSpikes.mockClear();
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

afterEach(async () => {
  while (mounted.length) mounted.pop()?.unmount();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  // The rate is a real app singleton: hand it back on the default rather than
  // leaving it wherever the last test put it. Harmless under per-file module
  // isolation, a landmine the day anyone takes vitest's `isolate: false` hint.
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

describe('the welcome blob tween', () => {
  it('pushes the shape at the SDK every frame, not once a tick', async () => {
    await mountBlob();
    blob.setSpikes.mockClear();

    await vi.advanceTimersByTimeAsync(1_000);

    // One cut per tick would be a single call here; a tween is frame-rate many.
    expect(spikeSeries().length).toBeGreaterThan(10);
  });

  it('never moves the whole distance in one frame', async () => {
    await mountBlob();
    blob.setSpikes.mockClear();

    // Two ticks, so the window contains a randomize boundary — the exact
    // moment the old code cut.
    await vi.advanceTimersByTimeAsync(2_000);

    const series = spikeSeries();
    expect(series.length).toBeGreaterThan(20);
    // A hard cut scores 1.0: one frame carries the entire range.
    expect(worstStepFraction(series)).toBeLessThan(0.25);
  });

  it('keeps moving across the randomize boundary rather than resting', async () => {
    await mountBlob();
    blob.setSpikes.mockClear();
    await vi.advanceTimersByTimeAsync(2_000);

    const series = spikeSeries();
    // Split the window either side of the tick and check both halves travel:
    // a tween that only ran for 85% of the interval would leave one half flat.
    const mid = Math.floor(series.length / 2);
    const travel = (part: number[]) =>
      part.reduce((sum, v, i) => (i === 0 ? 0 : sum + Math.abs(v - part[i - 1]!)), 0);

    expect(travel(series.slice(0, mid))).toBeGreaterThan(0);
    expect(travel(series.slice(mid))).toBeGreaterThan(0);
  });
});
