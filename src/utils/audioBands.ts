/**
 * Splitting an analyser's byte-frequency data into the three bands the avatar
 * renderers speak.
 *
 * `BlobXyz` reads the analyser itself, inside the SDK, so it never needs this.
 * Black-hole, particles-face and eye-iris do not: they want
 * `setAudioLevels(bass, mid, high)` pushed at them once a frame. Both the
 * settings panel's music player and the login screen do that pushing, and they
 * have to split the spectrum the same way or the same track would move the two
 * avatars differently.
 */

export interface BandLevels {
  /** 0–1. */
  bass: number;
  /** 0–1. */
  mid: number;
  /** 0–1. */
  high: number;
}

export const SILENCE: BandLevels = { bass: 0, mid: 0, high: 0 };

/**
 * Mean magnitude of the low tenth, the next three tenths, and the rest of the
 * spectrum, each normalised to 0–1.
 *
 * @param frequencyData - As handed back by `AnalyserNode.getByteFrequencyData`.
 */
export function getBandLevels(frequencyData: Uint8Array): BandLevels {
  if (!frequencyData.length) {
    return { ...SILENCE };
  }

  const length = frequencyData.length;
  const bassEnd = Math.max(1, Math.floor(length * 0.1));
  const midEnd = Math.max(bassEnd + 1, Math.floor(length * 0.4));

  let bassSum = 0;
  let midSum = 0;
  let highSum = 0;

  for (let i = 0; i < bassEnd; i += 1) bassSum += frequencyData[i] ?? 0;
  for (let i = bassEnd; i < midEnd; i += 1) midSum += frequencyData[i] ?? 0;
  for (let i = midEnd; i < length; i += 1) highSum += frequencyData[i] ?? 0;

  return {
    bass: bassSum / bassEnd / 255,
    mid: midSum / Math.max(1, midEnd - bassEnd) / 255,
    high: highSum / Math.max(1, length - midEnd) / 255,
  };
}

/**
 * How fast an envelope follows a band up and down, in milliseconds.
 *
 * Asymmetric on purpose. FFT magnitudes are noisy frame to frame, and
 * smoothing them evenly buys calm by flattening the hits — the avatar stops
 * twitching but also stops landing on the beat. A short attack keeps the hit
 * and a long release lets it fall away over a musical length instead of
 * snapping back before the next frame.
 */
export interface BandEnvelopeOptions {
  /** Time to cover ~63% of a rise. Short enough that transients survive. */
  attackMs?: number;
  /** The same on the way down, and the knob that reads as "musical". */
  releaseMs?: number;
}

export interface BandEnvelope {
  /**
   * Advance the envelope by `deltaMs` towards `levels` and report where it is.
   *
   * @param levels - Raw bands, as `getBandLevels` hands them back.
   * @param deltaMs - Since the last call. Frames are not evenly spaced, so the
   *   coefficient is derived from this rather than assumed to be 1/60s.
   */
  follow(levels: BandLevels, deltaMs: number): BandLevels;
  /** Drop back to silence — a new track, or a renderer that just appeared. */
  reset(): void;
}

const DEFAULT_ATTACK_MS = 45;
const DEFAULT_RELEASE_MS = 320;

/**
 * A frame that arrives later than this is treated as this long.
 *
 * A backgrounded tab stops calling `requestAnimationFrame`, so the first frame
 * after it comes back carries seconds of delta. The exponential below saturates
 * rather than overshooting, so the clamp is only there to keep the behaviour
 * the same whether the gap was two seconds or twenty.
 */
const MAX_DELTA_MS = 250;

/** Fraction of the way to the target that `ms` at time constant `tau` covers. */
function coefficient(ms: number, tau: number): number {
  if (tau <= 0) return 1;
  return 1 - Math.exp(-ms / tau);
}

/**
 * An envelope follower over the three bands.
 *
 * One per consumer: it carries state, so two renderers sharing an instance
 * would advance each other's envelope by their own frame deltas.
 */
export function createBandEnvelope(options: BandEnvelopeOptions = {}): BandEnvelope {
  const attackMs = options.attackMs ?? DEFAULT_ATTACK_MS;
  const releaseMs = options.releaseMs ?? DEFAULT_RELEASE_MS;

  const current: BandLevels = { ...SILENCE };

  function step(value: number, target: number, ms: number): number {
    const tau = target > value ? attackMs : releaseMs;
    return value + (target - value) * coefficient(ms, tau);
  }

  return {
    follow(levels, deltaMs) {
      const ms = Math.min(MAX_DELTA_MS, Math.max(0, deltaMs));
      if (ms > 0) {
        current.bass = step(current.bass, levels.bass, ms);
        current.mid = step(current.mid, levels.mid, ms);
        current.high = step(current.high, levels.high, ms);
      }
      return { ...current };
    },
    reset() {
      current.bass = 0;
      current.mid = 0;
      current.high = 0;
    },
  };
}
