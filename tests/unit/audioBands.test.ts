import { describe, expect, it } from 'vitest';
import { createBandEnvelope, getBandLevels, SILENCE } from '../../src/utils/audioBands';

/** `length * 0.1` and `length * 0.4` put the splits at 10 and 40 of these. */
function spectrum(fill: (index: number) => number, length = 100) {
  return Uint8Array.from({ length }, (_, i) => fill(i));
}

describe('getBandLevels', () => {
  it('reports silence for an empty analyser buffer', () => {
    expect(getBandLevels(new Uint8Array())).toEqual(SILENCE);
  });

  it('does not hand back the shared SILENCE object, which callers could mutate', () => {
    const levels = getBandLevels(new Uint8Array());
    levels.bass = 1;
    expect(SILENCE.bass).toBe(0);
  });

  it('normalises a full-scale spectrum to 1 across every band', () => {
    expect(getBandLevels(spectrum(() => 255))).toEqual({ bass: 1, mid: 1, high: 1 });
  });

  it('reports zero across every band for a silent spectrum', () => {
    expect(getBandLevels(spectrum(() => 0))).toEqual({ bass: 0, mid: 0, high: 0 });
  });

  it('keeps energy in the band it belongs to', () => {
    const bassOnly = getBandLevels(spectrum((i) => (i < 10 ? 255 : 0)));
    expect(bassOnly.bass).toBe(1);
    expect(bassOnly.mid).toBe(0);
    expect(bassOnly.high).toBe(0);

    const midOnly = getBandLevels(spectrum((i) => (i >= 10 && i < 40 ? 255 : 0)));
    expect(midOnly.bass).toBe(0);
    expect(midOnly.mid).toBe(1);
    expect(midOnly.high).toBe(0);

    const highOnly = getBandLevels(spectrum((i) => (i >= 40 ? 255 : 0)));
    expect(highOnly.bass).toBe(0);
    expect(highOnly.mid).toBe(0);
    expect(highOnly.high).toBe(1);
  });

  it('averages within a band rather than summing', () => {
    // Half of the bass bins lit: the band reads half, not five times over.
    const levels = getBandLevels(spectrum((i) => (i < 5 ? 255 : 0)));
    expect(levels.bass).toBeCloseTo(0.5, 5);
  });

  it('survives a buffer too short to split cleanly', () => {
    // length 2 -> bassEnd clamps to 1, midEnd to 2, leaving the high band empty.
    const levels = getBandLevels(Uint8Array.from([255, 255]));
    expect(levels.bass).toBe(1);
    expect(levels.mid).toBe(1);
    expect(levels.high).toBe(0);
    expect(Number.isNaN(levels.high)).toBe(false);
  });
});

describe('createBandEnvelope', () => {
  const LOUD = { bass: 1, mid: 1, high: 1 };

  it('starts at silence', () => {
    expect(createBandEnvelope().follow(LOUD, 0)).toEqual(SILENCE);
  });

  it('approaches a rise without arriving in a single frame', () => {
    const envelope = createBandEnvelope({ attackMs: 45, releaseMs: 320 });
    const levels = envelope.follow(LOUD, 16);

    expect(levels.bass).toBeGreaterThan(0);
    expect(levels.bass).toBeLessThan(1);
  });

  it('covers about 63% of a rise in one attack time constant', () => {
    const envelope = createBandEnvelope({ attackMs: 45, releaseMs: 320 });
    expect(envelope.follow(LOUD, 45).bass).toBeCloseTo(1 - Math.exp(-1), 5);
  });

  it('falls slower than it rises, which is what reads as musical', () => {
    const envelope = createBandEnvelope({ attackMs: 45, releaseMs: 320 });
    const peak = envelope.follow(LOUD, 45).bass;
    const afterSameGapOfSilence = envelope.follow(SILENCE, 45).bass;

    const rose = peak;
    const fell = peak - afterSameGapOfSilence;
    expect(fell).toBeLessThan(rose);
  });

  it('holds still across a frame that took no time', () => {
    const envelope = createBandEnvelope();
    const before = envelope.follow(LOUD, 20).bass;
    expect(envelope.follow(LOUD, 0).bass).toBe(before);
  });

  it('treats a negative delta as no time at all', () => {
    const envelope = createBandEnvelope();
    const before = envelope.follow(LOUD, 20).bass;
    expect(envelope.follow(LOUD, -500).bass).toBe(before);
  });

  it('settles on the target rather than overshooting it after a long gap', () => {
    // A backgrounded tab stops calling rAF; the frame that resumes it carries
    // seconds of delta. The clamp caps that at a quarter second, so the
    // envelope arrives all but exactly rather than literally — and, either
    // way, never past the target.
    const levels = createBandEnvelope().follow(LOUD, 30_000);
    expect(levels.bass).toBeLessThanOrEqual(1);
    expect(levels.bass).toBeGreaterThan(0.99);
  });

  it('caps a long gap, so a tab restored after a minute behaves like one after a second', () => {
    const afterAMinute = createBandEnvelope().follow(LOUD, 60_000).bass;
    const afterTheClamp = createBandEnvelope().follow(LOUD, 250).bass;

    expect(afterAMinute).toBe(afterTheClamp);
  });

  it('does not hand back the state it is about to keep advancing', () => {
    const envelope = createBandEnvelope();
    const levels = envelope.follow(LOUD, 45);
    levels.bass = 99;

    expect(envelope.follow(LOUD, 0).bass).toBeLessThan(1);
  });

  it('drops back to silence on reset', () => {
    const envelope = createBandEnvelope();
    envelope.follow(LOUD, 1_000);
    envelope.reset();

    expect(envelope.follow(LOUD, 0)).toEqual(SILENCE);
  });

  it('keeps each band on its own envelope', () => {
    const envelope = createBandEnvelope({ attackMs: 45, releaseMs: 320 });
    const levels = envelope.follow({ bass: 1, mid: 0, high: 0.5 }, 45);

    expect(levels.bass).toBeGreaterThan(levels.high);
    expect(levels.mid).toBe(0);
  });
});
