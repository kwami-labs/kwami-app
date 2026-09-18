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

/**
 * How far one tick is allowed to move each parameter, as a fraction of its
 * range.
 *
 * `randomShape` picks uniformly across the whole range, which is right for the
 * first shape and wrong for every one after it: at the 1s default the blob was
 * being handed a destination with no relationship to where it was, so the
 * fastest thing on screen was the randomiser rather than the music. `time`
 * was the worst of them — a re-roll could change how fast the surface noise
 * scrolls by sixteen times, which reads as the blob boiling.
 *
 * Small enough that a tick is a drift rather than a replacement, large enough
 * that a minute of watching does not land where it started.
 */
const DRIFT_FRACTIONS = {
  spikes: 0.1,
  amplitude: 0.12,
  /** Tightest of the four: this one sets the speed of everything else. */
  time: 0.06,
  shininess: 0.16,
} as const;

/** And for colour, in 0–255 channels rather than a fraction of anything. */
const CHANNEL_DRIFT = 26;

/**
 * Fold a value back inside `[min, max]` instead of clamping it there.
 *
 * Clamping makes a random walk stick to the ends: once a parameter reaches the
 * top of its range, half of every subsequent roll is discarded and it sits
 * there. Reflecting turns the same roll around, so the walk stays live.
 */
function reflect(value: number, min: number, max: number): number {
  if (!(max > min)) return min;

  let folded = value;
  // A drift step is a fraction of the span, so one fold is always enough — the
  // loop is a guard against a caller that passed something wilder, not a
  // general-purpose reducer.
  for (let guard = 0; guard < 4 && (folded < min || folded > max); guard += 1) {
    if (folded < min) folded = min + (min - folded);
    else folded = max - (folded - max);
  }
  return Math.max(min, Math.min(max, folded));
}

function drift(
  value: number,
  range: readonly [number, number],
  fraction: number,
  random: () => number,
): number {
  const span = (range[1] - range[0]) * fraction;
  return reflect(value + (random() * 2 - 1) * span, range[0], range[1]);
}

/**
 * The next destination, a bounded step from the shape the blob is already on.
 *
 * Every parameter stays inside the same range `randomShape` draws from, so the
 * two are interchangeable as tween endpoints — this one just refuses to cross
 * the range in a single tick.
 *
 * @param from - Where the blob is now. Not mutated.
 * @param random - Injected so tests can pin the roll.
 */
export function driftShape(from: BlobShape, random: () => number = Math.random): BlobShape {
  const triple = (
    values: readonly [number, number, number],
    range: readonly [number, number],
    fraction: number,
  ): [number, number, number] => [
    drift(values[0], range, fraction, random),
    drift(values[1], range, fraction, random),
    drift(values[2], range, fraction, random),
  ];

  return {
    spikes: triple(from.spikes, SPIKE_RANGE, DRIFT_FRACTIONS.spikes),
    amplitude: triple(from.amplitude, AMPLITUDE_RANGE, DRIFT_FRACTIONS.amplitude),
    time: triple(from.time, TIME_RANGE, DRIFT_FRACTIONS.time),
    shininess: drift(from.shininess, SHININESS_RANGE, DRIFT_FRACTIONS.shininess, random),
    channels: from.channels.map((channel) =>
      reflect(channel + (random() * 2 - 1) * CHANNEL_DRIFT, 0, 255),
    ),
  };
}
