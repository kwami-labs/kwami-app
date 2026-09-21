/**
 * The detector has to report the beat, not the volume.
 *
 * That distinction is the whole reason the file exists, and it is the one a
 * plausible-looking rewrite would lose: anything that reports "how much energy
 * is in the bass" passes a casual eye and produces an avatar that swells with
 * the track and never lands on a hit. So the properties held here are the
 * awkward ones — a loud steady bed must read as *nothing*, and a quiet track
 * must pulse as hard as a loud one.
 */
import { describe, expect, it, vi } from 'vitest';
import { createMusicPulse } from '../../src/utils/musicPulse';

const SAMPLE_RATE = 44_100;
const FFT_SIZE = 2_048;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
const BIN_COUNT = FFT_SIZE / 2;

/** One frame at 60 Hz, which is what the component feeds it. */
const FRAME_MS = 16;

function bin(hz: number): number {
  return Math.round(hz / BIN_HZ);
}

/**
 * A spectrum with a flat level between two frequencies.
 *
 * Levels are 0–1 and land as the bytes an analyser would hand back, so the
 * numbers in the tests read the same way they do in the detector.
 */
function spectrum(...regions: { fromHz: number; toHz: number; level: number }[]): Uint8Array {
  const data = new Uint8Array(BIN_COUNT);
  for (const { fromHz, toHz, level } of regions) {
    for (let i = bin(fromHz); i < Math.min(BIN_COUNT, bin(toHz)); i += 1) {
      data[i] = Math.round(Math.max(0, Math.min(1, level)) * 255);
    }
  }
  return data;
}

/** The whole musical range at one level: a held chord, or a wall of noise. */
function bed(level: number): Uint8Array {
  return spectrum({ fromHz: 30, toHz: 7_000, level });
}

/** A bed with the low end lifted, which is what a kick looks like in a spectrum. */
function kick(level: number, hit: number): Uint8Array {
  const data = bed(level);
  for (let i = bin(30); i < bin(160); i += 1) data[i] = Math.round(Math.min(1, hit) * 255);
  return data;
}

/**
 * An analyser good enough for the detector: it creates a tap off its context
 * and reads that, so the fake has to be able to hand one back.
 */
function fakeAnalyser() {
  let current = new Uint8Array(BIN_COUNT);

  const context = {
    sampleRate: SAMPLE_RATE,
    createAnalyser: () => ({
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.35,
      minDecibels: -90,
      maxDecibels: -10,
      get frequencyBinCount() {
        return this.fftSize / 2;
      },
      context,
      getByteFrequencyData(out: Uint8Array) {
        out.set(current);
      },
    }),
  };

  return {
    node: { context, connect: vi.fn() } as unknown as AnalyserNode,
    /** What the next `read` will see. */
    play(data: Uint8Array) {
      current = data;
    },
  };
}

/** Run `frames` frames of `data`, and report the highest pulse seen. */
function run(
  pulse: ReturnType<typeof createMusicPulse>,
  source: ReturnType<typeof fakeAnalyser>,
  data: Uint8Array,
  frames: number,
): { peak: number; last: number } {
  source.play(data);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < frames; i += 1) {
    last = pulse.read(FRAME_MS).pulse;
    peak = Math.max(peak, last);
  }
  return { peak, last };
}

function attached() {
  const source = fakeAnalyser();
  const pulse = createMusicPulse();
  pulse.attach(source.node);
  return { pulse, source };
}

