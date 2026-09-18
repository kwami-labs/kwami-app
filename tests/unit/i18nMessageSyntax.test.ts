/**
 * Every message must actually compile.
 *
 * vue-i18n does not treat a message as a plain string: `{name}` is an
 * interpolation placeholder and `|` separates plural forms. Writing either as
 * prose — "position ({x, y})", "layout (docked | floating | fullscreen)" —
 * produces a message that throws `SyntaxError: Message compilation error` the
 * first time it is rendered, not when it is written.
 *
 * That is worse here than in most apps. These strings are not only UI labels:
 * `workspaceAgentTools.toolDesc*` are the tool descriptions handed to the
 * model, so a message that will not compile takes out a tool the agent
 * otherwise has, and does it at runtime in one locale at a time.
 *
 * Compilation is lazy, so this walks every leaf and renders it.
 */
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { messages } from '@/i18n';

type Messages = Record<string, unknown>;

// The app's own assembled bundle, not a hand-rolled copy of it. A locale file
// added to src/i18n/index.ts and not here would otherwise ship unchecked —
// which is exactly how the theme-panel message below reached production.
const bundles: Record<string, Messages> = messages as unknown as Record<string, Messages>;

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
    const toolDescriptions = keys.filter((key) =>
      key.startsWith('workspaceAgentTools.toolDesc'),
    );
    expect(toolDescriptions.length).toBeGreaterThan(20);

    for (const key of toolDescriptions) {
      const rendered = i18n.global.t(key);
      expect(rendered, key).toBeTruthy();
      expect(rendered, key).not.toBe(key);
    }
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
