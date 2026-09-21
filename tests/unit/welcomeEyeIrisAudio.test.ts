/**
 * The login eye has to move with the music, not just the pointer.
 *
 * `welcomeBlobMotion.test.ts` holds the blob's half of this: no spin, a dip
 * on the beat. This file holds the eye's. The two used to share a path that
 * pushed enveloped loudness at `setAudioLevels` and then overwrote the pupil
 * from pointer motion alone, so a kick the blob danced to left the iris
 * still. The pulse is now poured into the bands, the reactivity, the pupil,
 * the shimmer and the flow — and that is what is pinned here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { RANDOMIZE_INTERVALS_MS, useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';
import {
  EYE_AUDIO_SMOOTHING,
  EYE_PUPIL_RESPONSE,
  EYE_RESTING_REACTIVITY,
  EYE_SHIMMER_RESPONSE,
} from '@/utils/welcomeEyeAudio';

const BIN_COUNT = 1_024;

const blobMesh = {
  rotation: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
};

const eyeMesh = {
  rotation: { x: 0, y: 0, z: 0 },
};

const audioEffects: Record<string, number> = {};
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

const eye = {
  getMesh: () => eyeMesh,
  getConfig: () => ({ geometry: { pupilRadius: 0.22 } }),
  setColors: vi.fn(),
  setAudioLevels: vi.fn(),
  setAudioSmoothing: vi.fn(),
  setAudioEnabled: vi.fn(),
  setAudioReactivity: vi.fn(),
  setPupilResponse: vi.fn(),
  setShimmerResponse: vi.fn(),
  setPatternFlow: vi.fn(),
  setShimmerStrength: vi.fn(),
  setShimmerSpeed: vi.fn(),
  setPupilRadius: vi.fn(),
};

const blob = {
  audioEffects,
  liquidPhysics: { stretch: 0, velocityX: 0, velocityY: 0 },
  getMesh: () => blobMesh,
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
  getEyeIris: vi.fn(() => eye),
  getAudio: vi.fn(() => ({
    getAudioElement: () => ({ paused }),
    getFrequencyData: () => spectrum,
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

const bed = (level: number) => fill(30, 7_000, level);
const withKick = (level: number, hit: number) => fill(30, 160, hit, bed(level));

const mounted: { unmount: () => void }[] = [];

async function mountEye() {
  const WelcomeBlob = (await import('@/components/auth/WelcomeBlob.vue')).default;
  const wrapper = mount(WelcomeBlob, { attachTo: document.body });
  mounted.push(wrapper);
  await vi.advanceTimersByTimeAsync(50);
  return wrapper;
}

async function frames(count: number, onFrame?: (index: number) => void) {
  for (let i = 0; i < count; i += 1) {
    onFrame?.(i);
    await vi.advanceTimersByTimeAsync(16);
  }
}

function lastCall(fn: { mock: { calls: unknown[][] } }): unknown[] {
  const calls = fn.mock.calls;
  return calls[calls.length - 1] ?? [];
}

beforeEach(() => {
  vi.useFakeTimers();
  eyeMesh.rotation.x = 0;
  eyeMesh.rotation.y = 0;
  blobMesh.rotation.x = 0;
  blobMesh.rotation.y = 0;
  blobMesh.rotation.z = 0;
  blobMesh.position.y = 0;
  spectrum = bed(0.5);
  paused = false;
  for (const key of Object.keys(audioEffects)) delete audioEffects[key];
  analyser.connect.mockClear();
  eye.setAudioLevels.mockClear();
  eye.setAudioSmoothing.mockClear();
  eye.setAudioEnabled.mockClear();
  eye.setAudioReactivity.mockClear();
  eye.setPupilResponse.mockClear();
  eye.setShimmerResponse.mockClear();
  eye.setPatternFlow.mockClear();
  eye.setShimmerStrength.mockClear();
  eye.setShimmerSpeed.mockClear();
  eye.setPupilRadius.mockClear();
  useWelcomeRandomizer().intervalMs.value = RANDOMIZE_INTERVALS_MS[0];
});

afterEach(async () => {
  while (mounted.length) mounted.pop()?.unmount();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
});

describe('the welcome eye under music', () => {
  it('turns the stock audio knobs up so a kick is visible', async () => {
    await mountEye();
    await frames(2);

    expect(eye.setAudioEnabled).toHaveBeenCalledWith(true);
    expect(eye.setAudioSmoothing).toHaveBeenCalledWith(EYE_AUDIO_SMOOTHING);
    expect(eye.setPupilResponse).toHaveBeenCalledWith(EYE_PUPIL_RESPONSE);
    expect(eye.setShimmerResponse).toHaveBeenCalledWith(EYE_SHIMMER_RESPONSE);
  });

  it('opens the pupil on the beat and draws it back', async () => {
    await mountEye();
    await frames(500);

    const quiet = [] as number[];
    await frames(60, () => {
      const [radius] = lastCall(eye.setPupilRadius);
      if (typeof radius === 'number') quiet.push(radius);
    });

    const beats = [] as number[];
    await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
      const [radius] = lastCall(eye.setPupilRadius);
      if (typeof radius === 'number') beats.push(radius);
    });

    const stillest = Math.max(...quiet);
    const widest = Math.max(...beats);

    expect(stillest).toBeLessThan(0.26);
    expect(widest).toBeGreaterThan(stillest + 0.06);
    expect(widest).toBeLessThanOrEqual(0.48);
  });

  it('drives reactivity from the pulse, not just the mix', async () => {
    await mountEye();
    await frames(500);

    const phrase = lastCall(eye.setAudioReactivity)[0] as number;

    let loudest = 0;
    await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
      const [reactivity] = lastCall(eye.setAudioReactivity);
      if (typeof reactivity === 'number') loudest = Math.max(loudest, reactivity);
    });

    expect(phrase).toBeGreaterThan(EYE_RESTING_REACTIVITY);
    expect(loudest).toBeGreaterThan(phrase * 1.8);
  });

  it('pours the kick into the bands the eye collapses', async () => {
    await mountEye();
    await frames(500);

    const quiet = lastCall(eye.setAudioLevels) as number[];

    let peakBass = 0;
    await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
      const [bass] = lastCall(eye.setAudioLevels);
      if (typeof bass === 'number') peakBass = Math.max(peakBass, bass);
    });

    expect(quiet[0]).toBeGreaterThan(0);
    expect(peakBass).toBeGreaterThan((quiet[0] as number) + 0.25);
  });

  it('surges shimmer and flow on the beat', async () => {
    await mountEye();
    await frames(500);

    const restFlow = lastCall(eye.setPatternFlow)[0] as number;
    const restShimmer = lastCall(eye.setShimmerStrength)[0] as number;

    let peakFlow = 0;
    let peakShimmer = 0;
    await frames(120, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
      const [flow] = lastCall(eye.setPatternFlow);
      const [shimmer] = lastCall(eye.setShimmerStrength);
      if (typeof flow === 'number') peakFlow = Math.max(peakFlow, flow);
      if (typeof shimmer === 'number') peakShimmer = Math.max(peakShimmer, shimmer);
    });

    expect(peakFlow).toBeGreaterThan(restFlow + 0.2);
    expect(peakShimmer).toBeGreaterThan(restShimmer + 0.15);
  });

  it('lets the pupil fall away when the music stops', async () => {
    await mountEye();
    await frames(500);
    await frames(80, (i) => {
      spectrum = i % 30 < 4 ? withKick(0.5, 0.95) : bed(0.5);
    });

    paused = true;
    await frames(80);

    const settled = lastCall(eye.setPupilRadius)[0] as number;
    expect(settled).toBeLessThan(0.26);
  });
});
