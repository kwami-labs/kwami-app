import { createI18n } from 'vue-i18n';
import { 
  workspaceAgentToolsEn, 
  workspaceAgentToolsEs 
} from './workspaceAgentTools.locale';
import { en } from './translations/en';
import { es } from './translations/es';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'en';
const LOCALE_STORAGE_KEY = 'kwami.locale';

const messages = {
  en: { ...en, ...workspaceAgentToolsEn },
  es: { ...es, ...workspaceAgentToolsEs },
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
export function intlLocaleTag(locale: SupportedLocale): string {
  return locale === 'es' ? 'es-ES' : 'en-US';
}
