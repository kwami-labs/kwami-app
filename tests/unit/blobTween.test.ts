/**
 * The login blob morphs between parameter sets rather than cutting to them.
 *
 * At the 1s default the visitor can pick, a cut every tick is the jitter — so
 * the property worth holding is that a blend part-way through actually lands
 * part-way, on every parameter, and that the endpoints are exact.
 */
import { describe, expect, it } from 'vitest';
import {
  AMPLITUDE_RANGE,
  SPIKE_RANGE,
  TIME_RANGE,
  amplitudeCeiling,
  blendShape,
  channelsToHex,
  cloneShape,
  driftShape,
  randomShape,
  remixShape,
  scaleAudioSpikeEffects,
  shapeDensity,
  smoothstep,
  AUDIO_SPIKE_WEIGHT_FLOOR,
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
      for (const v of s.spikes) expect(v).toBeGreaterThanOrEqual(SPIKE_RANGE[0]);
      for (const v of s.spikes) expect(v).toBeLessThanOrEqual(SPIKE_RANGE[1]);
      for (const v of s.amplitude) expect(v).toBeGreaterThanOrEqual(AMPLITUDE_RANGE[0]);
      for (const v of s.amplitude) expect(v).toBeLessThanOrEqual(AMPLITUDE_RANGE[1]);
      for (const v of s.time) expect(v).toBeGreaterThanOrEqual(TIME_RANGE[0]);
      for (const v of s.time) expect(v).toBeLessThanOrEqual(TIME_RANGE[1]);
      expect(s.shininess).toBeGreaterThanOrEqual(10);
      expect(s.shininess).toBeLessThanOrEqual(180);
      for (const v of s.channels) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of s.channels) expect(v).toBeLessThan(255);
    }
  });

  it('takes the low end of every range from a random that always returns 0', () => {
    const s = randomShape(() => 0);
    expect(s.spikes).toEqual([SPIKE_RANGE[0], SPIKE_RANGE[0], SPIKE_RANGE[0]]);
    expect(s.amplitude).toEqual([AMPLITUDE_RANGE[0], AMPLITUDE_RANGE[0], AMPLITUDE_RANGE[0]]);
    expect(s.time).toEqual([TIME_RANGE[0], TIME_RANGE[0], TIME_RANGE[0]]);
    expect(s.shininess).toBe(10);
    expect(s.channels.every((v) => v === 0)).toBe(true);
  });

  it('stays above the one-lobe frequencies that turn the body into a cone', () => {
    for (let i = 0; i < 50; i += 1) {
      const s = randomShape();
      for (const v of s.spikes) expect(v).toBeGreaterThan(0.6);
    }
  });
});

describe('amplitudeCeiling', () => {
  it('gives the roundest bodies the whole range and the densest the least of it', () => {
    const round = amplitudeCeiling([SPIKE_RANGE[0], SPIKE_RANGE[0], SPIKE_RANGE[0]]);
    const dense = amplitudeCeiling([SPIKE_RANGE[1], SPIKE_RANGE[1], SPIKE_RANGE[1]]);

    expect(round).toBe(AMPLITUDE_RANGE[1]);
    expect(dense).toBeLessThan(0.7);
    expect(dense).toBeGreaterThan(AMPLITUDE_RANGE[0]);
  });

  it('falls the whole way across the band, without a step in it', () => {
    let previous = Infinity;
    for (let spike = SPIKE_RANGE[0]; spike <= SPIKE_RANGE[1]; spike += 0.1) {
      const ceiling = amplitudeCeiling([spike, spike, spike]);
      expect(ceiling).toBeLessThanOrEqual(previous);
      previous = ceiling;
    }
  });

  it('reads a body as dense as its axes are on the whole', () => {
    // One round axis does not earn the other two any height back.
    const mixed = amplitudeCeiling([SPIKE_RANGE[0], SPIKE_RANGE[1], 3.2]);
    const even = amplitudeCeiling([3.2, 3.2, 3.2]);

    expect(mixed).toBeCloseTo(even, 1);
  });
});

