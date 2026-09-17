import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/translations/en';
import { es } from '../../src/i18n/translations/es';
import { workspaceAgentToolsEn, workspaceAgentToolsEs } from '../../src/i18n/workspaceAgentTools.locale';
import { normalizeLocale, intlLocaleTag, SUPPORTED_LOCALES } from '../../src/i18n';

/** Flattens a nested message object to dotted leaf paths. */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('i18n locale parity', () => {
  it('en and es expose an identical key set', () => {
    const enKeys = new Set(leafKeys(en));
    const esKeys = new Set(leafKeys(es));

    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();

    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });

  it('agent-tool locales expose an identical key set', () => {
    expect(leafKeys(workspaceAgentToolsEs).sort()).toEqual(leafKeys(workspaceAgentToolsEn).sort());
  });

  it('has no empty translation values', () => {
    const empties = (obj: unknown, prefix = ''): string[] => {
      if (typeof obj === 'string') return obj.trim() === '' ? [prefix] : [];
      if (obj === null || typeof obj !== 'object') return [];
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        empties(v, prefix ? `${prefix}.${k}` : k),
      );
    };
    expect({ en: empties(en), es: empties(es) }).toEqual({ en: [], es: [] });
  });
});

describe('locale helpers', () => {
  it('normalizes unknown and empty locales to en', () => {
    expect(normalizeLocale('fr')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
    expect(normalizeLocale(undefined)).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('passes through supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) expect(normalizeLocale(locale)).toBe(locale);
  });

  it('maps locales to BCP 47 tags', () => {
    expect(intlLocaleTag('en')).toBe('en-US');
    expect(intlLocaleTag('es')).toBe('es-ES');
  });
});
