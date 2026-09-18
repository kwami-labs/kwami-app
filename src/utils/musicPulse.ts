/**
 * Pulling the beat out of a track, rather than its loudness.
 *
 * `getBandLevels` answers "how much energy is in the low tenth of the
 * spectrum", which is what a renderer wants pushed at it once a frame. That
 * number is nearly a constant across a song: at a 2048-point FFT the "low
 * tenth" is everything under ~2.2 kHz, so a kick drum is averaged in with the
 * whole harmonic body of the mix and barely moves the figure. Driving an
 * avatar from it produces something that swells when the track gets louder and
 * otherwise sits there — which is exactly the complaint that the spikes do not
 * move with the rhythm.
 *
 * What a beat actually is, in a spectrum, is a *rise above where that band has
 * been sitting*. So this splits the spectrum by frequency rather than by
 * fraction-of-buffer, runs a fast and a slow envelope over each band, and
 * reports the rectified gap between them. Steady passages read near zero
 * however loud they are; a kick, a snare or a hat lands as a spike. It is also
 * self-levelling: quiet tracks pulse as hard as loud ones, because only the
 * gap counts.
 *
 * Deliberately not folded into `getBandLevels`. That function is a contract
 * between two screens about how to feed `setAudioLevels`, and its split is
 * pinned by tests; this is a detector with different bands, different time
 * constants and a different output. Sharing a name would only make two
 * unrelated jobs look like one.
 */

import { envelopeCoefficient } from './audioBands';

export interface MusicPulseReading {
  /** 0–1 enveloped loudness over the musical range. Slow, for anything that should swell. */
  level: number;
  /**
   * 0–1 onset strength.
   *
   * Near zero through a held chord however loud, and up near 1 on a hit. This
   * is the one worth driving motion from.
   */
  pulse: number;
}

export interface MusicPulse {
  /**
   * Point the detector at the analyser the track is running through.
   *
   * Idempotent for an analyser it is already tapping, and re-asserting the tap
   * is the whole reason it is safe to call every frame — see the note on
   * `TAP_REFRESH_MS`.
   */
  attach(analyser: AnalyserNode | null): void;
  /**
   * Advance every envelope by `deltaMs` and report where they are.
   *
   * @param deltaMs - Since the last call.
   * @param active - False when nothing is playing. Silence is followed rather
   *   than skipped, or a pause would freeze the envelopes where they stood.
   */
  read(deltaMs: number, active?: boolean): MusicPulseReading;
  /** Drop everything to silence — a new track, or a renderer that just appeared. */
  reset(): void;
  /** Release the tap. */
  dispose(): void;
}

/**
 * Where a beat lives.
 *
 * Narrow and musically spaced, which is the point: the kick band stops at
 * 160 Hz rather than 2.2 kHz, so a kick is most of what is in it instead of a
 * tenth of it. The gap between 1 kHz and 1.5 kHz is left out on purpose —
 * it carries vocals and lead lines, which sustain rather than hit, and
 * including them only raises the slow envelope the hits have to beat.
 *
 * Weights sum to 1, so a hit that lands in all three bands at once reads as a
 * full-scale pulse and nothing else can.
 */
const BANDS = [
  /** Kick and bass notes. The body of almost every beat. */
  { fromHz: 30, toHz: 160, weight: 0.5 },
  /** Snare and low percussion, plus the attack of a chord stab. */
  { fromHz: 160, toHz: 1_000, weight: 0.28 },
  /** Hats, rides, and the crack on top of a snare. */
  { fromHz: 1_500, toHz: 7_000, weight: 0.22 },
] as const;

/** Time constants for the envelope a hit has to outrun. */
const FAST_ATTACK_MS = 18;
const FAST_RELEASE_MS = 95;

/**
 * And for the one it is measured against.
 *
 * Long enough to span a couple of bars, so it reads as "where this band has
 * been sitting" rather than as the previous beat. Symmetric: this is a
 * baseline, and an asymmetric baseline would drift up under a dense passage
 * and swallow the hits.
 */
const SLOW_MS = 1_100;

