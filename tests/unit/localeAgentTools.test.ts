/**
 * Switching the app's own language by voice.
 *
 * The trap this exists to prevent: the agent already has `change_language`,
 * which sounds like it covers this and does not — it retunes speech
 * recognition and synthesis and leaves every label on screen in the old
 * language. A Spanish speaker asking for "la app en espanol" got a Kwami that
 * listened in Spanish and an interface still in English.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useLocaleAgentTools } from '@/composables/useLocaleAgentTools';
import { getCurrentLocale, setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { appLocaleEn, appLocaleEs } from '@/i18n/appLocale.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();
const savedLocales: { userId: string; locale: string }[] = [];

vi.mock('@/lib/userAppSettings', () => ({
  saveUserLocaleToDb: vi.fn(async (userId: string, locale: string) => {
    savedLocales.push({ userId, locale });
  }),
}));

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async () => true),
  }),
}));

const Host = defineComponent({
  setup() {
    const { registerLocaleTools } = useLocaleAgentTools();
    registerLocaleTools({
      registerTool: (def: ToolDef) => registered.set(def.name, def),
    } as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args);
}

beforeEach(() => {
  registered.clear();
  savedLocales.length = 0;
  localStorage.clear();
  setActivePinia(createPinia());
  setLocale('en');
  mount(Host);
});

describe('set_app_language', () => {
  it('switches the interface locale', async () => {
    const result = await call('set_app_language', { language: 'es' });
    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(getCurrentLocale()).toBe('es');
  });

  it('accepts the language named in words rather than as a code', async () => {
    const result = await call('set_app_language', { language: 'Spanish' });
    expect(result.success).toBe(true);
    expect(getCurrentLocale()).toBe('es');
  });

  it('accepts the language named in its own language, accents and all', async () => {
    const result = await call('set_app_language', { language: 'Español' });
    expect(result.success).toBe(true);
    expect(getCurrentLocale()).toBe('es');
  });

  it('accepts a regional tag', async () => {
    await call('set_app_language', { language: 'es-ES' });
    expect(getCurrentLocale()).toBe('es');
  });

  it('reports a no-op rather than claiming it changed something', async () => {
    const result = await call('set_app_language', { language: 'en' });
    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
  });

  it('refuses a language the app does not ship, without changing anything', async () => {
    const result = await call('set_app_language', { language: 'Klingon' });
    expect(result.success).toBe(false);
    expect(getCurrentLocale()).toBe('en');
    expect(String(result.message)).toContain('es');
  });

  it('remembers the choice the way the account panel does', async () => {
    // `userId` is a computed over `user`, so the user is what a test sets.
    useAuthStore().user = { id: 'user-1' } as never;
    await call('set_app_language', { language: 'es' });
    // A preference that only sticks when it was set by clicking is a
    // preference that looks broken when it was set by speaking.
    expect(savedLocales).toEqual([{ userId: 'user-1', locale: 'es' }]);
  });

  it('still switches when there is no signed-in user to save against', async () => {
    useAuthStore().user = null;
    const result = await call('set_app_language', { language: 'es' });
    expect(result.success).toBe(true);
    expect(getCurrentLocale()).toBe('es');
    expect(savedLocales).toHaveLength(0);
  });

  it('answers in the language it just switched to', async () => {
    const result = await call('set_app_language', { language: 'es' });
    // The reply is itself the proof to the user that the switch took.
    expect(String(result.message)).toContain('espanol');
  });
});

describe('get_app_language', () => {
  it('reports the current language and what else there is', async () => {
    const result = await call('get_app_language');
    expect(result.language).toBe('en');
    expect(result.available).toEqual(['en', 'es']);
  });
});

describe('registration', () => {
  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^appLocale\./);
    }
  });

  it('tells the model how this differs from change_language', () => {
    // The two are easy to confuse and the confusion is silent, so the
    // distinction has to live in the description the model actually reads.
    const description = registered.get('set_app_language')?.description ?? '';
    expect(description).toContain('change_language');
  });
});

describe('locale messages', () => {
  const bundles: Record<string, Record<string, unknown>> = { en: appLocaleEn, es: appLocaleEs };

  function leafKeys(node: unknown, prefix = ''): string[] {
    if (typeof node === 'string') return [prefix];
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  }

  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`compiles every ${locale} message`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: bundle } });
      for (const key of leafKeys(bundle)) {
        expect(() => i18n.global.t(key, { language: 'x', list: 'x' })).not.toThrow();
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(appLocaleEs).sort()).toEqual(leafKeys(appLocaleEn).sort());
  });
});
