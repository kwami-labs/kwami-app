/**
 * Keeping time with a track, rather than only flinching at it.
 *
 * `musicPulse` answers "is a hit landing right now", which is the honest signal
 * and the wrong one to hang a body on by itself. A blob driven only by onsets
 * is still *reacting*: it moves when the drum moves and is inert in between, so
 * every gap in the percussion reads as the avatar losing interest. Dancing is
 * the opposite — the body carries the tempo through the gaps and the hits only
 * confirm it.
 *
 * So this is a phase-locked loop over the pulse. It keeps a period and a phase,
 * advances the phase by real elapsed time every frame, and uses onsets only to
 * correct both. Between onsets it free-runs, which is exactly the property that
 * makes a breakdown or a held chord look like the avatar waiting rather than
 * stalling. `confidence` says how much of the recent evidence agreed, so a
 * caller can fade the motion out over silence instead of leaving a body
 * swaying to a tempo nothing is playing any more.
 *
 * Deliberately small. It is not a beat tracker in the MIR sense — there is no
 * onset history, no autocorrelation over a window, no downbeat inference. It
 * has one job: turn an irregular stream of hits into a continuous phase that
 * does not jump, because a jump in phase is a jump on screen.
 */

import { envelopeCoefficient } from './audioBands';

export interface BeatClockReading {
  /** Where we are between one beat and the next, 0–1, advancing continuously. */
  phase: number;
  /**
   * The same clock over two beats.
   *
   * What a body lean actually spans: leaning left and back right across a
   * single beat is a twitch at any tempo worth dancing to, and over two it is
   * a sway. Kept here rather than derived by the caller so the doubling
   * survives a period change — deriving it from `phase` outside would restart
   * the long cycle every time the estimate moved.
   */
  barPhase: number;
  /** The current estimate of how long a beat is, in milliseconds. */
  periodMs: number;
  /**
   * 0–1, how much the recent onsets have agreed with that estimate.
   *
   * Rises as hits land where they were expected and decays on its own through
   * silence, so it doubles as "is there a groove to dance to at all".
   */
  confidence: number;
}

export interface BeatClock {
  /**
   * Advance by `deltaMs` and fold in whatever the detector is reporting.
   *
   * @param deltaMs - Since the last call. Real elapsed time, not a frame count:
   *   a clock that advanced per frame would run half speed on a 30 Hz display.
   * @param pulse - 0–1 onset strength, as `musicPulse` reports it.
   */
  advance(deltaMs: number, pulse: number): BeatClockReading;
  /** Forget the tempo — a new track, or a renderer that just appeared. */
  reset(): void;
}

/**
 * The tempo range the clock will lock inside, in milliseconds per beat.
 *
 * 60–200bpm. Outside it, an interval is taken as a subdivision or a bar rather
 * than a beat: nothing in the login crate is slower than 60bpm, and at 200bpm
 * the two-beat sway is already down to 600 ms.
 */
const MIN_PERIOD_MS = 300;
const MAX_PERIOD_MS = 1_000;

/** Where the clock sits before it has heard anything. 120bpm. */
const DEFAULT_PERIOD_MS = 500;

/**
 * How loud a pulse has to be to count as a hit, and how far it has to have
 * climbed since its last low point to count as a *new* one.
 *
 * The rise is doing the real work, and a plain threshold is what it replaces.
 * A threshold alone fails at both ends of the same track: a pulse rippling
 * across the line reports one kick three times, and a dense passage — hats on
 * every eighth over a busy loop — never falls back under it, so every hit
 * after the first is invisible and the clock free-runs through the one part of
 * the song with the most evidence in it. Measuring each peak against the
 * trough before it is indifferent to where the signal happens to be sitting.
 */
const ONSET_THRESHOLD = 0.34;
const ONSET_RISE = 0.14;

/**
 * And a floor on the gap between two onsets, in milliseconds.
 *
 * 200bpm sixteenths are 75 ms apart, so anything closer than this is one hit
 * being reported twice rather than two hits.
 */
const REFRACTORY_MS = 90;

/**
 * The relationships an interval is allowed to have with the current period.
 *
 * Music does not only hit on the beat. Hats land on eighths, a snare rushes,
 * a fill triples up — and an interval that is half the period is *evidence for
 * that period*, not evidence against it. Reading every gap as a beat is what
 * makes a naive tracker double-time itself into the ceiling on the first hi-hat
 * pattern it meets.
 */
