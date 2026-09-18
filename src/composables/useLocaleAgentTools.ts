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

/** Names the model is likely to produce, mapped to the locales we ship. */
const LANGUAGE_ALIASES: Record<string, SupportedLocale> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  ingles: 'en',
  es: 'es',
  spa: 'es',
  spanish: 'es',
  espanol: 'es',
  castellano: 'es',
};

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

export function useLocaleAgentTools() {
  const { t } = useI18n();
  const actionState = useAgentActionState();

  function resolveLocale(language: unknown): SupportedLocale | null {
    const raw = asString(language).trim();
    if (!raw) return null;
    const key = normalizeKey(raw);
    if (LANGUAGE_ALIASES[key]) return LANGUAGE_ALIASES[key];
    // A tag like "es-ES" still names a locale we ship.
    const base = normalizeKey(raw.split(/[-_]/)[0] ?? '');
    return LANGUAGE_ALIASES[base] ?? null;
  }

  function getAppLanguage() {
    const current = getCurrentLocale();
    return {
      success: true,
      language: current,
      available: [...SUPPORTED_LOCALES],
      message: t('appLocale.current', { language: t(`appLocale.name.${current}`) }),
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
        message: t('appLocale.already', { language: t(`appLocale.name.${target}`) }),
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
      // Reported in the language just switched to, which is itself the proof
      // to the user that it took.
      message: t('appLocale.changed', { language: t(`appLocale.name.${target}`) }),
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