/**
 * Turning the gap between the two envelopes into a 0–1 pulse.
 *
 * Byte frequency data is already logarithmic — the analyser maps its dB range
 * onto 0–255 — so the gap is a gap in dB and a plain multiplier is the right
 * way to scale it. The size of that multiplier was measured rather than
 * guessed: across two tracks from the login crate, a band's fast envelope runs
 * about 0.002 above its baseline at the median and 0.09–0.16 at the 99th
 * percentile. A kick is tens of thousandths, not tenths.
 *
 * The deadband is what buys the contrast. Gain alone scales the whole
 * distribution, so a figure large enough to make a beat land also lifts the
 * quiet between beats and the blob ends up permanently half-excited. Taking a
 * fixed slice off the bottom first puts the median at zero and leaves the
 * peaks to the gain: measured over those same tracks, this pair holds the
 * median pulse at 0.06–0.09 while the 99th percentile reaches 0.79–0.84.
 */
const LIFT_GAIN = 22;
const LIFT_DEADBAND = 0.015;

/** Below this a band is room tone or codec hiss, and its wobble is not a beat. */
const BAND_FLOOR = 0.045;

/** The pulse's own envelope: keep the hit, let it fall away over a musical length. */
const PULSE_ATTACK_MS = 26;
const PULSE_RELEASE_MS = 235;

/** The slow one, for anything that should swell with the track rather than snap. */
const LEVEL_ATTACK_MS = 70;
const LEVEL_RELEASE_MS = 380;

/** Matches `audioBands`: a tab that was backgrounded must not arrive with seconds of delta. */
const MAX_DELTA_MS = 250;

/**
 * How often the tap is re-asserted, in milliseconds.
 *
 * `KwamiAudio.rebuildAudioGraph()` calls `analyser.disconnect()` and rewires
 * from the source, which drops every outgoing edge including this one. It runs
 * whenever the highpass or lowpass filters are toggled, so a visitor changing a
 * sound setting would otherwise silently kill the pulse for the rest of the
 * session. `connect()` on a pair that is already connected is a documented
 * no-op, so re-asserting is free and self-healing; twice a second is often
 * enough that nobody sees the gap.
 */
const TAP_REFRESH_MS = 500;

/**
 * Smoothing on the detector's own analyser.
 *
 * Its own, not the one the SDK reads. The blob's path through `BlobXyz` wants a
 * heavily smoothed spectrum because it feeds the geometry directly and every
 * bin of FFT noise becomes a wobbling vertex; this one wants the opposite,
 * because a transient that the analyser has already averaged away cannot be
 * detected downstream at any gain. Two consumers, two requirements — so two
 * analysers, rather than one number that has to be wrong for somebody. The tap
 * costs one `AnalyserNode`, which does no work beyond the FFT it is asked for.
 */
const PULSE_ANALYSER_SMOOTHING = 0.2;

/** Enough resolution to put half a dozen bins under 160 Hz at 44.1 kHz. */
const PULSE_FFT_SIZE = 2048;