describe('createMusicPulse', () => {
  it('settles to nothing under a loud steady bed', () => {
    const { pulse, source } = attached();

    // Eight seconds. The baseline starts cold, so a track coming in from
    // silence is itself an onset and correctly reads as one — this has to run
    // well past the slow envelope's time constant for the rise to be spent.
    const { last } = run(pulse, source, bed(0.8), 500);

    expect(last).toBeLessThan(0.02);
  });

  it('reports a hit against that same bed', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.5), 250);

    const { peak } = run(pulse, source, kick(0.5, 0.95), 10);

    expect(peak).toBeGreaterThan(0.4);
  });

  it('pulses as hard on a quiet track as on a loud one', () => {
    // The point of measuring a rise against a baseline rather than a level:
    // turning the music down must not turn the dancing down with it.
    function peakFor(bedLevel: number, hitLevel: number) {
      const { pulse, source } = attached();
      run(pulse, source, bed(bedLevel), 250);
      return run(pulse, source, kick(bedLevel, hitLevel), 10).peak;
    }

    const loud = peakFor(0.6, 0.9);
    const quiet = peakFor(0.25, 0.55);

    expect(quiet).toBeGreaterThan(0.3);
    expect(Math.abs(loud - quiet)).toBeLessThan(0.25);
  });

  it('falls back between hits rather than staying up', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.5), 250);
    const { peak } = run(pulse, source, kick(0.5, 0.95), 8);

    // Half a second of the bed again — a beat and a half at 120bpm.
    const { last } = run(pulse, source, bed(0.5), 31);

    expect(peak).toBeGreaterThan(0.4);
    expect(last).toBeLessThan(peak * 0.25);
  });

  it('treats a sustained loud bass note as a single hit, not a held beat', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.4), 250);

    // The note arrives, and then just stays. Six seconds of holding it, which
    // is several times the baseline's own time constant — the baseline has to
    // climb to the note before the note stops reading as a rise, and at this
    // gain a half-scale step still shows a little after three.
    const onset = run(pulse, source, kick(0.4, 0.9), 10);
    const held = run(pulse, source, kick(0.4, 0.9), 375);

    expect(onset.peak).toBeGreaterThan(0.4);
    expect(held.last).toBeLessThan(0.05);
  });

  it('ignores a wobble in a band that is only hiss', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.01), 250);

    const { peak } = run(pulse, source, spectrum({ fromHz: 30, toHz: 7_000, level: 0.04 }), 20);

    expect(peak).toBe(0);
  });

  it('falls away while nothing is playing', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.4), 250);
    run(pulse, source, kick(0.4, 0.95), 6);

    let last = 1;
    for (let i = 0; i < 90; i += 1) last = pulse.read(FRAME_MS, false).pulse;

    expect(last).toBeLessThan(0.01);
  });

  it('measures the first hit after a pause against a baseline the silence lowered', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.7), 250);

    // Paused for two seconds, then the track comes back in on a hit.
    for (let i = 0; i < 125; i += 1) pulse.read(FRAME_MS, false);
    const { peak } = run(pulse, source, kick(0.7, 0.95), 10);

    expect(peak).toBeGreaterThan(0.4);
  });

  it('reports silence rather than throwing where there is no Web Audio', () => {
    const pulse = createMusicPulse();
    pulse.attach(null);

    expect(pulse.read(FRAME_MS).pulse).toBe(0);

    // An analyser whose context cannot make a tap: a jsdom stub, or a closed one.
    pulse.attach({ context: undefined, connect: () => {} } as unknown as AnalyserNode);

    expect(pulse.read(FRAME_MS).pulse).toBe(0);
  });

  it('re-asserts its tap, because rebuilding the audio graph drops it', () => {
    // `KwamiAudio.rebuildAudioGraph()` disconnects the analyser whenever a
    // sound filter is toggled. Without this, changing one setting would kill
    // the dancing for the rest of the session — silently, since nothing throws.
    vi.useFakeTimers();
    try {
      const source = fakeAnalyser();
      const connect = source.node.connect as ReturnType<typeof vi.fn>;
      const pulse = createMusicPulse();

      pulse.attach(source.node);
      expect(connect).toHaveBeenCalledTimes(1);

      // Called every frame, as the component does. Nothing extra happens
      // inside the window — the tap is not rebuilt sixty times a second.
      for (let i = 0; i < 20; i += 1) {
        vi.advanceTimersByTime(16);
        pulse.attach(source.node);
      }
      expect(connect).toHaveBeenCalledTimes(1);

      // Past the refresh window, the edge goes back on whether or not it fell off.
      vi.advanceTimersByTime(600);
      pulse.attach(source.node);
      expect(connect).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets go of the tap on dispose', () => {
    const source = fakeAnalyser();
    const disconnect = vi.fn();
    (source.node as unknown as { disconnect: unknown }).disconnect = disconnect;

    const pulse = createMusicPulse();
    pulse.attach(source.node);
    pulse.dispose();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(pulse.read(FRAME_MS).pulse).toBe(0);
  });

  it('resets to silence', () => {
    const { pulse, source } = attached();
    run(pulse, source, bed(0.4), 250);
    run(pulse, source, kick(0.4, 0.95), 6);

    pulse.reset();

    expect(pulse.read(0).pulse).toBe(0);
  });
});
