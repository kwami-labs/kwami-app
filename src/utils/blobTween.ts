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

/**
 * Frequencies and amplitudes the login blob re-rolls across every tick.
 *
 * `spikes` are noise frequencies, not spike heights — higher means more
 * lobes on the body. The 1.8–5.5 band kept every roll in the same dense
 * husk, so only the colour appeared to change. The low end sits on the
 * earlier gelatine look (above the ~0.6 cone floor); the high end is the
 * spiky husk.
 *
 * Amplitude is a *ceiling* rather than a free range — see
 * `DENSE_AMPLITUDE_CEILING`. The two were rolled independently and the corner
 * where both came up high is the one that read as shredded rather than as a
 * blob.
 */
export const SPIKE_RANGE = [0.9, 5.5] as const;
export const AMPLITUDE_RANGE = [0.45, 1.0] as const;

/**
 * The tallest amplitude the densest roll is allowed.
 *
 * Spikes and amplitude are not independent, and rolling them as though they
 * were is what produced the rolls that looked shredded. `animateBlobXyz` adds
 * an idle term and an audio term that are both multiplied by the same
 * amplitude, then clamps the result at 1.45 radii — so amplitude buys spike
 * height only until the clamp, and past it the tips flatten off against a
 * ceiling and the surface stops answering the music at all.
 *
 * Where that ceiling bites depends on how many lobes there are, because more
 * lobes means more of the surface near a peak. Driven over the SDK's own
 * displacement maths against a 120bpm track, with the reactivity `WelcomeBlob`
 * now pairs it with, a roll at 5.5 spikes and the old ceiling of 1.6 pins 11%
 * of its vertices against the clamp on the loudest frames; the same roll at the
 * 0.68 this allows pins 0.1%. The band is therefore a budget rather than a
 * range: the more lobes a roll asks for, the shorter they are allowed to be,
 * and every roll costs about the same displacement.
 *
 * The low end of the spike band keeps the full ceiling. A couple of big slow
 * swells at 1.0 is the gelatine drop, and it is the one shape where reaching
 * the clamp reads as a body rather than as clipping.
 */
const DENSE_AMPLITUDE_CEILING = 0.68;

/**
 * Scroll speed of the surface noise. The old 0.5–8 band is a sixteen-fold
 * swing: a minute of 1s ticks random-walks `time` to the ceiling, and the
 * blob reads as vibrating or spinning even in silence. This band stays
 * alive without ever boiling.
 */
export const TIME_RANGE = [0.85, 1.85] as const;
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
 * How husk-like a body is, 0 at the gelatine end of `SPIKE_RANGE` and 1 at the
 * dense end.
 *
 * Averaged across the three axes: a body is as dense as it is on the whole,
 * and one round axis does not earn the other two any more height — or, below,
 * any more of the audio spike field.
 */
export function shapeDensity(spikes: readonly [number, number, number]): number {
  const mean = (spikes[0] + spikes[1] + spikes[2]) / 3;
  const span = SPIKE_RANGE[1] - SPIKE_RANGE[0];
  return Math.max(0, Math.min(1, (mean - SPIKE_RANGE[0]) / span));
}

/**
 * The most amplitude a body with these spike frequencies may have.
 *
 * Exported for the tests, and because it is the rule the two shape generators
 * share: `randomShape` rolls under it and `driftShape` walks under it, so a
 * shape can no more drift into the shredded corner than it can be rolled there.
 */
export function amplitudeCeiling(spikes: readonly [number, number, number]): number {
  return AMPLITUDE_RANGE[1] + (DENSE_AMPLITUDE_CEILING - AMPLITUDE_RANGE[1]) * shapeDensity(spikes);
}

/**
 * How much of the audio spike field a body is allowed, given the spikes it
 * already has.
 *
 * `animateBlobXyz` samples a finer noise once sound is in, and a second
 * octave of it once `audioPush` clears 0.2. On a husk that is the spikes it
 * already has growing. On a drop it is a coat of lobes the rest pose never
 * had, which is why every roll looked spiky the moment the music started —
 * the field did not know the difference.
 *
 * `spikeDensity` and `highSpike` follow density with no floor: they are the
 * frequency scramble, and a rounded body should not get any of it. Bass and
 * mid keep `AUDIO_SPIKE_WEIGHT_FLOOR` so a drop still swells on the beat
 * instead of going still. The husk end is 1, so a dense roll keeps the
 * values `WelcomeBlob` already tuned.
 */
export const AUDIO_SPIKE_WEIGHT_FLOOR = 0.4;

export interface AudioSpikeEffects {
  bassSpike: number;
  midSpike: number;
  highSpike: number;
  spikeDensity: number;
}

export function scaleAudioSpikeEffects(
  spikes: readonly [number, number, number],
  base: AudioSpikeEffects,
): AudioSpikeEffects {
  const density = shapeDensity(spikes);
  const weights = AUDIO_SPIKE_WEIGHT_FLOOR + (1 - AUDIO_SPIKE_WEIGHT_FLOOR) * density;
  return {
    bassSpike: base.bassSpike * weights,
    midSpike: base.midSpike * weights,
    highSpike: base.highSpike * density,
    spikeDensity: base.spikeDensity * density,
  };
}

const SPIKE_SPAN = SPIKE_RANGE[1] - SPIKE_RANGE[0];

/**
 * How far one axis may wander from the body's spike count.
 *
 * A tenth of the band is enough that the three axes are not a sphere of
 * identical lobes, and small enough that a drop cannot grow a husk on one
 * side. The count itself is chosen first; this is only the trim.
 */
const SPIKE_AXIS_SPREAD = SPIKE_SPAN * 0.1;

