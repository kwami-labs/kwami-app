import { describe, expect, it } from 'vitest';
import { getBandLevels, SILENCE } from '../../src/utils/audioBands';

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
