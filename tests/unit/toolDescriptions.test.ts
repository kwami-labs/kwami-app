/**
 * Every tool description the model is given, across every locale bundle.
 *
 * `i18nMessageSyntax.test.ts` covers the throwing failure: a bare `{` raises
 * "Invalid token in placeholder", which is loud. This covers the quiet one.
 *
 * A bare `|` does NOT throw. vue-i18n reads it as a plural separator and
 * returns only the first branch, so a description written as
 *   "layout is docked | floating | fullscreen"
 * reaches the model as "layout is docked" -- silently, with every existing
 * test still green, and the model simply never learns two thirds of the
 * vocabulary. Verified against the installed vue-i18n 11.4.12.
 *
 * That check also has to be wider than one bundle's prefix: the sibling suite
 * filters on `workspaceAgentTools.toolDesc`, so the descriptions in
 * searchPanel, comms and appLocale were outside it.
 */
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { messages } from '@/i18n';

type Messages = Record<string, unknown>;

const bundles = messages as unknown as Record<string, Messages>;

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (Array.isArray(node)) return node.flatMap((item, i) => leafKeys(item, `${prefix}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node as Messages).flatMap(([key, value]) =>
      leafKeys(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function rawMessage(bundle: Messages, key: string): string {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node as Messages | undefined)?.[part],
    bundle,
  );
  return typeof value === 'string' ? value : '';
}

/** Any `toolDesc*` leaf, whichever top-level section it lives under. */
function toolDescriptionKeys(bundle: Messages): string[] {
  return leafKeys(bundle).filter((key) => key.split('.').some((p) => p.startsWith('toolDesc')));
}

describe.each(Object.keys(bundles))('%s tool descriptions', (locale) => {
  const bundle = bundles[locale]!;
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: locale,
    messages: bundles,
    missingWarn: false,
    fallbackWarn: false,
  });

  const keys = toolDescriptionKeys(bundle);

  it('finds descriptions in every section, not just one', () => {
    // The guard on the guard: if the filter ever stops matching, the
    // assertions below would pass over an empty list and prove nothing.
    expect(keys.length).toBeGreaterThan(30);
    const sections = new Set(keys.map((key) => key.split('.')[0]));
    expect([...sections].sort()).toEqual(
      ['appLocale', 'comms', 'searchPanel', 'workspaceAgentTools'].sort(),
    );
  });

  it('renders each one as prose rather than its own key path', () => {
    for (const key of keys) {
      const rendered = i18n.global.t(key);
      expect(rendered, key).toBeTruthy();
      expect(rendered, key).not.toBe(key);
    }
  });

  it('never silently drops half a description to a stray pipe', () => {
    const truncated: string[] = [];
    for (const key of keys) {
      const raw = rawMessage(bundle, key);
      const rendered = i18n.global.t(key);
      // Comparing rendered against raw is what catches this: the rendered
      // string is perfectly valid prose, just missing everything after the
      // first pipe, so nothing about it alone looks wrong.
      if (raw && rendered.length < raw.length) {
        truncated.push(`${key}: ${raw.length} chars became ${rendered.length}`);
      }
    }
    expect(truncated).toEqual([]);
  });

  it('gives the model enough to go on', () => {
    // A one-line description for a tool with a control vocabulary is how a
    // tool ends up registered, callable and never correctly used.
    const tooShort = keys.filter((key) => i18n.global.t(key).length < 40);
    expect(tooShort).toEqual([]);
  });
});
