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
 * (`WelcomeBlob.vue`). `tests/unit/welcomeBlobRandomize.test.ts` guards that
 * side going quiet — this file guards the opposite direction, the one that
 * stays green while agent voice degrades. The two are deliberately symmetric
 * and deliberately in separate files: neither owner has a test in the other's.
 *
 * Asserted against the source rather than a running analyser because the
 * failure is a line someone adds somewhere else entirely. A behavioural test
 * can only cover the paths it already knows about; this covers the whole app,
 * including files that do not exist yet.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file rather than `process.cwd()`, so the scan covers the
// real tree whatever directory the suite is invoked from.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/**
 * Files allowed to tune an analyser, each with the reason it is safe.
 *
 * The rule this encodes is **never retune an analyser you did not create** —
 * not "only this one file may touch the property". The first version of this
 * guard got that wrong and immediately went red on `utils/musicPulse.ts`,
 * which is safe: it calls `context.createAnalyser()` and tunes *that*, leaving
 * the analyser it was handed untouched. Safe by construction, whichever
 * analyser is passed in. An allowlist that had no way to express the
 * difference would have pushed someone to delete the guard.
 *
 * Literal paths on purpose: a rename fails here with a path mismatch rather
 * than quietly matching nothing. Noisy on a rename beats an allowlist that
 * silently stops guarding anything — it just means a rename needs a line here.
 */
const ALLOWED: Record<string, string> = {
  'components/auth/WelcomeBlob.vue':
    'Login screen only. Its own Kwami instance, driven by music, where ' +
    'smoothness is the point. Never the workspace analyser.',
  'utils/musicPulse.ts':
    'Creates its own tap via createAnalyser() and tunes that; the analyser ' +
    'it is handed is only read from.',
};

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
      'the workspace analyser carries agent voice and must keep the SDK default 0.35 — ' +
        'if a new file legitimately tunes its own node, add it to ALLOWED with the reason',
    ).toEqual(Object.keys(ALLOWED).sort());
  });

  it('only tunes a node it owns, wherever it does not own the Kwami', () => {
    // `WelcomeBlob` is exempt because it drives a separate Kwami instance.
    // Anything else on the list is claiming the safe-by-construction pattern,
    // so hold it to that: it has to build the node it retunes.
    const mustOwnItsNode = Object.keys(ALLOWED).filter(
      (path) => path !== 'components/auth/WelcomeBlob.vue',
    );

    for (const path of mustOwnItsNode) {
      const source = readFileSync(join(SRC, path), 'utf8');
      expect(source, `${path} retunes an analyser it did not create`).toContain(
        'createAnalyser()',
      );
    }
  });

  it('leaves the music player alone, which shares the workspace analyser', () => {
    // MusicPlayer routes through `kwami.avatar.getAudio()` — the same instance
    // the agent speaks through. Smoothing it for music would smooth speech.
    const source = readFileSync(join(SRC, 'components/controls/MusicPlayer.vue'), 'utf8');

    expect(source.split('\n').some((line) => ASSIGNMENT.test(line))).toBe(false);
  });
});
