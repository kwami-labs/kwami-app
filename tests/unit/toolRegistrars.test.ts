/**
 * Every client tool a composable defines has to actually be registered.
 *
 * `useWorkspaceAgentTools` is the single place where sub-composables are handed
 * the live `Kwami` instance. A composable that is written, translated, unit
 * tested and then never called from `registerTools()` is not a half-working
 * feature — it is an invisible one. Nothing throws, nothing warns, CI is green,
 * and the model is simply never told the tools exist.
 *
 * That is not hypothetical. `useRecallAgentTools` (8 tools),
 * `useKwamiAdminAgentTools` (6) and `useWorkspaceExtrasAgentTools` (5) shipped
 * across three feature commits in exactly that state: 19 tools with passing
 * suites of their own, strings in every locale, and no call site. The only
 * symptom was a companion that said it could not do things it had been built to
 * do — which reads to a user as the agent being broken, not as a missing line.
 *
 * So this walks the source rather than the runtime. A behavioural test would
 * need a real `Kwami`, and the failure being guarded against is precisely that
 * a registrar is *absent* from a call graph — there is no object to inspect for
 * something nobody wired up. Reading the file is the honest way to ask "is it
 * mentioned?", and it fails the moment someone adds `useFooAgentTools` without
 * the corresponding line.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `import.meta.url` is not a file: URL under the jsdom environment, so resolve
// from the cwd instead — vitest's `root` is the repo root (see vitest.config.ts).
const COMPOSABLES_DIR = resolve(process.cwd(), 'src/composables');
const HOST_FILE = resolve(COMPOSABLES_DIR, 'useWorkspaceAgentTools.ts');

/** The composable that does the registering is the host, not a participant. */
const HOST_BASENAME = 'useWorkspaceAgentTools.ts';

function agentToolFiles(): string[] {
  return readdirSync(COMPOSABLES_DIR)
    .filter((name) => /^use.*AgentTools\.ts$/.test(name) && name !== HOST_BASENAME)
    .sort();
}

/** `function registerFooTools(instance: Kwami)` -> `registerFooTools`. */
function registrarNames(source: string): string[] {
  return [...source.matchAll(/function (register[A-Za-z]*Tools)\s*\(/g)].map((m) => m[1]);
}

/**
 * Strip comments before looking for a call.
 *
 * Without this the whole file is theatre: a plain `source.includes(...)` also
 * matches `// recallTools.registerRecallTools(instance);`, so the single most
 * likely way this regresses — someone comments a line out to debug something
 * and never puts it back — sails straight through. Verified by commenting that
 * exact line out and watching all 8 assertions still pass.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/.*$/gm, (line) =>
    // Keep whatever precedes the `//` so real code sharing a line survives.
    line.slice(0, line.indexOf('//')),
  );
}

describe('agent tool registration', () => {
  const host = stripComments(readFileSync(HOST_FILE, 'utf8'));
  const files = agentToolFiles();

  it('finds the sibling agent-tool composables', () => {
    // A rename that breaks the glob would make every assertion below vacuous.
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it.each(agentToolFiles())('registers every tool set defined in %s', (file) => {
    const registrars = registrarNames(readFileSync(resolve(COMPOSABLES_DIR, file), 'utf8'));
    expect(registrars.length).toBeGreaterThan(0);

    const unregistered = registrars.filter((name) => !host.includes(`${name}(instance)`));
    expect(unregistered).toEqual([]);
  });

  it('instantiates every composable whose registrar it calls', () => {
    // Calling `fooTools.registerFooTools(instance)` without a matching
    // `const fooTools = useFooAgentTools()` is a compile error, so this only
    // guards the reverse: an import and instantiation left behind after the
    // register line was removed, which compiles fine and silently unregisters.
    for (const file of files) {
      const composable = file.replace(/\.ts$/, '');
      if (!host.includes(`${composable}()`)) continue;
      const registrars = registrarNames(readFileSync(resolve(COMPOSABLES_DIR, file), 'utf8'));
      expect(registrars.some((name) => host.includes(`${name}(instance)`))).toBe(true);
    }
  });
});
