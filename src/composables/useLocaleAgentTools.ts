import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import {
  SUPPORTED_LOCALES,
  getCurrentLocale,
  normalizeLocale,
  setLocale,
  type SupportedLocale,
} from '@/i18n';
import { saveUserLocaleToDb } from '@/lib/userAppSettings';
import { useAuthStore } from '@/stores/auth';
import { useAgentActionState } from '@/composables/useAgentActionState';

/**
 * Let the agent switch the app's own language.
 *
 * The account panel has always had this selector, and nothing could reach it
 * by voice. The agent's `change_language` sounds like it covers this but does
 * not: it retunes speech recognition and synthesis and never touches the
 * interface, so "cambia la app a espanol" changed how the agent heard the user
 * and left every label in English.
 *
 * Deliberately does exactly what `AccountPanel.vue`'s `selectedLanguage`
 * setter does, including writing the choice back to the user's settings row.
 * A preference that only sticks when it was set by clicking is a preference
 * that looks broken when it was set by speaking.
 */

/**
 * Extra spoken names that `Intl` will not produce on its own.
 *
 * Everything derivable is derived below; this is only for the words people
 * actually say that no locale data lists -- "castellano" for Spanish being
 * the obvious one.
 */
const EXTRA_ALIASES: Record<string, SupportedLocale> = {
  castellano: 'es',
};

/**
 * Every spoken form that should resolve to a locale we ship.
 *
 * Built from `SUPPORTED_LOCALES` rather than hand-listed, so adding a
 * language to the app makes it reachable by voice with no change here. For
 * each locale it collects the tag itself plus that language's name as spoken
 * in every locale we support -- so "French", "francais" and "francese" all
 * arrive at `fr`. Hand-maintaining that table costs one entry per pair and
 * grows with the square of the language count; this costs nothing.
 */
function buildAliases(): Record<string, SupportedLocale> {
  const aliases: Record<string, SupportedLocale> = {};
  for (const locale of SUPPORTED_LOCALES) {
    aliases[locale] = locale;
    for (const spokenIn of SUPPORTED_LOCALES) {
      const name = languageName(locale, spokenIn);
      if (name) aliases[normalizeKey(name)] = locale;
    }
  }
  return { ...aliases, ...EXTRA_ALIASES };
}

let aliasCache: Record<string, SupportedLocale> | null = null;

function languageAliases(): Record<string, SupportedLocale> {
  aliasCache ??= buildAliases();
  return aliasCache;
}

function normalizeKey(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      // Strip accents so "espanol" and "español" are the same key.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\s_-]+/g, '')
  );
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * A language's name as spoken in another language -- "Spanish" in English,
 * "espagnol" in French.
 *
 * `Intl.DisplayNames` already holds this for every pair, correctly accented,
 * so the app does not carry a hand-written table that grows with the square
 * of the language count. Falls back to the bare tag on the runtimes that ship
 * without full locale data rather than throwing, since a tool that cannot
 * name a language should still be able to switch to it.
 */
export function languageName(locale: SupportedLocale, spokenIn: SupportedLocale): string {
  try {
    return new Intl.DisplayNames([spokenIn], { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

export function useLocaleAgentTools() {
  const { t } = useI18n();
  const actionState = useAgentActionState();

  function resolveLocale(language: unknown): SupportedLocale | null {
    const raw = asString(language).trim();
    if (!raw) return null;
    const aliases = languageAliases();
    const key = normalizeKey(raw);
    if (aliases[key]) return aliases[key];
    // A tag like "es-ES" still names a locale we ship.
    const base = normalizeKey(raw.split(/[-_]/)[0] ?? '');
    return aliases[base] ?? null;
  }

  function getAppLanguage() {
    const current = getCurrentLocale();
    return {
      success: true,
      language: current,
      available: [...SUPPORTED_LOCALES],
      // Named in the language the user is currently reading, which is what
      // makes the sentence natural rather than a tag read aloud.
      languageNames: Object.fromEntries(
        SUPPORTED_LOCALES.map((l) => [l, languageName(l, current)]),
      ),
      message: t('appLocale.current', { language: languageName(current, current) }),
    };
  }

  async function setAppLanguage(language: unknown) {
    const target = resolveLocale(language);
    if (!target) {
      return {
        success: false,
        message: t('appLocale.unsupported', {
          language: asString(language),
          list: SUPPORTED_LOCALES.join(', '),
        }),
      };
    }

    const current = getCurrentLocale();
    if (current === target) {
      return {
        success: true,
        language: target,
        changed: false,
        message: t('appLocale.already', { language: languageName(target, current) }),
      };
    }

    setLocale(normalizeLocale(target));

    // Mirrors the account panel: remember it for next time, and do not let a
    // failed write undo a switch the user can already see.
    const userId = useAuthStore().userId;
    if (userId) {
      try {
        await saveUserLocaleToDb(userId, target);
      } catch {
        // The language did change; it just may not survive a reload.
      }
    }

    actionState.recordAction(t('appLocale.actionChanged'), target, { announce: true });
    return {
      success: true,
      language: target,
      changed: true,
      // Named in the language just switched to, which is itself the proof to
      // the user that it took.
      message: t('appLocale.changed', { language: languageName(target, target) }),
    };
  }

  function registerLocaleTools(instance: Kwami) {
    instance.registerTool({
      name: 'get_app_language',
      description: t('appLocale.toolDescGetAppLanguage'),
      parameters: {},
      handler: async () => getAppLanguage(),
    });

    instance.registerTool({
      name: 'set_app_language',
      description: t('appLocale.toolDescSetAppLanguage'),
      parameters: {
        language: { type: 'string', enum: [...SUPPORTED_LOCALES] },
      },
      handler: async ({ language }) => setAppLanguage(language),
    });
  }

  return {
    resolveLocale,
    getAppLanguage,
    setAppLanguage,
    registerLocaleTools,
  };
}