interface BandState {
  /** First bin of the band, inclusive. */
  from: number;
  /** Last bin, exclusive. */
  to: number;
  weight: number;
  fast: number;
  slow: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function createMusicPulse(): MusicPulse {
  /** The analyser handed in, kept only to notice when it is replaced. */
  let source: AnalyserNode | null = null;
  /** The one actually read. Null whenever the tap could not be built. */
  let tap: AnalyserNode | null = null;
  let spectrum: Uint8Array = new Uint8Array();
  let bands: BandState[] = [];
  let lastTapRefreshAt = Number.NEGATIVE_INFINITY;

  let pulse = 0;
  let level = 0;

  function releaseTap() {
    if (source && tap) {
      try {
        source.disconnect(tap);
      } catch {
        // Already torn down with the audio graph; nothing left to release.
      }
    }
    tap = null;
    bands = [];
    spectrum = new Uint8Array();
  }

  /**
   * Bin indices for every band, from the context's real sample rate.
   *
   * Recomputed with the tap rather than assumed, because a context that opened
   * at 48 kHz puts the 160 Hz split three bins further along than one at 44.1.
   */
  function planBands(analyser: AnalyserNode) {
    const sampleRate = analyser.context?.sampleRate ?? 44_100;
    const binCount = analyser.frequencyBinCount;
    const binHz = sampleRate / analyser.fftSize;

    bands = BANDS.map(({ fromHz, toHz, weight }) => {
      // Never bin 0: it holds DC and whatever offset the decoder left behind.
      const from = Math.min(binCount - 1, Math.max(1, Math.floor(fromHz / binHz)));
      const to = Math.min(binCount, Math.max(from + 1, Math.ceil(toHz / binHz)));
      return { from, to, weight, fast: 0, slow: 0 };
    });
  }

  function buildTap(analyser: AnalyserNode) {
    const context = analyser.context;
    if (!context || typeof analyser.connect !== 'function') return;

    const next = context.createAnalyser();
    next.fftSize = PULSE_FFT_SIZE;
    next.smoothingTimeConstant = PULSE_ANALYSER_SMOOTHING;
    // Matching `KwamiAudio`, so both analysers map the same dB range onto 0–255
    // and a level read here means what it means there.
    next.minDecibels = -90;
    next.maxDecibels = -10;
    analyser.connect(next);

    tap = next;
    spectrum = new Uint8Array(next.frequencyBinCount);
    planBands(next);
  }

  function step(value: number, target: number, ms: number, attackMs: number, releaseMs: number) {
    return value + (target - value) * envelopeCoefficient(ms, target > value ? attackMs : releaseMs);
  }

  return {
    attach(analyser) {
      if (analyser === source) {
        // Same analyser, but the graph underneath may have been rebuilt since.
        const now = performance.now();
        if (analyser && tap && now - lastTapRefreshAt >= TAP_REFRESH_MS) {
          lastTapRefreshAt = now;
          try {
            analyser.connect(tap);
          } catch {
            // The context is gone; the next `attach` with a live one rebuilds.
          }
        }
        return;
      }

      releaseTap();
      source = analyser;
      lastTapRefreshAt = performance.now();
      if (!analyser) return;

      try {
        buildTap(analyser);
      } catch {
        // No Web Audio here — a test environment, or a context that has closed.
        // `read` then reports silence rather than throwing once a frame.
        tap = null;
      }
    },

    read(deltaMs, active = true) {
      const ms = Math.min(MAX_DELTA_MS, Math.max(0, deltaMs));

      let target = 0;
      let loudness = 0;

      if (active && tap && bands.length) {
        tap.getByteFrequencyData(spectrum as Uint8Array<ArrayBuffer>);

        let weighted = 0;
        for (const band of bands) {
          let sum = 0;
          for (let i = band.from; i < band.to; i += 1) sum += spectrum[i] ?? 0;
          const raw = sum / (band.to - band.from) / 255;

          band.fast = step(band.fast, raw, ms, FAST_ATTACK_MS, FAST_RELEASE_MS);
          band.slow = step(band.slow, raw, ms, SLOW_MS, SLOW_MS);

          // The gap, rectified. A band that is falling back towards its
          // baseline contributes nothing, which is what keeps a sustained note
          // from reading as a continuous beat.
          const lift =
            raw >= BAND_FLOOR
              ? clamp01((band.fast - band.slow - LIFT_DEADBAND) * LIFT_GAIN)
              : 0;
          weighted += lift * band.weight;
          loudness += raw * band.weight;
        }
        target = clamp01(weighted);
      } else if (!active) {
        // Let the baselines fall too, or the first beat after a pause would be
        // measured against a baseline the silence never lowered.
        for (const band of bands) {
          band.fast = step(band.fast, 0, ms, FAST_ATTACK_MS, FAST_RELEASE_MS);
          band.slow = step(band.slow, 0, ms, SLOW_MS, SLOW_MS);
        }
      }

      if (ms > 0) {
        pulse = step(pulse, target, ms, PULSE_ATTACK_MS, PULSE_RELEASE_MS);
        level = step(level, loudness, ms, LEVEL_ATTACK_MS, LEVEL_RELEASE_MS);
      }

      return { pulse, level };
    },

    reset() {
      pulse = 0;
      level = 0;
      for (const band of bands) {
        band.fast = 0;
        band.slow = 0;
      }
    },

    dispose() {
      releaseTap();
      source = null;
      pulse = 0;
      level = 0;
    },
  };
}
