/**
 * The login avatar only turns when the visitor asks it to.
 *
 * It used to lean on every randomize tick and on the beat clock, so a body
 * that was supposed to sit still between pointer moves spun on its own. What
 * is held here is that music and the rate button cannot write rotation, and
 * that the pointer can — as a bounded offset, frozen while a button is down
 * so a drag is not fought.
 *
 * `welcomeBlobRandomize.test.ts` covers the timer and the analyser; this
 * covers what the frame loop does to the mesh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';

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
  it('does not rotate on its own, through music or randomize ticks', async () => {
    await mountBlob();

    // Twenty seconds of music, which is twenty randomize ticks at the default
    // rate — the window the old lean used to spend spinning.
    const samples = await frames(1_250, (i) => {
      // A kick every 30 frames: half a second, 120bpm.
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    expect(Math.max(...samples.map((s) => Math.abs(s.z)))).toBe(0);
    expect(Math.max(...samples.map((s) => Math.abs(s.y)))).toBe(0);
    expect(Math.max(...samples.map((s) => Math.abs(s.x)))).toBe(0);
  });

  it('leaves the blob facing where it was once the music stops', async () => {
    await mountBlob();
    await frames(300, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    paused = true;
    const samples = await frames(400);
    const settled = samples[samples.length - 1]!;

    expect(settled.z).toBe(0);
    expect(settled.y).toBe(0);
    expect(settled.x).toBe(0);
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

  it('does not lean to the music once the drums drop out', async () => {
    await mountBlob();
    await frames(500);
    await frames(250, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    spectrum = bed(0.5);
    const gap = await frames(60);

    const swing = Math.max(...gap.map((s) => s.z)) - Math.min(...gap.map((s) => s.z));
    const dip = Math.max(...gap.slice(-10).map((s) => Math.abs(s.posY)));

    expect(swing).toBe(0);
    expect(dip).toBeLessThan(0.02);
  });

  it('turns toward the pointer and no further', async () => {
    await mountBlob();
    await frames(10);

    const samples = await frames(40, () => {
      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: window.innerWidth,
        clientY: window.innerHeight / 2,
      }));
    });

    const last = samples[samples.length - 1]!;
    // Yaw follows the pointer; pitch stays put because the pointer is on the
    // horizon, and roll is not a follow axis.
    expect(last.y).toBeGreaterThan(0.3);
    expect(last.y).toBeLessThanOrEqual(0.4);
    expect(Math.abs(last.x)).toBeLessThan(0.02);
    expect(last.z).toBe(0);
  });

  it('holds the follow still while a button is down, so a drag is not fought', async () => {
    await mountBlob();
    await frames(40, () => {
      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: window.innerWidth,
        clientY: window.innerHeight / 2,
      }));
    });
    const facing = mesh.rotation.y;
    expect(facing).toBeGreaterThan(0.3);

    window.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    await frames(40, () => {
      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 0,
        clientY: window.innerHeight / 2,
      }));
    });

    // The pointer crossed the screen. If follow had kept chasing it, yaw
    // would be heading for the other side. Frozen, it stays where the drag
    // can take it — and this test does not itself drag, so it stays put.
    expect(mesh.rotation.y).toBeCloseTo(facing, 5);
    window.dispatchEvent(new MouseEvent('pointerup'));
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

    // Scaled to the live shape, so the exact numbers move with the roll.
    // What is pinned is the band: never above the husk-end constants, never
    // below the drop's swell floor. `setSpikes` is not the source of truth
    // here — one tick in twenty is an eye, and that path never calls it.
    expect(audioEffects.bassSpike).toBeGreaterThanOrEqual(0.45 * 0.4);
    expect(audioEffects.bassSpike).toBeLessThanOrEqual(0.45);
    expect(audioEffects.midSpike).toBeGreaterThanOrEqual(0.58 * 0.4);
    expect(audioEffects.midSpike).toBeLessThanOrEqual(0.58);
    expect(audioEffects.highSpike).toBeGreaterThanOrEqual(0);
    expect(audioEffects.highSpike).toBeLessThanOrEqual(0.22);
    expect(audioEffects.spikeDensity).toBeGreaterThanOrEqual(0);
    expect(audioEffects.spikeDensity).toBeLessThanOrEqual(0.2);
  });

  it('stops the SDK integrating a rotation of its own', async () => {
    await mountBlob();
    await frames(2);

    // The random per-axis drift that used to be set here accumulated forever
    // on z, which nothing corrects.
    expect(blob.setRotation).toHaveBeenCalledWith(0, 0, 0);
  });
});
