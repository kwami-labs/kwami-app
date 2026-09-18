/**
 * Walking the login blob from one set of parameters to the next instead of
 * cutting to it.
 *
 * The welcome screen re-rolls its avatar on a timer the visitor sets, as fast
 * as once a second. Applied as a jump, that reads as jitter however well the
 * audio reactivity underneath behaves — the blob is not dancing, it is being
 * replaced. Everything here is the subset of blob parameters that is a number
 * on a continuum and can therefore be interpolated. Skin, wireframe and the
 * renderer itself cannot, and `WelcomeBlob` handles those as cuts on a slower
 * cadence.
 */

/** The ranges `BlobXyz` is happy across, matching the SDK's own randomizer. */
const SPIKE_RANGE = [0.2, 3.3] as const;
const AMPLITUDE_RANGE = [0.3, 1.5] as const;
const TIME_RANGE = [0.5, 8] as const;
const SHININESS_RANGE = [10, 180] as const;

export interface BlobShape {
  spikes: [number, number, number];
  amplitude: [number, number, number];
  time: [number, number, number];
  shininess: number;
  /**
   * Three colours as nine 0–255 channels.
   *
   * Flattened rather than kept as hex because `#ff0000` and `#00ff00` have no
   * midpoint as strings; the blob's setter wants hex back, so the conversion
   * happens at the edge in `channelsToHex`.
   */
  channels: number[];
}

function between(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

/**
 * A fresh destination.
 *
 * @param random - Injected so tests can pin the roll.
 */
export function randomShape(random: () => number = Math.random): BlobShape {
  const triple = (range: readonly [number, number]): [number, number, number] => [
    between(range[0], range[1], random),
    between(range[0], range[1], random),
    between(range[0], range[1], random),
  ];

  return {
    spikes: triple(SPIKE_RANGE),
    amplitude: triple(AMPLITUDE_RANGE),
    time: triple(TIME_RANGE),
    shininess: between(SHININESS_RANGE[0], SHININESS_RANGE[1], random),
    channels: Array.from({ length: 9 }, () => random() * 255),
  };
}

export function cloneShape(shape: BlobShape): BlobShape {
  return {
    spikes: [...shape.spikes],
    amplitude: [...shape.amplitude],
    time: [...shape.time],
    shininess: shape.shininess,
    channels: [...shape.channels],
  };
}

/**
 * Three channels starting at `offset`, as the `#rrggbb` the SDK's setter wants.
 *
 * Clamped and rounded rather than trusted: a tween's endpoints are in range but
 * nothing stops a caller interpolating past them.
 */
export function channelsToHex(channels: number[], offset: number): string {
  let hex = '#';
  for (let i = offset; i < offset + 3; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round(channels[i] ?? 0)));
    hex += value.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Ease in and out, so a tween neither starts nor stops with a visible kick.
 *
 * Clamped, because the caller's elapsed/duration can overshoot on a long frame.
 */
export function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Write the point `t` of the way from `from` to `to` into `live`, in place.
 *
 * In place because this runs once a frame: a fresh object sixty times a second,
 * each holding three arrays, is garbage the animation loop does not need.
 */
export function blendShape(live: BlobShape, from: BlobShape, to: BlobShape, t: number): void {
  for (let i = 0; i < 3; i += 1) {
    live.spikes[i] = lerp(from.spikes[i]!, to.spikes[i]!, t);
    live.amplitude[i] = lerp(from.amplitude[i]!, to.amplitude[i]!, t);
    live.time[i] = lerp(from.time[i]!, to.time[i]!, t);
  }
  live.shininess = lerp(from.shininess, to.shininess, t);
  for (let i = 0; i < 9; i += 1) {
    live.channels[i] = lerp(from.channels[i] ?? 0, to.channels[i] ?? 0, t);
  }
}
