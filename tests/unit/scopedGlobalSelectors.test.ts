import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileStyle } from '@vue/compiler-sfc';

/**
 * `:global(body.x) .child` in a scoped style does not mean "a .child under body.x".
 * Vue compiles it to bare `body.x` and drops `.child`, so the declarations land on
 * <body>. MusicPlayer's `:global(body.compact-mode) .slider-block { padding: 10px }`
 * did exactly that: every phone (always in compact mode) got 10px of padding round
 * the whole app once the Audio panel had loaded, pushing the call button off-screen.
 *
 * Write the ancestor plainly instead (`body.compact-mode .child`): scoping only
 * marks the last compound, so that compiles to `body.compact-mode .child[data-v-…]`.
 */

const SRC = join(__dirname, '../../src');

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return vueFiles(path);
    return name.endsWith('.vue') ? [path] : [];
  });
}

/** Contents of every `<style ... scoped ...>` block. */
function scopedStyles(source: string): string[] {
  const blocks: string[] = [];
  const re = /<style\b([^>]*)>([\s\S]*?)<\/style>/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (/\bscoped\b/.test(m[1] ?? '')) blocks.push(m[2] ?? '');
  }
  return blocks;
}

describe('scoped styles', () => {
  it('compile `:global(...) .child` to bare `:global(...)` — the trap this guards', () => {
    const { code } = compileStyle({
      source: ':global(body.compact-mode) .child { padding: 10px; }',
      id: 'data-v-test',
      scoped: true,
      filename: 'Probe.vue',
    });
    expect(code.replace(/\s+/g, ' ').trim()).toBe('body.compact-mode { padding: 10px; }');
  });

  it('never follow :global(...) with a descendant selector', () => {
    const offenders: string[] = [];
    for (const file of vueFiles(SRC)) {
      for (const css of scopedStyles(readFileSync(file, 'utf8'))) {
        for (const line of css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
          if (/:global\([^)]*\)\s+[^\s{,]/.test(line)) {
            offenders.push(`${relative(SRC, file)}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