const SUBDIVISIONS = [1, 0.5, 2, 0.25, 1 / 3, 0.75] as const;

/** How far off a subdivision can be and still count as that subdivision. */
const SUBDIVISION_TOLERANCE = 0.16;

/**
 * How much of the disagreement between the estimate and an interval is taken
 * in one step.
 *
 * Low, because the period is the one number a visitor would notice being wrong:
 * the sway is a sinusoid of it, so a period that chases every interval is a
 * sway that changes speed continuously. Beats arrive twice a second, so even at
 * this gain a genuine tempo is converged on inside a bar or two. An interval
 * that only matched a subdivision moves it less — it is the same information
 * divided by two or four, and so is its error.
 */
const PERIOD_GAIN = 0.16;
const SUBDIVISION_PERIOD_GAIN = 0.06;

/**
 * How much of a phase error is corrected on a hit.
 *
 * This is the knob that trades sync against smoothness, and it is why the
 * correction is a nudge rather than a reset. Snapping the phase to every onset
 * would be perfectly in time and would also stop the sway dead and restart it
 * mid-stroke, which is more visible than the error being corrected. Under a
 * third of the error per beat converges inside three beats and never moves the
 * body more than the eye reads as a drift.
 */
const PHASE_GAIN = 0.3;

/**
 * And over how long that correction is paid out, in milliseconds.
 *
 * Because a correction applied at the moment it is decided is a *step* in the
 * phase, and a caller reading a sinusoid of that phase turns the step into a
 * jump on screen — measured at a fifth of the lean's whole travel in a single
 * frame, on a kick that was only a few milliseconds off. So the clock owes the
 * correction rather than taking it: for the next few frames it runs slightly
 * fast or slightly slow, which is the same arrival with nothing to see. This
 * is the one thing that makes the phase continuous, which is the property
 * everything downstream is relying on.
 */
const PHASE_CORRECTION_MS = 220;

/**
 * How near a beat boundary an onset has to be for its phase to be believed.
 *
 * An onset halfway between two beats is an offbeat, and pulling the clock
 * towards it would be pulling it away from the beat. Quarter of a beat either
 * side: close enough that a human would hear it as on the beat, and the width
 * a drummer's push or drag lives in.
 *
 * Only once the clock has something to defend, though. A clock that is not yet
 * locked and happens to be running in antiphase would never see an onset inside
 * that window, so it would sit there for the whole track leaning on the
 * offbeat — technically at the right tempo and audibly wrong. Below
 * `RELOCK_CONFIDENCE` every onset is worth aligning to.
 */
const PHASE_WINDOW = 0.25;
const UNLOCKED_PHASE_WINDOW = 0.5;

/**
 * What agreement and disagreement do to `confidence`.
 *
 * Asymmetric on purpose: four or five hits that land where they were expected
 * should be enough to commit, while a single interval that does not fit is far
 * more likely to be a fill or a missed detection than a tempo change.
 */
const CONFIDENCE_RISE = 0.34;
const CONFIDENCE_FALL = 0.18;

/**
 * And what time does to it, as a time constant in milliseconds.
 *
 * This is the one that sets where a locked clock actually sits, because the
 * rise and the decay meet at a fixed point rather than at 1: hits arrive twice
 * a second at 120bpm and each is worth `CONFIDENCE_RISE` of the distance that
 * is left, so the pair settle around 0.75 on four-on-the-floor and around 0.69
 * at 80bpm, where the gaps are longer. A caller scaling motion by this should
 * read anything past ~0.55 as locked.
 *
 * Long enough, then, to carry the clock through a bar of held chord — and short
 * enough that a paused track has the body still inside a couple of seconds,
 * which is the other thing it is read for.
 */
const CONFIDENCE_TAU_MS = 2_800;

/**
 * Below this, the clock stops defending its estimate and adopts the next
 * plausible interval outright.
 *
 * Without it a clock that locked onto the wrong tempo would stay there: every
 * interval from the new track disagrees, and disagreement alone never moves the
 * period. This is the re-lock path, and it is why a track change does not need
 * `reset()` to be called for the clock to recover.
 */
const RELOCK_CONFIDENCE = 0.3;

