/**
 * The login avatar has to stay pointing at the visitor.
 *
 * It used to fire a spin burst every fifth randomize: a per-frame yaw delta
 * that was *added to* while decaying at 0.92, so it converged on about a third
 * of a radian per frame — five revolutions a second — while the SDK's
 * `cursorFollow` lerped the same property back towards centre at 8% a frame.
 * The result was a blob that periodically went berserk and snapped back, and
 * nothing failed: no exception, no warning, just a number climbing.
 *
 * So what is held here is a bound, not a behaviour. Every rotation the
 * component writes is a bounded offset re-applied as its own delta, which
 * means no sequence of frames and no sequence of randomize ticks can take the
 * blob anywhere it cannot come back from. A rewrite that reintroduces an
 * accumulator fails here on the first burst.
 *
 * `welcomeBlobRandomize.test.ts` covers the timer and the analyser; this
 * covers what the frame loop does to the mesh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';
import { scaleAudioSpikeEffects } from '@/utils/blobTween';

const BIN_COUNT = 1_024;

/**
 * One mesh for the whole run, unlike the stub in `welcomeBlobRandomize`, which
 * hands back a fresh object per call. A fresh object per call cannot
 * accumulate, so it would have passed against the broken code too.
 */
const mesh = {
  rotation: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
};

/** The live object `animateBlobXyz` re-reads every frame. */
const audioEffects: Record<string, number> = {};

/** A spectrum the test can rewrite between frames. */
let spectrum = new Uint8Array(BIN_COUNT);
let paused = false;

const context = {
  sampleRate: 44_100,
  createAnalyser: () => ({
    fftSize: 2_048,
    smoothingTimeConstant: 0.35,
    minDecibels: -90,
    maxDecibels: -10,
    get frequencyBinCount() {
      return this.fftSize / 2;
    },
    context,
    getByteFrequencyData: (out: Uint8Array) => out.set(spectrum),
  }),
};

