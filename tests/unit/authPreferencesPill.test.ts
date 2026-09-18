/**
 * The login screen's two preferences, which are the only ones a visitor can
 * reach: the account panel that holds them once signed in is behind the screen
 * they are looking at.
 *
 * Both controls are easy to make *look* right and do nothing -- a flag that
 * swaps the flag without moving the app's locale, a sun/moon that flips its own
 * icon without touching `data-theme`. So the assertions here are on the effects
 * (`i18n.global.locale`, `localStorage`, `<html data-theme>`), not on the pill.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountWithPinia } from '../helpers/mount';
import AuthPreferencesPill from '../../src/components/auth/AuthPreferencesPill.vue';
import { i18n, setLocale, SUPPORTED_LOCALES } from '../../src/i18n';

type Wrapper = ReturnType<typeof mountWithPinia>;

const trigger = (wrapper: Wrapper) => wrapper.find('button[aria-haspopup="menu"]');
const themeBtn = (wrapper: Wrapper) => wrapper.find('.pill-btn--theme');
const items = (wrapper: Wrapper) => wrapper.findAll('[role="menuitemradio"]');

/** `iconify-icon` is a custom element, so it survives mount unstubbed. */
const iconOf = (el: ReturnType<Wrapper['find']>) => el.find('iconify-icon').attributes('icon');

/**
 * Let the menu's leave transition finish. jsdom never fires `transitionend`, so
 * Vue falls back to its zero-duration path, which still costs one animation
 * frame -- until that lands the menu is in the DOM with `leave-active` on it.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function openMenu(wrapper: Wrapper) {
  await trigger(wrapper).trigger('click');
  return items(wrapper);
}

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
});

afterEach(() => {
  // The i18n instance is the app's own singleton, shared by every test file;
  // a locale left on `es` here renames every label in the next one.
  setLocale('en');
});

describe('AuthPreferencesPill', () => {
  it('shows the current language as a flag, not a language code', () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    expect(iconOf(trigger(wrapper))).toBe('circle-flags:us');
    expect(trigger(wrapper).attributes('aria-label')).toContain('English');
  });

  it('keeps the menu shut until the flag is clicked', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    expect(items(wrapper)).toHaveLength(0);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');

    await openMenu(wrapper);

    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');
  });

  it('offers every language the app has, each named in itself', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const rows = await openMenu(wrapper);

    expect(rows).toHaveLength(SUPPORTED_LOCALES.length);
    expect(rows.map((r) => r.text())).toEqual(['English', 'Español']);
    // Endonyms stay put when the app is in Spanish -- that is the point of
    // them: the person opening this menu may not read the current locale.
    setLocale('es');
    await wrapper.vm.$nextTick();
    expect(items(wrapper).map((r) => r.text())).toEqual(['English', 'Español']);
  });

  it('marks the language that is on', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const rows = await openMenu(wrapper);

    expect(rows.map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false']);
  });

  it('actually switches the app language, and remembers it', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const rows = await openMenu(wrapper);
    await rows[1]!.trigger('click');

    expect(i18n.global.locale.value).toBe('es');
    expect(localStorage.getItem('kwami.locale')).toBe('es');
    expect(iconOf(trigger(wrapper))).toBe('circle-flags:es');
  });

  it('closes the menu once a language is picked', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const rows = await openMenu(wrapper);
    await rows[1]!.trigger('click');
    await settle();

    expect(items(wrapper)).toHaveLength(0);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
  });

  it('closes the menu on Escape', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    await openMenu(wrapper);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    expect(items(wrapper)).toHaveLength(0);
  });

  it('closes the menu when the pointer goes elsewhere', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    await openMenu(wrapper);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();

    expect(items(wrapper)).toHaveLength(0);
  });

  it('leaves no document listener behind when the screen goes away', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    await openMenu(wrapper);

    wrapper.unmount();

    // Would throw against a torn-down component if the handler were still live.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).not.toThrow();
  });

  it('turns the screen light, and back dark, from one button', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    expect(iconOf(themeBtn(wrapper))).toBe('ph:sun-fill');

    await themeBtn(wrapper).trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(iconOf(themeBtn(wrapper))).toBe('ph:moon-fill');

    await themeBtn(wrapper).trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(iconOf(themeBtn(wrapper))).toBe('ph:sun-fill');
  });

  it('reads back as a pressed toggle while the screen is light', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    expect(themeBtn(wrapper).attributes('aria-pressed')).toBe('false');

    await themeBtn(wrapper).trigger('click');

    expect(themeBtn(wrapper).attributes('aria-pressed')).toBe('true');
  });

  it('labels the theme button with what the click will do', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    expect(themeBtn(wrapper).attributes('aria-label')).toBe('Switch to light mode');

    await themeBtn(wrapper).trigger('click');

    expect(themeBtn(wrapper).attributes('aria-label')).toBe('Switch to dark mode');
  });

  it('settles on an explicit mode when the theme was following the system', async () => {
    // `system` and `auto` resolve to light or dark at paint time, so a two-state
    // toggle has to commit to one -- otherwise the first click appears to do
    // nothing whenever the resolved mode already matched the button's target.
    const wrapper = mountWithPinia(AuthPreferencesPill, {
      attachTo: document.body,
      initialState: { theme: { mode: 'system' } },
    });

    await themeBtn(wrapper).trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
