/**
 * The workspace avatar must keep reacting on syllables.
 *
 * `KwamiAudio` builds its `AnalyserNode` with the SDK's
 * `smoothingTimeConstant = 0.35`, and the workspace kwami's analyser is the
 * one the agent's LiveKit voice runs through. Raising it smooths the envelope:
 * at 0.72 the avatar's mouth lags the speech by a couple of hundred
 * milliseconds, which reads as a broken avatar rather than a changed number.
 * Nothing throws, no test fails, and there is nothing in the output pointing
 * at the cause.
 *
 * The login screen deliberately *does* raise it, on its own separate instance,
 * because that one is driven by music where smoothness is the point
 * (`WelcomeBlob.vue`, kwami-app-6e). `tests/unit/welcomeBlobRandomize.test.ts`
 * guards that side going quiet — this file guards the opposite direction, the
 * one that stays green while agent voice degrades.
 *
 * Asserted against the source rather than a running analyser because the
 * failure is a line someone adds somewhere else entirely. A behavioural test
 * can only cover the paths it already knows about; this covers the whole app,
 * including files that do not exist yet.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../../src', import.meta.url).pathname;

/** The one file allowed to tune an analyser, and why, is documented above. */
const ALLOWED = ['components/auth/WelcomeBlob.vue'];

const SOURCE_EXTENSIONS = /\.(ts|vue|js)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return SOURCE_EXTENSIONS.test(entry) ? [full] : [];
  });
}

/** Assignments only — a mention in a comment is documentation, not a change. */
const ASSIGNMENT = /^\s*[^/*]*\.smoothingTimeConstant\s*=/;

describe('analyser smoothing', () => {
  const files = sourceFiles(SRC);

  it('has a source tree to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('is tuned in exactly one place, and it is the login screen', () => {
    const writers = files
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some((line) => ASSIGNMENT.test(line)),
      )
      .map((file) => relative(SRC, file).replace(/\\/g, '/'));

    expect(
      writers.sort(),
      'the workspace analyser carries agent voice and must keep the SDK default 0.35',
    ).toEqual(ALLOWED);
  });

  it('leaves the music player alone, which shares the workspace analyser', () => {
    // MusicPlayer routes through `kwami.avatar.getAudio()` — the same instance
    // the agent speaks through. Smoothing it for music would smooth speech.
    const source = readFileSync(join(SRC, 'components/controls/MusicPlayer.vue'), 'utf8');

    expect(source.split('\n').some((line) => ASSIGNMENT.test(line))).toBe(false);
  });
});