/** Matches the rest of the audio path: a backgrounded tab must not arrive with seconds of delta. */
const MAX_DELTA_MS = 250;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Fractional part, for positive and negative inputs alike. */
function wrap01(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

export function createBeatClock(): BeatClock {
  let periodMs = DEFAULT_PERIOD_MS;
  /** Advances over two beats; `phase` is read off it, never the other way round. */
  let barPhase = 0;
  let confidence = 0;
  /** Phase still owed to a correction, paid out over the frames after it. */
  let pendingPhase = 0;
  /** The lowest the pulse has been since the last hit — what the next one is measured against. */
  let troughSinceOnset = 0;
  /** Milliseconds since the last accepted onset, rather than a wall clock. */
  let sinceOnsetMs = Number.POSITIVE_INFINITY;
  let heardAnOnset = false;

  /**
   * Fold an interval onto the period it is evidence for.
   *
   * @returns The implied period and how well it fits, or null if the interval
   *   is not a recognisable relation of the current estimate.
   */
  function interpret(intervalMs: number): { impliedMs: number; exact: boolean } | null {
    let best: { impliedMs: number; exact: boolean; error: number } | null = null;

    for (const multiple of SUBDIVISIONS) {
      const expected = periodMs * multiple;
      const error = Math.abs(intervalMs - expected) / expected;
      if (error > SUBDIVISION_TOLERANCE) continue;
      if (!best || error < best.error) {
        best = { impliedMs: intervalMs / multiple, exact: multiple === 1, error };
      }
    }

    return best ? { impliedMs: best.impliedMs, exact: best.exact } : null;
  }

  function onOnset(intervalMs: number) {
    const reading = interpret(intervalMs);

    if (reading) {
      confidence = clamp01(confidence + (1 - confidence) * CONFIDENCE_RISE);
      const gain = reading.exact ? PERIOD_GAIN : SUBDIVISION_PERIOD_GAIN;
      const target = Math.min(MAX_PERIOD_MS, Math.max(MIN_PERIOD_MS, reading.impliedMs));
      periodMs += (target - periodMs) * gain;
    } else {
      confidence = clamp01(confidence - confidence * CONFIDENCE_FALL);

      // Nothing about this interval fits what we believe, and we no longer
      // believe it much. Take the track's word for it. The phase is left to the
      // nudge below and to the onsets after it, rather than snapped to this
      // hit: a snap is the one thing the caller cannot smooth over.
      if (confidence < RELOCK_CONFIDENCE && intervalMs >= MIN_PERIOD_MS && intervalMs <= MAX_PERIOD_MS) {
        periodMs = intervalMs;
      }
    }

    // Pull the clock towards the hit, but only if the hit looks like a beat
    // rather than something between two of them.
    const phase = wrap01(barPhase * 2);
    const error = phase > 0.5 ? phase - 1 : phase;
    const window = confidence >= RELOCK_CONFIDENCE ? PHASE_WINDOW : UNLOCKED_PHASE_WINDOW;
    if (Math.abs(error) <= window) {
      // Halved because the error is in beats and the phase it is owed to spans
      // two of them.
      pendingPhase = Math.max(-0.5, Math.min(0.5, pendingPhase - (error * PHASE_GAIN) / 2));
    }
  }

  return {
    advance(deltaMs, pulse) {
      const ms = Math.min(MAX_DELTA_MS, Math.max(0, deltaMs));

      // Run the clock, plus whatever share of an owed correction this frame is
      // worth. Nothing here can move the phase further than a frame of music.
      const correction = pendingPhase * Math.min(1, ms / PHASE_CORRECTION_MS);
      pendingPhase -= correction;
      barPhase = wrap01(barPhase + ms / (periodMs * 2) + correction);
      sinceOnsetMs += ms;
      confidence *= 1 - envelopeCoefficient(ms, CONFIDENCE_TAU_MS);

      if (pulse < troughSinceOnset) troughSinceOnset = pulse;
      if (
        pulse >= ONSET_THRESHOLD &&
        pulse - troughSinceOnset >= ONSET_RISE &&
        sinceOnsetMs >= REFRACTORY_MS
      ) {
        // The first onset of a track carries no interval — there is nothing
        // before it to measure against — so it only starts the clock.
        if (heardAnOnset) onOnset(sinceOnsetMs);
        else barPhase = 0;
        heardAnOnset = true;
        sinceOnsetMs = 0;
        troughSinceOnset = pulse;
      }

      return { phase: wrap01(barPhase * 2), barPhase, periodMs, confidence };
    },

    reset() {
      periodMs = DEFAULT_PERIOD_MS;
      barPhase = 0;
      confidence = 0;
      pendingPhase = 0;
      troughSinceOnset = 0;
      sinceOnsetMs = Number.POSITIVE_INFINITY;
      heardAnOnset = false;
    },
  };
}