/**
 * How far a remix has to move the spike count before the tick reads as a
 * new body.
 *
 * About a third of the band. Closer than that is the same number of lobes
 * on different axes — which is what "always the same spikes" looked like
 * when the three frequencies were rolled independently and their mean sat
 * in the middle every time.
 */
const SPIKE_MIN_DENSITY_JUMP = 0.32;

function spikeCenter(density: number): number {
  return SPIKE_RANGE[0] + density * SPIKE_SPAN;
}

function rollSpikesAround(center: number, random: () => number): [number, number, number] {
  // Clamped, not reflected: reflecting a drop's trim off the floor would
  // push it back toward the husk, and the ends of the band would never
  // actually land on a drop or a husk.
  const axis = (): number =>
    Math.max(
      SPIKE_RANGE[0],
      Math.min(SPIKE_RANGE[1], center + (random() * 2 - 1) * SPIKE_AXIS_SPREAD),
    );
  return [axis(), axis(), axis()];
}

/**
 * A density at least `SPIKE_MIN_DENSITY_JUMP` away from `from`.
 *
 * Constructed rather than rejected: retrying a uniform draw leaves a few
 * percent of ticks on the same spike count, which is the look this is
 * undoing. The valid set is the two ends of `[0, 1]` that sit far enough
 * away; we pick uniformly among them so a body at 0.05 always becomes a
 * husk and one at 0.9 always becomes a drop, instead of stalling.
 */
function pickDensityAwayFrom(from: number, random: () => number): number {
  const lowSpan = Math.max(0, from - SPIKE_MIN_DENSITY_JUMP);
  const highStart = Math.min(1, from + SPIKE_MIN_DENSITY_JUMP);
  const highSpan = Math.max(0, 1 - highStart);
  const total = lowSpan + highSpan;
  if (!(total > 0)) return from < 0.5 ? 1 : 0;
  const pick = random() * total;
  if (pick < lowSpan) return pick;
  return highStart + (pick - lowSpan);
}

/**
 * A fresh destination.
 *
 * The spike *count* is one roll. Three independent frequencies in the same
 * band average into the same mid-range husk almost every tick — Irwin-Hall
 * on three samples, peaked at 3.2 — which is why the login blob looked
 * like it was only changing colour. One density, then a little per-axis
 * trim, is a drop or a husk or something in between, on purpose.
 *
 * @param random - Injected so tests can pin the roll.
 */
export function randomShape(random: () => number = Math.random): BlobShape {
  const triple = (range: readonly [number, number]): [number, number, number] => [
    between(range[0], range[1], random),
    between(range[0], range[1], random),
    between(range[0], range[1], random),
  ];

  const spikes = rollSpikesAround(spikeCenter(random()), random);
  const ceiling = amplitudeCeiling(spikes);

  return {
    spikes,
    amplitude: triple([AMPLITUDE_RANGE[0], ceiling] as const),
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
  spikes: 0.14,
  amplitude: 0.14,
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

  const spikes = triple(from.spikes, SPIKE_RANGE, DRIFT_FRACTIONS.spikes);

  return {
    spikes,
    // Against the ceiling the *new* spikes earn, so a walk towards a denser
    // body folds its amplitude back down on the way rather than arriving
    // somewhere the budget would never have rolled.
    amplitude: triple(
      from.amplitude,
      [AMPLITUDE_RANGE[0], amplitudeCeiling(spikes)] as const,
      DRIFT_FRACTIONS.amplitude,
    ),
    time: triple(from.time, TIME_RANGE, DRIFT_FRACTIONS.time),
    shininess: drift(from.shininess, SHININESS_RANGE, DRIFT_FRACTIONS.shininess, random),
    channels: from.channels.map((channel) =>
      reflect(channel + (random() * 2 - 1) * CHANNEL_DRIFT, 0, 255),
    ),
  };
}

/**
 * The next destination: a new body, with a different number of lobes.
 *
 * Spikes and amplitude re-roll every tick — that is the difference between
 * a blob that is sometimes a drop and sometimes a husk, and one that sits
 * on the same spike setting. The count is chosen *away* from the one the
 * body already has, so a tick cannot land on "the same spikes, shuffled
 * across the axes". Time, shininess and colour still drift: a sixteen-fold
 * jump in scroll speed reads as boiling, and a full palette cut every
 * second is a strobe, not a new shape.
 *
 * @param from - Where the blob is now. Not mutated.
 * @param random - Injected so tests can pin the roll.
 */
export function remixShape(from: BlobShape, random: () => number = Math.random): BlobShape {
  const spikes = rollSpikesAround(
    spikeCenter(pickDensityAwayFrom(shapeDensity(from.spikes), random)),
    random,
  );
  const ceiling = amplitudeCeiling(spikes);

  return {
    spikes,
    amplitude: [
      between(AMPLITUDE_RANGE[0], ceiling, random),
      between(AMPLITUDE_RANGE[0], ceiling, random),
      between(AMPLITUDE_RANGE[0], ceiling, random),
    ],
    time: [
      drift(from.time[0]!, TIME_RANGE, DRIFT_FRACTIONS.time, random),
      drift(from.time[1]!, TIME_RANGE, DRIFT_FRACTIONS.time, random),
      drift(from.time[2]!, TIME_RANGE, DRIFT_FRACTIONS.time, random),
    ],
    shininess: drift(from.shininess, SHININESS_RANGE, DRIFT_FRACTIONS.shininess, random),
    channels: from.channels.map((channel) =>
      reflect(channel + (random() * 2 - 1) * CHANNEL_DRIFT, 0, 255),
    ),
  };
}
