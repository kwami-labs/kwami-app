/**
 * The login eye has to land on the beat, not swell with the mix.
 *
 * `getBandLevels` barely moves on a kick — that is the whole reason this
 * helper exists — so the pulse is poured back into the bands and into the
 * pupil / shimmer / flow the visitor can see. The numbers are the contract:
 * a held chord leaves them near rest, a hit has to be most of what is heard.
 */
import { describe, expect, it } from 'vitest';
import { SILENCE } from '../../src/utils/audioBands';
import {
  boostEyeLevels,
  eyePatternFlow,
  eyePupilRadius,
  eyeReactivity,
  eyeShimmerSpeed,
  eyeShimmerStrength,
  EYE_AUDIO_SMOOTHING,
  EYE_FLOW_PULSE,
  EYE_FLOW_REST,
  EYE_LEVEL_REACTIVITY,
  EYE_PULSE_BASS,
  EYE_PULSE_REACTIVITY,
  EYE_PUPIL_MAX,
  EYE_PUPIL_MIN,
  EYE_PUPIL_PULSE,
  EYE_PUPIL_RESPONSE,
  EYE_RESTING_REACTIVITY,
  EYE_SHIMMER_RESPONSE,
} from '../../src/utils/welcomeEyeAudio';

describe('eyeReactivity', () => {
  it('sings the held phrase and accents the beat on top', () => {
    const phrase = eyeReactivity(0.6, 0);
    const hit = eyeReactivity(0.6, 1);

    expect(phrase).toBeGreaterThan(EYE_RESTING_REACTIVITY);
    expect(hit).toBeGreaterThan(phrase * 1.8);
    expect(hit).toBeLessThanOrEqual(
      EYE_RESTING_REACTIVITY + EYE_LEVEL_REACTIVITY + EYE_PULSE_REACTIVITY,
    );
  });

  it('does not treat a rest as a hit', () => {
    expect(eyeReactivity(0, 0)).toBe(EYE_RESTING_REACTIVITY);
  });
});

describe('boostEyeLevels', () => {
  it('leaves a held chord alone', () => {
    const bed = { bass: 0.4, mid: 0.3, high: 0.15 };
    expect(boostEyeLevels(bed, 0)).toEqual(bed);
  });

  it('pours a kick into the bass the eye weights most', () => {
    const boosted = boostEyeLevels(SILENCE, 1);
    expect(boosted.bass).toBe(EYE_PULSE_BASS);
    expect(boosted.bass).toBeGreaterThan(boosted.mid);
    expect(boosted.mid).toBeGreaterThan(boosted.high);
  });

  it('does not overflow a band that was already loud', () => {
    const boosted = boostEyeLevels({ bass: 0.8, mid: 0.8, high: 0.8 }, 1);
    expect(boosted.bass).toBe(1);
    expect(boosted.mid).toBe(1);
    expect(boosted.high).toBe(1);
  });
});

describe('eyePupilRadius', () => {
  it('opens on the beat from the rest pose', () => {
    const rest = eyePupilRadius(0.22, 0, 0);
    const hit = eyePupilRadius(0.22, 0, 1);
    expect(hit).toBeGreaterThan(rest + EYE_PUPIL_PULSE * 0.99);
    expect(hit).toBeLessThanOrEqual(EYE_PUPIL_MAX);
  });

  it('stays inside the iris', () => {
    expect(eyePupilRadius(0.4, 0.3, 1)).toBe(EYE_PUPIL_MAX);
    expect(eyePupilRadius(0.05, 0, 0)).toBe(EYE_PUPIL_MIN);
  });
});

describe('eye shimmer and flow', () => {
  it('keep the fibres moving between beats and surge on one', () => {
    expect(eyePatternFlow(0, 0)).toBe(EYE_FLOW_REST);
    expect(eyePatternFlow(0.4, 1)).toBeGreaterThan(EYE_FLOW_REST + EYE_FLOW_PULSE * 0.99);
    expect(eyeShimmerStrength(0, 1)).toBeGreaterThan(eyeShimmerStrength(0.5, 0));
    expect(eyeShimmerSpeed(1)).toBeGreaterThan(eyeShimmerSpeed(0));
  });
});

describe('the knobs the SDK multiplies audioDrive by', () => {
  it('are faster and stronger than the stock eye, so a kick is visible', () => {
    // Stock is 0.82 / 0.22 / 0.35. The login screen used to raise smoothing
    // to 0.88 on top of an envelope, which is why the pupil sat still.
    expect(EYE_AUDIO_SMOOTHING).toBeLessThan(0.82);
    expect(EYE_SHIMMER_RESPONSE).toBeGreaterThan(0.35);
    // A large pupilResponse is a standing swell: the beat has nowhere to go.
    expect(EYE_PUPIL_RESPONSE).toBeLessThan(0.22);
    expect(EYE_PUPIL_PULSE).toBeGreaterThan(EYE_PUPIL_RESPONSE);
  });
});
