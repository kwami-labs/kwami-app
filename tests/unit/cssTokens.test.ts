/**
 * Every CSS custom property read without a fallback has to be defined somewhere.
 *
 * `var(--text-tertiary)` with nothing declaring `--text-tertiary` is not an
 * error anywhere: the browser drops the declaration and the element inherits
 * whatever colour its parent had. Sixty-six captions meant to be muted rendered
 * at full strength that way, the Tools panel's "connected" badge and error box
 * had no colour, and the Memory panel's `rgba(var(--accent-primary-rgb), a)`
 * highlights painted nothing -- all green in CI, because nothing could fail.
 *
 * So this reads the source. A token counts as defined when a stylesheet
 * declares it (`--x: ...`), or when code sets it by name (`setProperty('--x')`,
 * a `:style="{ '--x': ... }"` binding). A read with a fallback,
 * `var(--x, something)`, is allowed to be undefined: it was written to be.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|vue|ts)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

function definedTokens(): Set<string> {
  const defined = new Set<string>();
  for (const { text } of files) {
    // Declarations in stylesheets and <style> blocks: `--name: value`.
    for (const m of text.matchAll(/(?<![\w-])--([\w-]+)\s*:/g)) defined.add(m[1]);
    // Set from code by name: setProperty('--name', ...) or { '--name': ... }.
    for (const m of text.matchAll(/['"`]--([\w-]+)['"`]/g)) defined.add(m[1]);
  }
  return defined;
}

function readsWithoutFallback(): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  for (const { path, text } of files) {
    for (const m of text.matchAll(/var\(\s*--([\w-]+)\s*\)/g)) {
      const where = reads.get(m[1]) ?? [];
      where.push(path.slice(SRC.length + 1).replace(/\\/g, '/'));
      reads.set(m[1], where);
    }
  }
  return reads;
}

describe('CSS tokens', () => {
  it('reads the source tree', () => {
    // A path change that empties the scan would make the assertion below vacuous.
    expect(files.length).toBeGreaterThan(100);
  });

  it('defines every token read without a fallback', () => {
    const defined = definedTokens();
    const undefinedReads = [...readsWithoutFallback()]
      .filter(([name]) => !defined.has(name))
      .map(([name, where]) => `--${name} (${[...new Set(where)].join(', ')})`)
      .sort();

    expect(undefinedReads).toEqual([]);
  });
});
