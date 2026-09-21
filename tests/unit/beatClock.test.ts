/**
 * The login avatar has to keep time, not only flinch.
 *
 * What the clock owes its caller is a phase that is continuous and honest: it
 * advances by real time, it lands on the beat, and it carries the tempo through
 * a gap in the percussion instead of stopping. The failures worth pinning are
 * the ones a tracker written straight to the onsets falls into — double-timing
 * itself on a hi-hat pattern, and never recovering from a wrong lock.
 */
import { describe, expect, it } from 'vitest';
import { createBeatClock, type BeatClockReading } from '../../src/utils/beatClock';

const FRAME_MS = 1000 / 60;

/**
 * The pulse `musicPulse` would report around a hit.
 *
 * Attack and release matched to that detector's own envelope, so the clock is
 * fed the shape it actually sees rather than an impulse it never would.
 */
function pulseAt(sinceHitMs: number): number {
  if (sinceHitMs < 0) return 0;
  const attack = 1 - Math.exp(-sinceHitMs / 14);
  const release = Math.exp(-sinceHitMs / 235);
  return 0.9 * attack * release;
}

/**
 * Run the clock over a track whose hits land at `hitTimes`.
 *
 * @returns One reading per frame, with the time it was taken at.
 */
function play(
  clock: ReturnType<typeof createBeatClock>,
  hitTimes: number[],
  durationMs: number,
  startMs = 0,
): { ms: number; reading: BeatClockReading }[] {
  const out: { ms: number; reading: BeatClockReading }[] = [];
  for (let ms = startMs; ms < startMs + durationMs; ms += FRAME_MS) {
    let pulse = 0;
    for (const hit of hitTimes) {
      if (hit <= ms) pulse = Math.max(pulse, pulseAt(ms - hit));
    }
    out.push({ ms, reading: clock.advance(FRAME_MS, pulse) });
  }
  return out;
}

/** Every multiple of `periodMs` inside `durationMs`. */
function beatsAt(periodMs: number, durationMs: number, offsetMs = 0): number[] {
  const hits: number[] = [];
  for (let ms = offsetMs; ms < durationMs; ms += periodMs) hits.push(ms);
  return hits;
}

/** How far a phase is from the nearest beat boundary, as a fraction of a beat. */
function distanceToBeat(phase: number): number {
  return Math.min(phase, 1 - phase);
}

