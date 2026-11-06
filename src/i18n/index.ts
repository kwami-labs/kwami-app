import { createI18n } from 'vue-i18n';
import { workspaceAgentToolsEn, workspaceAgentToolsEs } from './workspaceAgentTools.locale';
import { appLocaleEn, appLocaleEs } from './appLocale.locale';
import { charterEn, charterEs } from './charter.locale';
import { brainEn, brainEs } from './brain.locale';
import { enginesEn, enginesEs } from './engines.locale';
import { commsAgentToolsEn, commsAgentToolsEs } from './commsAgentTools.locale';
import { assistantEn, assistantEs } from './assistant.locale';
import { layoutEn, layoutEs } from './layout.locale';
import { kwamiAdminEn, kwamiAdminEs } from './kwamiAdmin.locale';
import { extrasEn, extrasEs } from './extras.locale';
import { recallEn, recallEs } from './recall.locale';
import { searchPanelEn, searchPanelEs } from './searchPanel.locale';
import { avatarUnavailableEn, avatarUnavailableEs } from './avatarUnavailable.locale';
import { toolsPanelEn, toolsPanelEs } from './toolsPanel.locale';
import { siteAccessEn, siteAccessEs } from './siteAccess.locale';
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
  en: {
    ...en,
    ...workspaceAgentToolsEn,
    ...searchPanelEn,
    ...commsAgentToolsEn,
    ...assistantEn,
    ...layoutEn,
    ...appLocaleEn,
    ...kwamiAdminEn,
    ...recallEn,
    ...extrasEn,
    ...charterEn,
    ...brainEn,
    ...avatarUnavailableEn,
    ...enginesEn,
    ...toolsPanelEn,
    ...siteAccessEn,
  },
  es: {
    ...es,
    ...workspaceAgentToolsEs,
    ...searchPanelEs,
    ...commsAgentToolsEs,
    ...assistantEs,
    ...layoutEs,
    ...appLocaleEs,
    ...kwamiAdminEs,
    ...recallEs,
    ...extrasEs,
    ...charterEs,
    ...brainEs,
    ...avatarUnavailableEs,
    ...enginesEs,
    ...toolsPanelEs,
    ...siteAccessEs,
  },
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

/**
 * Tell the browser which language the page is actually in.
 *
 * `index.html` ships `lang="en"` and nothing ever changed it, so a page rendered
 * in Spanish still declared itself English. Chrome and Edge then offered -- or,
 * for users who had accepted once, silently ran -- "translate from English",
 * which rewrote text that was already Spanish: tool names such as
 * `set_search_panel` came out as "establecer_panel_de_búsqueda", and control
 * values the model reads ("floating", "true") as "flotante", "verdadero". The
 * Tools panel then showed names the agent has never heard of.
 *
 * Kept in step from one place, because the locale is set from five callers
 * (account panel, sign-in pill, saved settings, the language tool, boot).
 */
export function syncDocumentLanguage(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

syncDocumentLanguage(getCurrentLocale());

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  syncDocumentLanguage(locale);
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
