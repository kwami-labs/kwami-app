import { createI18n } from 'vue-i18n';
import {
  workspaceAgentToolsEn,
  workspaceAgentToolsEs,
} from './workspaceAgentTools.locale';
import { appLocaleEn, appLocaleEs } from './appLocale.locale';
import {
  commsAgentToolsEn,
  commsAgentToolsEs,
} from './commsAgentTools.locale';
import {
  kwamiAdminEn,
  kwamiAdminEs,
} from './kwamiAdmin.locale';
import { extrasEn, extrasEs } from './extras.locale';
import { recallEn, recallEs } from './recall.locale';
import {
  searchPanelEn,
  searchPanelEs,
} from './searchPanel.locale';
import { en } from './translations/en';
import { es } from './translations/es';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'en';
const LOCALE_STORAGE_KEY = 'kwami.locale';

/**
 * Each language written in itself, not translated.
 *
 * A language picker is the one control whose labels must not follow the
 * current locale: the person reaching for it is, by definition, someone who
 * may not read the language the app is in right now. Endonyms also mean the
 * list needs no entry in `en.ts` / `es.ts` -- adding a locale is one line here.
 *
 * Not to be merged with `languageName()` in `useLocaleAgentTools`, which looks
 * like the same thing and is not: that returns a language's name *in the
 * current locale* ("Spanish" in English, "espagnol" in French) because it is
 * read back inside a sentence the agent speaks, and it comes from
 * `Intl.DisplayNames`. These are endonyms for a picker, and never translate.
 */
export const LOCALE_ENDONYMS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * Exported so tests build their i18n from the same object the app does.
 *
 * `tests/setup.ts` used to re-assemble this spread by hand, which meant a new
 * locale bundle was live in the app and missing under test -- every message in
 * it rendered as its own key path, and the tool descriptions the model reads
 * were the ones nobody had checked.
 */
export const messages = {
  en: { ...en, ...workspaceAgentToolsEn, ...searchPanelEn, ...commsAgentToolsEn, ...appLocaleEn, ...kwamiAdminEn, ...recallEn, ...extrasEn },
  es: { ...es, ...workspaceAgentToolsEs, ...searchPanelEs, ...commsAgentToolsEs, ...appLocaleEs, ...kwamiAdminEs, ...recallEs, ...extrasEs },
} as const;

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale) return DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : DEFAULT_LOCALE;
}

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale) return normalizeLocale(storedLocale);

  const browserLocale = window.navigator.language?.split('-')?.[0];
  return normalizeLocale(browserLocale);
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
});

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function getCurrentLocale(): SupportedLocale {
  return normalizeLocale(i18n.global.locale.value);
}

/** BCP 47 tag for `Intl` date/time formatting (matches app locale). */
const INTL_TAGS: Record<SupportedLocale, string> = {
  en: 'en-US',
  es: 'es-ES',
};

export function intlLocaleTag(locale: SupportedLocale): string {
  return INTL_TAGS[locale] ?? INTL_TAGS.en;
}
