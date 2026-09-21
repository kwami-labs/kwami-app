/**
 * How the login eye answers a track.
 *
 * The blob can reach inside the SDK: `animateBlobXyz` re-reads `audioEffects`
 * every frame, so `WelcomeBlob` writes `reactivity` from `musicPulse` and the
 * mesh sings. The eye cannot. It only exposes `setAudioLevels` plus a handful
 * of uniforms, and it collapses the three bands to one level that it then
 * lerps by `1 - smoothing`. Handing it enveloped loudness through 0.88
 * smoothing — which is what this screen used to do — produced a swell that
 * barely moved, because a kick is a few bins in a 2048-point FFT and is
 * averaged away before the pupil ever sees it. Same detector as the blob,
 * different sink: the pulse is the syllable, the bands are how loud, and the
 * pupil / shimmer / flow are what the visitor can actually see.
 *
 * The numbers were measured against the same 120bpm kick the blob was tuned
 * on. Weighting the same total towards the pulse is what takes the pupil from
 * sitting half-open to snapping with the beat; the quiet between hits has to
 * be smaller, not the peak bigger.
 */

import type { BandLevels } from './audioBands';

/**
 * The eye lerps by `1 - smoothing`, so higher is slower. Below the stock 0.82
 * on purpose: the bands still arrive enveloped, but a kick that has already
 * been smoothed twice is no longer a kick. 0.58 keeps a frame of the hit.
 */
export const EYE_AUDIO_SMOOTHING = 0.58;

/**
 * Backup dilation the SDK adds on top of our own write, if its frame wins.
 *
 * Kept small on purpose. At 0.48 the loudness term held the pupil half-open
 * for the whole track and the beat had nowhere to go — the same standing
 * swell the blob used to have. 0.14 is enough that a missed write still
 * twitches, and small enough that a hit can still open from rest.
 */
export const EYE_PUPIL_RESPONSE = 0.14;

/** How far the same drive lifts `uShimmerStrength`. The shader then * 0.06. */
export const EYE_SHIMMER_RESPONSE = 0.7;

/**
 * Phrase, then syllable, same split as the blob's reactivity.
 *
 * The three sum to 3.0. The SDK multiplies this by the weighted bands (around
 * 0.35 on a typical mix), so the real peak sits near 1 and the pupil clamp
 * at 0.48 is what actually shapes the look, not this sum.
 */
export const EYE_RESTING_REACTIVITY = 0.5;
export const EYE_LEVEL_REACTIVITY = 0.65;
export const EYE_PULSE_REACTIVITY = 1.85;

/**
 * How much of a hit is poured back into each band before `setAudioLevels`.
 *
 * The eye weights bass 0.45 / mid 0.35 / high 0.2 when it collapses them, so
 * the kick band has to carry most of the pulse or a snare-only hit would
 * barely move the pupil.
 */
export const EYE_PULSE_BASS = 0.9;
export const EYE_PULSE_MID = 0.6;
export const EYE_PULSE_HIGH = 0.4;

/** Extra iris radii the pupil opens on a full-scale pulse, on top of pointer. */
export const EYE_PUPIL_PULSE = 0.24;
export const EYE_PUPIL_MIN = 0.12;
export const EYE_PUPIL_MAX = 0.48;

export const EYE_FLOW_REST = 0.22;
export const EYE_FLOW_LEVEL = 0.2;
export const EYE_FLOW_PULSE = 0.62;

export const EYE_SHIMMER_STRENGTH_REST = 0.1;
export const EYE_SHIMMER_STRENGTH_LEVEL = 0.18;
export const EYE_SHIMMER_STRENGTH_PULSE = 0.55;

export const EYE_SHIMMER_SPEED_REST = 0.18;
export const EYE_SHIMMER_SPEED_PULSE = 0.5;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Reactivity the eye is driven at this frame. */
export function eyeReactivity(level: number, pulse: number): number {
  return (
    EYE_RESTING_REACTIVITY +
    EYE_LEVEL_REACTIVITY * clamp01(level) +
    EYE_PULSE_REACTIVITY * clamp01(pulse)
  );
}

/**
 * Pour the beat back into the bands the eye collapses.
 *
 * A held chord leaves `pulse` near zero and the bands pass through; a kick
 * lifts them so `setAudioLevels` sees a spike even after the loudness
 * envelope has already flattened the raw FFT.
 */
export function boostEyeLevels(levels: BandLevels, pulse: number): BandLevels {
  const hit = clamp01(pulse);
  return {
    bass: clamp01(levels.bass + hit * EYE_PULSE_BASS),
    mid: clamp01(levels.mid + hit * EYE_PULSE_MID),
    high: clamp01(levels.high + hit * EYE_PULSE_HIGH),
  };
}

/** Pupil radius for this frame: rest pose, pointer dilation, then the beat. */
export function eyePupilRadius(base: number, pointerBoost: number, pulse: number): number {
  return clamp(
    base + pointerBoost + clamp01(pulse) * EYE_PUPIL_PULSE,
    EYE_PUPIL_MIN,
    EYE_PUPIL_MAX,
  );
}

export function eyePatternFlow(level: number, pulse: number): number {
  return EYE_FLOW_REST + EYE_FLOW_LEVEL * clamp01(level) + EYE_FLOW_PULSE * clamp01(pulse);
}

export function eyeShimmerStrength(level: number, pulse: number): number {
  return (
    EYE_SHIMMER_STRENGTH_REST +
    EYE_SHIMMER_STRENGTH_LEVEL * clamp01(level) +
    EYE_SHIMMER_STRENGTH_PULSE * clamp01(pulse)
  );
}

export function eyeShimmerSpeed(pulse: number): number {
  return EYE_SHIMMER_SPEED_REST + EYE_SHIMMER_SPEED_PULSE * clamp01(pulse);
}
