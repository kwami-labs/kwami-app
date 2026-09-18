/**
 * Every message must compile, and must survive rendering whole.
 *
 * vue-i18n does not treat a message as a plain string: `{name}` is an
 * interpolation placeholder and `|` separates plural forms. Both have a prose
 * spelling that is easy to reach for, and they fail in two different ways —
 * one loud, one silent. Measured against the installed vue-i18n 11.4.12:
 *
 *     "{'{'}x, y{'}'}"         -> "{x, y}"                    ok
 *     "\{x, y\}"               -> "{x, y}"                    ok
 *     "{x, y}"                 -> THROWS, invalid placeholder  LOUD
 *     "docked {'|'} floating"  -> "docked | floating"         ok
 *     "docked | floating | fullscreen"  -> "floating"         SILENT
 *
 * The silent one is the dangerous half and it is what the second test below
 * exists for. A bare pipe makes the message a plural, and rendering it without
 * a count resolves as n=1 — which is a *different branch* depending on how
 * many you wrote:
 *
 *     "one | two"                -> "one"     (index 0)
 *     "one | two | three"        -> "two"     (index 1)
 *     "one | two | three | four" -> "two"     (index 1)
 *
 * So there is no single fragment position to look for when diagnosing this:
 * two pipes leave you a middle fragment, one pipe leaves you a head fragment.
 * Nothing throws, nothing warns, and the string is simply shorter than it was
 * written.
 *
 * That matters more here than in most apps, because these strings are not only
 * UI labels: every `toolDesc*` is a tool description handed to the model. A
 * description silently cut to one word leaves the tool registered, described,
 * green in CI, and the model told a third of its vocabulary — which reads to
 * the user as the tool half-working for no reason.
 *
 * Compilation is lazy, so this walks every leaf and renders it.
 *
 * Credit to kwami-app-53, who found the silent case, proved it by shrinking a
 * real description from 329 characters to 8 with the whole suite still green,
 * and then measured the branch-index table above when two of us had each
 * over-generalised from a single probe.
 * Their `toolDescriptions.test.ts` catches truncation from any cause by
 * comparing rendered against raw length; this file catches the syntax itself,
 * across every message rather than only descriptions. Both are worth having.
 */
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { messages } from '@/i18n';

type Messages = Record<string, unknown>;

// The app's own assembled bundle, not a hand-rolled copy of it. A locale file
// added to src/i18n/index.ts and not here would otherwise ship unchecked —
// which is exactly how the theme-panel message below reached production.
const bundles: Record<string, Messages> = messages as unknown as Record<string, Messages>;

/** The message as it was written, before vue-i18n compiles anything away. */
function rawMessage(bundle: Messages, key: string): unknown {
  let node: unknown = bundle;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Messages)[part];
  }
  return node;
}

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => leafKeys(item, `${prefix}[${i}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node as Messages).flatMap(([key, value]) =>
      leafKeys(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe.each(Object.keys(bundles))('%s messages', (locale) => {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: locale,
    messages: bundles,
    // Missing-key and fallback noise would drown the failures we care about.
    missingWarn: false,
    fallbackWarn: false,
  });

  const keys = leafKeys(bundles[locale]);

  it('has messages to check', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it('compiles every message', () => {
    const failures: string[] = [];
    for (const key of keys) {
      try {
        i18n.global.t(key);
      } catch (error) {
        failures.push(`${key}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('renders every tool description the model is given', () => {
    // These reach the LLM verbatim. A description that renders as its own key
    // path tells the model nothing, and one that throws removes the tool.
    // Matched on the leaf name, not a section prefix: descriptions now live in
    // four bundles, and a filter naming one of them passes vacuously over the
    // rest the moment a fifth appears.
    const toolDescriptions = keys.filter((key) => /(^|\.)toolDesc[A-Z]/.test(key));

    // A bare count passes vacuously: workspaceAgentTools alone carries 37, so
    // the filter could silently stop matching the other three bundles and
    // still clear any threshold worth setting. Assert the sections instead --
    // `arrayContaining`, so a bundle disappearing fails while a new one is
    // picked up for free, which is the point of matching any `toolDesc*` leaf.
    const sections = [...new Set(toolDescriptions.map((key) => key.split('.')[0]))];
    expect(sections).toEqual(
      expect.arrayContaining(['appLocale', 'comms', 'searchPanel', 'workspaceAgentTools']),
    );
    expect(toolDescriptions.length).toBeGreaterThan(20);

    for (const key of toolDescriptions) {
      const rendered = i18n.global.t(key);
      expect(rendered, key).toBeTruthy();
      expect(rendered, key).not.toBe(key);
    }
  });

  /**
   * The silent half: a bare `|` is plural syntax, not punctuation.
   *
   * Checked against the raw source rather than the rendered output, because
   * rendering is where the evidence is destroyed — by the time `t()` has
   * returned one branch, the other two are simply gone.
   *
   * The rule needs no allowlist to maintain. Every intentional plural in this
   * codebase is a three-branch form carrying a count; prose that happens to
   * contain a pipe is neither. So: descriptions may never contain a bare pipe
   * at all, and anything else that does must look like the plural it claims to
   * be.
   */
  it('has no message where a prose pipe is silently eating branches', () => {
    const offenders: string[] = [];

    for (const key of keys) {
      const raw = rawMessage(bundles[locale], key);
      if (typeof raw !== 'string') continue;

      // `{'|'}` is the escaped literal and renders as a pipe; ignore it.
      const bare = raw.replace(/\{'\|'\}/g, '');
      if (!bare.includes('|')) continue;

      const isDescription = /(^|\.)toolDesc[A-Z]/.test(key);
      const branches = bare.split('|');
      const looksLikeAPlural = branches.length === 3 && /\{\s*n\s*\}/.test(bare);

      if (isDescription || !looksLikeAPlural) {
        offenders.push(
          `${key}: ${branches.length} branch(es), renders as "${i18n.global.t(key)}"`,
        );
      }
    }

    expect(
      offenders,
      "a bare | makes the message a plural; write {'|'} for a literal pipe",
    ).toEqual([]);
  });
});

describe('escaped literals', () => {
  /**
   * The theme panel's import box shows a JSON example as its placeholder. Under
   * vue-i18n 11 the only way to put a literal brace in a message is literal
   * interpolation -- the backslash escape is v12+ -- and getting it wrong is
   * invisible until the panel renders.
   */
  it.each(['en', 'es'])('renders the theme import example as JSON in %s', (locale) => {
    const i18n = createI18n({
      legacy: false,
      locale,
      fallbackLocale: locale,
      messages: bundles,
      missingWarn: false,
      fallbackWarn: false,
    });

    const rendered = i18n.global.t('theme.importJsonPlaceholder');

    expect(rendered).toBe('{"mode": "dark", ...}');
  });
});