describe('the amplitude budget', () => {
  it('never rolls a body that is both dense and tall', () => {
    for (let i = 0; i < 200; i += 1) {
      const s = randomShape();
      const ceiling = amplitudeCeiling(s.spikes);
      for (const v of s.amplitude) expect(v).toBeLessThanOrEqual(ceiling);
    }
  });

  it('holds across a remix, which re-rolls the spikes under the amplitude', () => {
    let live = randomShape();
    for (let i = 0; i < 80; i += 1) {
      live = remixShape(live);
      const ceiling = amplitudeCeiling(live.spikes);
      for (const v of live.amplitude) expect(v).toBeLessThanOrEqual(ceiling);
    }
  });

  it('holds every frame of a tween, not only its endpoints', () => {
    // The budget is linear in the mean spike frequency, so the shapes that
    // satisfy it form a convex set and a straight line between two of them
    // cannot leave it. Worth pinning rather than reasoning about: the login
    // screen shows the blob *mid-tween* almost all of the time, and a budget
    // that only held at the ends would be a budget that never held on screen.
    const live = randomShape();
    for (let i = 0; i < 40; i += 1) {
      const from = cloneShape(live);
      const to = remixShape(from);
      for (let step = 0; step <= 10; step += 1) {
        blendShape(live, from, to, step / 10);
        const ceiling = amplitudeCeiling(live.spikes);
        for (const v of live.amplitude) expect(v).toBeLessThanOrEqual(ceiling + 1e-9);
      }
    }
  });

  it('folds a walk back down when it drifts towards a denser body', () => {
    // Starts tall and round, which is legal, and walks wherever the roll takes
    // it. The amplitude has to come down as the spikes go up.
    let live = randomShape(() => 0.02);
    for (let i = 0; i < 120; i += 1) {
      live = driftShape(live);
      const ceiling = amplitudeCeiling(live.spikes);
      for (const v of live.amplitude) expect(v).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });
});

describe('driftShape', () => {
  it('keeps a walk inside the rounded-spike ranges', () => {
    let live = randomShape(() => 0.5);
    for (let i = 0; i < 40; i += 1) {
      live = driftShape(live);
      for (const v of live.spikes) {
        expect(v).toBeGreaterThanOrEqual(SPIKE_RANGE[0]);
        expect(v).toBeLessThanOrEqual(SPIKE_RANGE[1]);
      }
      for (const v of live.amplitude) {
        expect(v).toBeGreaterThanOrEqual(AMPLITUDE_RANGE[0]);
        expect(v).toBeLessThanOrEqual(AMPLITUDE_RANGE[1]);
      }
    }
  });
});

describe('remixShape', () => {
  it('re-rolls spikes anywhere in the band, not a nudge from where it was', () => {
    const from = randomShape(() => 0.5);
    const lows: number[] = [];
    const highs: number[] = [];
    for (let i = 0; i < 80; i += 1) {
      const next = remixShape(from);
      for (const v of next.spikes) {
        expect(v).toBeGreaterThanOrEqual(SPIKE_RANGE[0]);
        expect(v).toBeLessThanOrEqual(SPIKE_RANGE[1]);
        lows.push(v);
        highs.push(v);
      }
    }
    expect(Math.min(...lows)).toBeLessThan(1.6);
    expect(Math.max(...highs)).toBeGreaterThan(4.4);
  });

  it('refuses a destination that would leave the spikes looking unchanged', () => {
    const from = randomShape(() => 0.5);
    for (let i = 0; i < 20; i += 1) {
      const next = remixShape(from);
      const span = SPIKE_RANGE[1] - SPIKE_RANGE[0];
      const jump = Math.hypot(
        next.spikes[0]! - from.spikes[0]!,
        next.spikes[1]! - from.spikes[1]!,
        next.spikes[2]! - from.spikes[2]!,
      );
      expect(jump).toBeGreaterThan(span * 0.3);
    }
  });

  it('drifts time instead of re-rolling it, so the surface does not boil', () => {
    const from = randomShape(() => 0.5);
    const next = remixShape(from, () => 0.5);
    const span = TIME_RANGE[1] - TIME_RANGE[0];
    for (let i = 0; i < 3; i += 1) {
      expect(Math.abs(next.time[i]! - from.time[i]!)).toBeLessThan(span * 0.1);
    }
  });

  it('cannot walk time up to a boil, even after a minute of ticks', () => {
    let live = randomShape(() => 0.5);
    for (let i = 0; i < 60; i += 1) live = remixShape(live);
    for (const v of live.time) {
      expect(v).toBeGreaterThanOrEqual(TIME_RANGE[0]);
      expect(v).toBeLessThanOrEqual(TIME_RANGE[1]);
      expect(v).toBeLessThan(2);
    }
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