const analyser = {
  smoothingTimeConstant: 0.35,
  context,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const liquidPhysics = { stretch: 0.6, velocityX: 0, velocityY: 0 };

const blob = {
  audioEffects,
  liquidPhysics,
  getMesh: () => mesh,
  setResolution: vi.fn(),
  setRotation: vi.fn(),
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
    getAudioElement: () => ({ paused }),
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

const BIN_HZ = 44_100 / 2_048;

function fill(fromHz: number, toHz: number, level: number, into = new Uint8Array(BIN_COUNT)) {
  for (let i = Math.round(fromHz / BIN_HZ); i < Math.min(BIN_COUNT, Math.round(toHz / BIN_HZ)); i += 1) {
    into[i] = Math.round(level * 255);
  }
  return into;
}

/** A steady mix. */
const bed = (level: number) => fill(30, 7_000, level);
/** The same mix with the low end lifted: a kick. */
const withKick = (level: number, hit: number) => fill(30, 160, hit, bed(level));

const mounted: { unmount: () => void }[] = [];

async function mountBlob() {
  const WelcomeBlob = (await import('@/components/auth/WelcomeBlob.vue')).default;
  const wrapper = mount(WelcomeBlob, { attachTo: document.body });
  mounted.push(wrapper);
  await vi.advanceTimersByTimeAsync(50);
  return wrapper;
}

/** Advance real frames, sampling the mesh after each one. */
async function frames(count: number, onFrame?: (index: number) => void) {
  const samples: { z: number; y: number; x: number; posY: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    onFrame?.(i);
    await vi.advanceTimersByTimeAsync(16);
    samples.push({
      z: mesh.rotation.z,
      y: mesh.rotation.y,
      x: mesh.rotation.x,
      posY: mesh.position.y,
    });
  }
  return samples;
}

beforeEach(() => {
  vi.useFakeTimers();
  mesh.rotation.x = 0;
  mesh.rotation.y = 0;
  mesh.rotation.z = 0;
  mesh.position.y = 0;
  for (const key of Object.keys(audioEffects)) delete audioEffects[key];
  spectrum = bed(0.5);
  paused = false;
  analyser.connect.mockClear();
  blob.setResolution.mockClear();
  liquidPhysics.stretch = 0.6;
  liquidPhysics.velocityX = 0;
  liquidPhysics.velocityY = 0;
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

afterEach(async () => {
  while (mounted.length) mounted.pop()?.unmount();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
});

describe('the welcome blob under music', () => {
  it('never lets the blob wind up a rotation it cannot come back from', async () => {
    await mountBlob();

    // Twenty seconds of music, which is twenty randomize ticks at the default
    // rate — four times what it took the old spin burst to fire.
    const samples = await frames(1_250, (i) => {
      // A kick every 30 frames: half a second, 120bpm.
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    const furthest = Math.max(...samples.map((s) => Math.abs(s.z)));

    // The sway's own amplitude is 0.3rad; anything near a revolution is an
    // accumulator that got loose.
    expect(furthest).toBeLessThan(0.4);
    // The axes `cursorFollow` owns are not written by the component at all.
    expect(Math.max(...samples.map((s) => Math.abs(s.y)))).toBe(0);
    expect(Math.max(...samples.map((s) => Math.abs(s.x)))).toBe(0);
  });

  it('turns by degrees a frame, not by revolutions', async () => {
    await mountBlob();

    const samples = await frames(600, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    let widest = 0;
    for (let i = 1; i < samples.length; i += 1) {
      widest = Math.max(widest, Math.abs(samples[i]!.z - samples[i - 1]!.z));
    }

    // At 60Hz, 0.03rad a frame is still under two degrees — enough to land
    // a beat, not enough to spin.
    expect(widest).toBeLessThan(0.03);
  });

  it('leaves the blob where it found it once the music stops', async () => {
    await mountBlob();
    await frames(300, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    paused = true;
    const samples = await frames(400);
    const settled = samples[samples.length - 1]!;

    // Only the idle sway is left, and the bob is gone entirely.
    expect(Math.abs(settled.z)).toBeLessThan(0.09);
    expect(Math.abs(settled.posY)).toBeLessThan(0.01);
  });

  it('dips the blob on the beat and draws it back out', async () => {
    await mountBlob();
    // Settle the detector's baseline first, or the track starting reads as one
    // long onset and every frame looks like a hit.
    await frames(500);

    const quiet = await frames(60);
    const beats = await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    const stillest = Math.max(...quiet.map((s) => Math.abs(s.posY)));
    const deepest = Math.max(...beats.map((s) => Math.abs(s.posY)));

    expect(stillest).toBeLessThan(0.01);
    expect(deepest).toBeGreaterThan(0.04);
    // And bounded: `BOB_DEPTH` is 0.2 against a blob of radius ~3.5.
    expect(deepest).toBeLessThan(0.22);
  });

  it('leans on a clock rather than on the last hit it heard', async () => {
    await mountBlob();
    await frames(500);

    // Four seconds of 120bpm: a kick every 30 frames of 16ms, so a beat is
    // 480ms and the two-beat lean is 960ms — sixty frames.
    const beating = await frames(250, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    // Turning points rather than zero crossings: the idle sine underneath is a
    // slow offset, and what is being counted here is the stroke on top of it.
    let turns = 0;
    for (let i = 2; i < beating.length; i += 1) {
      const before = beating[i - 1]!.z - beating[i - 2]!.z;
      const after = beating[i]!.z - beating[i - 1]!.z;
      if (Math.abs(before) > 1e-4 && Math.abs(after) > 1e-4 && Math.sign(before) !== Math.sign(after)) {
        turns += 1;
      }
    }

    // Four seconds at a bar a second is four strokes, and a stroke has two
    // ends. A body leaning once per beat would be at eight, and one that only
    // answered hits would be ragged rather than periodic.
    expect(turns).toBeGreaterThanOrEqual(6);
    expect(turns).toBeLessThanOrEqual(10);
  });

  it('keeps the groove through a bar with no percussion in it', async () => {
    await mountBlob();
    await frames(500);
    await frames(250, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    // The track carries on, but the drums drop out for a bar.
    spectrum = bed(0.5);
    const gap = await frames(60);

    const swing = Math.max(...gap.map((s) => s.z)) - Math.min(...gap.map((s) => s.z));
    // The last frames only. The bar opens with the body still drawing out of
    // the kick before it, which is the bob doing its job rather than a
    // leftover, and `BOB_RELEASE_MS` is what says how long that takes.
    const dip = Math.max(...gap.slice(-10).map((s) => Math.abs(s.posY)));

    // Still swaying: the idle sine alone moves 0.04rad in a second, so
    // anything past that is the clock still running. This is the difference
    // between an avatar dancing and an avatar reacting.
    expect(swing).toBeGreaterThan(0.06);
    // And the dip is gone, because nothing hit. The lean is on the clock; the
    // bob is on the beat itself.
    expect(dip).toBeLessThan(0.02);
  });

  it('kills liquid stretch so a beat cannot bake a cone into the body', async () => {
    await mountBlob();
    await frames(30, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    expect(liquidPhysics.stretch).toBe(0);
    expect(liquidPhysics.velocityY).toBe(0);
  });

  it('rebuilds the sphere when the music stops, so a cone does not need a refresh', async () => {
    await mountBlob();
    await frames(40, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    paused = true;
    await frames(2);

    expect(blob.setResolution).toHaveBeenCalled();
  });
});

describe('the reactivity the blob is driven at', () => {
  it('sings the held phrase and accents the beat on top', async () => {
    await mountBlob();
    await frames(500);

    const phrase = audioEffects.reactivity!;

    let loudest = 0;
    await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
      loudest = Math.max(loudest, audioEffects.reactivity ?? 0);
    });

    // A steady mix is a note, not silence: the body has to be holding it
    // before the kick can read as a syllable.
    expect(phrase).toBeGreaterThan(0.34);

    // And the syllable has to be most of what is heard. This is the ratio the
    // whole tuning turns on: the beat used to be worth a tenth more reactivity
    // than the bed it landed on, which is why the blob looked loud rather than
    // in time. Driven over the SDK's own displacement, weighting the pulse this
    // far took the surface from moving 1.3x further on a beat to 1.7-1.9x,
    // depending on the roll.
    expect(loudest).toBeGreaterThan(phrase * 1.8);

    // And bounded by the constants, so no track can drive it to a number the
    // SDK's `min(3, …)` clamp would have to catch.
    expect(loudest).toBeLessThanOrEqual(0.34 + 0.42 + 2.35);
  });

  it('keeps the rest of the effects the SDK reads, rather than only reactivity', async () => {
    await mountBlob();
    await frames(2);

    // Spelled out in the component so an SDK default that moves cannot
    // silently retune the login screen. The spike field is the exception:
    // it is the husk-end of those constants, scaled to the live shape so a
    // drop does not grow a coat of lobes the rest pose never had.
    expect(audioEffects.sensitivity).toBe(0.04);
    expect(audioEffects.responseSpeed).toBe(0.6);
    expect(audioEffects.transientBoost).toBe(0.2);

    const last = blob.setSpikes.mock.calls.at(-1);
    expect(last).toBeDefined();
    const expected = scaleAudioSpikeEffects(
      [last![0], last![1], last![2]],
      { bassSpike: 0.45, midSpike: 0.58, highSpike: 0.22, spikeDensity: 0.2 },
    );
    expect(audioEffects.bassSpike).toBeCloseTo(expected.bassSpike);
    expect(audioEffects.midSpike).toBeCloseTo(expected.midSpike);
    expect(audioEffects.highSpike).toBeCloseTo(expected.highSpike);
    expect(audioEffects.spikeDensity).toBeCloseTo(expected.spikeDensity);
  });

  it('stops the SDK integrating a rotation of its own', async () => {
    await mountBlob();
    await frames(2);

    // The random per-axis drift that used to be set here accumulated forever
    // on z, which nothing corrects.
    expect(blob.setRotation).toHaveBeenCalledWith(0, 0, 0);
  });
});