function wrap01(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

describe('createBeatClock', () => {
  it('locks onto the tempo of a plain four-on-the-floor', () => {
    const clock = createBeatClock();
    const frames = play(clock, beatsAt(500, 12_000), 12_000);
    const settled = frames[frames.length - 1]!.reading;

    expect(settled.periodMs).toBeGreaterThan(470);
    expect(settled.periodMs).toBeLessThan(530);
    expect(settled.confidence).toBeGreaterThan(0.5);
  });

  it('lands its phase on the beat rather than somewhere in it', () => {
    const clock = createBeatClock();
    const hits = beatsAt(500, 12_000);
    const frames = play(clock, hits, 12_000);

    // Only the back half: the first bars are the clock converging, which is
    // the behaviour the gain is chosen for rather than a failure.
    const late = frames.filter((f) => f.ms > 6_000);

    // Read at the frame nearest each hit, then walked back to the hit itself.
    // Sampling on a 60Hz grid is worth a thirtieth of a beat on its own, and
    // that is the test's own error rather than the clock's.
    const errors = late
      .map((f) => {
        const hit = hits.find((h) => Math.abs(f.ms - h) < FRAME_MS / 2);
        if (hit === undefined) return null;
        const period = f.reading.periodMs;
        return distanceToBeat(wrap01(f.reading.phase - (f.ms - hit) / period));
      })
      .filter((e): e is number => e !== null);

    expect(errors.length).toBeGreaterThan(8);
    // Within a twentieth of a beat — 25ms at 120bpm, under two frames.
    expect(Math.max(...errors)).toBeLessThan(0.05);
  });

  it('never steps its phase once it is running, however far off a hit lands', () => {
    const clock = createBeatClock();
    // A track that keeps nudging the clock: every other beat is pushed 40ms
    // late, so there is a correction owed on almost every hit rather than a
    // settled lock that never has to move.
    const hits = beatsAt(500, 14_000).map((hit, i) => hit + (i % 2 === 0 ? 40 : 0));
    // Past the first hit, which starts the clock rather than correcting it:
    // there is nothing for the phase to be continuous *with* before then, and
    // nothing on screen either, since a caller fades in on confidence.
    const frames = play(clock, hits, 14_000).filter((f) => f.ms > 1_000);

    let widest = 0;
    let narrowest = Infinity;
    for (let i = 1; i < frames.length; i += 1) {
      // Signed and wrapped: the phase rolls over once a bar, and a rollover is
      // not a step.
      const raw = frames[i]!.reading.barPhase - frames[i - 1]!.reading.barPhase;
      const step = raw > 0.5 ? raw - 1 : raw < -0.5 ? raw + 1 : raw;
      widest = Math.max(widest, step);
      narrowest = Math.min(narrowest, step);
    }

    // Free-running, a frame is worth 1/60s over two beats. A correction may
    // make a frame run fast or slow, but never more than half as fast again and
    // never backwards — the caller draws a sinusoid of this, and anything
    // sharper is a visible jump in the lean.
    const freeRun = FRAME_MS / (2 * 500);
    expect(widest).toBeLessThan(freeRun * 1.5);
    expect(narrowest).toBeGreaterThan(0);
  });

  it('is not double-timed by hats on the eighths', () => {
    const clock = createBeatClock();
    // Kick on the beat, hat between every pair: twice as many onsets as beats.
    const frames = play(clock, beatsAt(250, 12_000), 12_000);
    const settled = frames[frames.length - 1]!.reading;

    // The tempo is still 120bpm. A tracker that took every gap for a beat
    // would be sitting at 250 and swaying at double speed.
    expect(settled.periodMs).toBeGreaterThan(450);
    expect(settled.periodMs).toBeLessThan(550);
  });

  it('keeps time through a bar with nothing in it', () => {
    const clock = createBeatClock();
    play(clock, beatsAt(500, 8_000), 8_000);
    const before = clock.advance(0, 0);

    // Two seconds of held chord: no onsets at all.
    const through = play(clock, [], 2_000, 8_000);
    const after = through[through.length - 1]!.reading;

    // The phase kept running at the tempo it had, so the body carries the
    // groove rather than stalling and restarting on the next kick.
    const expected = (before.barPhase + 2_000 / (before.periodMs * 2)) % 1;
    expect(Math.abs(after.barPhase - expected)).toBeLessThan(0.02);
    expect(after.periodMs).toBeCloseTo(before.periodMs, 5);
  });

  it('lets confidence fall away when the music stops, so the body can settle', () => {
    const clock = createBeatClock();
    play(clock, beatsAt(500, 8_000), 8_000);

    const silence = play(clock, [], 6_000, 8_000);
    const settled = silence[silence.length - 1]!.reading;

    // The login screen fades its lean with this, and the screen it fades to is
    // the idle one — so what matters is that six seconds of nothing leaves a
    // tenth of the groove rather than half of it.
    expect(settled.confidence).toBeLessThan(0.1);
    expect(silence[60]!.reading.confidence).toBeGreaterThan(settled.confidence);
  });

  it('re-locks when the track changes tempo under it', () => {
    const clock = createBeatClock();
    play(clock, beatsAt(500, 8_000), 8_000);

    // 80bpm, which is not a subdivision of 120 — every interval disagrees.
    const frames = play(clock, beatsAt(750, 20_000, 8_000), 12_000, 8_000);
    const settled = frames[frames.length - 1]!.reading;

    expect(settled.periodMs).toBeGreaterThan(700);
    expect(settled.periodMs).toBeLessThan(800);
    expect(settled.confidence).toBeGreaterThan(0.4);
  });

  it('advances on elapsed time rather than on frames', () => {
    const slow = createBeatClock();
    const fast = createBeatClock();

    // A second of clock, at 30Hz and at 120Hz. Nothing is playing, so both
    // free-run at the default tempo and must arrive at the same phase.
    for (let i = 0; i < 30; i += 1) slow.advance(1000 / 30, 0);
    for (let i = 0; i < 120; i += 1) fast.advance(1000 / 120, 0);

    expect(slow.advance(0, 0).barPhase).toBeCloseTo(fast.advance(0, 0).barPhase, 6);
  });

  it('shrugs off the seconds of delta a backgrounded tab comes back with', () => {
    const clock = createBeatClock();
    play(clock, beatsAt(500, 8_000), 8_000);
    const before = clock.advance(0, 0);

    const after = clock.advance(30_000, 0);

    // Clamped like every other envelope in the audio path, so the phase moves
    // by a quarter second rather than by a minute of unplayed music.
    expect(after.barPhase).toBeCloseTo((before.barPhase + 250 / (before.periodMs * 2)) % 1, 6);
  });

  it('forgets the tempo on reset, for a track that has nothing to do with the last', () => {
    const clock = createBeatClock();
    play(clock, beatsAt(750, 8_000), 8_000);
    clock.reset();

    const reading = clock.advance(0, 0);
    expect(reading.periodMs).toBe(500);
    expect(reading.confidence).toBe(0);
    expect(reading.barPhase).toBe(0);
  });
});
