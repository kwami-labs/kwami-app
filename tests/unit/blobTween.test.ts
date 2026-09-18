/**
 * The login blob morphs between parameter sets rather than cutting to them.
 *
 * At the 1s default the visitor can pick, a cut every tick is the jitter — so
 * the property worth holding is that a blend part-way through actually lands
 * part-way, on every parameter, and that the endpoints are exact.
 */
import { describe, expect, it } from 'vitest';
import {
  blendShape,
  channelsToHex,
  cloneShape,
  randomShape,
  smoothstep,
  type BlobShape,
} from '../../src/utils/blobTween';

function shape(fill: number): BlobShape {
  return {
    spikes: [fill, fill, fill],
    amplitude: [fill, fill, fill],
    time: [fill, fill, fill],
    shininess: fill,
    channels: Array.from({ length: 9 }, () => fill),
  };
}

/** Every number in a shape, so a test can assert across all of them at once. */
function flatten(s: BlobShape): number[] {
  return [...s.spikes, ...s.amplitude, ...s.time, s.shininess, ...s.channels];
}

describe('blendShape', () => {
  it('lands exactly on the start at t=0', () => {
    const live = shape(0);
    blendShape(live, shape(1), shape(9), 0);
    expect(flatten(live).every((v) => v === 1)).toBe(true);
  });

  it('lands exactly on the destination at t=1', () => {
    const live = shape(0);
    blendShape(live, shape(1), shape(9), 1);
    expect(flatten(live).every((v) => v === 9)).toBe(true);
  });

  it('puts every parameter half way at t=0.5, none of them left behind', () => {
    const live = shape(0);
    blendShape(live, shape(0), shape(10), 0.5);
    expect(flatten(live)).toHaveLength(19);
    expect(flatten(live).every((v) => v === 5)).toBe(true);
  });

  it('writes in place rather than allocating a shape every frame', () => {
    const live = shape(0);
    const spikes = live.spikes;
    const channels = live.channels;
    blendShape(live, shape(1), shape(9), 0.5);

    expect(live.spikes).toBe(spikes);
    expect(live.channels).toBe(channels);
  });

  it('leaves the endpoints untouched, so a tween can be re-run', () => {
    const from = shape(1);
    const to = shape(9);
    blendShape(shape(0), from, to, 0.5);

    expect(flatten(from).every((v) => v === 1)).toBe(true);
    expect(flatten(to).every((v) => v === 9)).toBe(true);
  });
});

describe('smoothstep', () => {
  it('pins both ends', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
  });

  it('passes through the middle', () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
  });

  it('starts and ends slower than the middle, which is the point of easing', () => {
    expect(smoothstep(0.1)).toBeLessThan(0.1);
    expect(smoothstep(0.9)).toBeGreaterThan(0.9);
  });

  it('clamps a frame that overran its duration', () => {
    expect(smoothstep(1.4)).toBe(1);
    expect(smoothstep(-0.2)).toBe(0);
  });
});

describe('channelsToHex', () => {
  it('reads three channels from the offset it is given', () => {
    const channels = [255, 0, 0, 0, 255, 0, 0, 0, 255];
    expect(channelsToHex(channels, 0)).toBe('#ff0000');
    expect(channelsToHex(channels, 3)).toBe('#00ff00');
    expect(channelsToHex(channels, 6)).toBe('#0000ff');
  });

  it('pads a single hex digit, so the string is always seven characters', () => {
    expect(channelsToHex([1, 2, 3], 0)).toBe('#010203');
  });

  it('rounds the fractional channels a tween produces', () => {
    // 127.6 -> 0x80, 0.4 -> 0x00, 255 -> 0xff.
    expect(channelsToHex([127.6, 0.4, 255], 0)).toBe('#8000ff');
  });

  it('clamps rather than wrapping past the ends of the range', () => {
    expect(channelsToHex([-40, 300, 128], 0)).toBe('#00ff80');
  });

  it('treats a channel that is not there as black', () => {
    expect(channelsToHex([], 0)).toBe('#000000');
  });
});

describe('randomShape', () => {
  it('fills every parameter', () => {
    const s = randomShape();
    expect(flatten(s)).toHaveLength(19);
    expect(flatten(s).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('keeps each parameter inside the range BlobXyz is happy across', () => {
    for (let i = 0; i < 50; i += 1) {
      const s = randomShape();
      for (const v of s.spikes) expect(v).toBeGreaterThanOrEqual(0.2);
      for (const v of s.spikes) expect(v).toBeLessThanOrEqual(3.3);
      for (const v of s.amplitude) expect(v).toBeGreaterThanOrEqual(0.3);
      for (const v of s.amplitude) expect(v).toBeLessThanOrEqual(1.5);
      for (const v of s.time) expect(v).toBeGreaterThanOrEqual(0.5);
      for (const v of s.time) expect(v).toBeLessThanOrEqual(8);
      expect(s.shininess).toBeGreaterThanOrEqual(10);
      expect(s.shininess).toBeLessThanOrEqual(180);
      for (const v of s.channels) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of s.channels) expect(v).toBeLessThan(255);
    }
  });

  it('takes the low end of every range from a random that always returns 0', () => {
    const s = randomShape(() => 0);
    expect(s.spikes).toEqual([0.2, 0.2, 0.2]);
    expect(s.amplitude).toEqual([0.3, 0.3, 0.3]);
    expect(s.time).toEqual([0.5, 0.5, 0.5]);
    expect(s.shininess).toBe(10);
    expect(s.channels.every((v) => v === 0)).toBe(true);
  });
});

describe('cloneShape', () => {
  it('detaches the arrays, so blending the copy cannot move the original', () => {
    const original = shape(1);
    const copy = cloneShape(original);
    blendShape(copy, shape(1), shape(9), 1);

    expect(flatten(original).every((v) => v === 1)).toBe(true);
    expect(copy.spikes).not.toBe(original.spikes);
    expect(copy.channels).not.toBe(original.channels);
  });
});
