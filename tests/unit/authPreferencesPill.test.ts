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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import AuthPreferencesPill from '../../src/components/auth/AuthPreferencesPill.vue';
import { i18n, setLocale, SUPPORTED_LOCALES } from '../../src/i18n';
import { useWelcomeBackground } from '../../src/composables/useWelcomeBackground';
import { sceneVideoPresets } from '../../src/presets/scene/video-presets';

type Wrapper = ReturnType<typeof mountWithPinia>;

const trigger = (wrapper: Wrapper) => wrapper.find('.pill-btn--flag');
const videoBtn = (wrapper: Wrapper) => wrapper.find('.pill-btn--video');
const themeBtn = (wrapper: Wrapper) => wrapper.find('.pill-btn--theme');
const items = (wrapper: Wrapper) => wrapper.findAll('[role="menuitemradio"]');
const rows = (wrapper: Wrapper) => wrapper.findAll('.menu-item');

/** `iconify-icon` is a custom element, so it survives mount unstubbed. */
const iconOf = (el: ReturnType<Wrapper['find']>) => el.find('iconify-icon').attributes('icon');

/**
 * Wait for the menu's leave transition to actually finish.
 *
 * jsdom never fires `transitionend`, so Vue falls back to its zero-duration
 * path -- which still costs one animation frame, and until that frame lands the
 * menu is in the DOM with `leave-active` on it. This polls rather than sleeping
 * a fixed 60ms, which is what it used to do: 60ms of wall clock is not one
 * frame, it is a guess about one frame, and under a loaded worker the frame
 * lands later and the assertion runs against a menu that is still there.
 * Caught by kwami-app-53, who reproduced it 1-in-6 in isolation under load.
 */
const menuClosed = (wrapper: Wrapper) =>
  vi.waitFor(() => expect(items(wrapper)).toHaveLength(0), { timeout: 2000, interval: 10 });

async function openMenu(wrapper: Wrapper) {
  await trigger(wrapper).trigger('click');
  return items(wrapper);
}

async function openVideoMenu(wrapper: Wrapper) {
  await videoBtn(wrapper).trigger('click');
  return rows(wrapper);
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
  // Module-level state, shared with every other test in the run.
  useWelcomeBackground().setVideo(null);
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

    await menuClosed(wrapper);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
  });

  it('closes the menu on Escape', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    await openMenu(wrapper);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await menuClosed(wrapper);
  });

  it('closes the menu when the pointer goes elsewhere', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    await openMenu(wrapper);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    await menuClosed(wrapper);
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

  // --- background ----------------------------------------------------------

  it('starts on the painted gradient, with no clip chosen', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const menu = await openVideoMenu(wrapper);

    expect(menu[0]!.text()).toBe('Gradient');
    expect(menu[0]!.attributes('aria-checked')).toBe('true');
  });

  it('offers every clip in the shared scene catalogue', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const menu = await openVideoMenu(wrapper);

    // Gradient + shuffle, then one row per preset.
    expect(menu).toHaveLength(sceneVideoPresets.length + 2);
    expect(menu.at(-1)!.text()).toBe(sceneVideoPresets.at(-1)!.name);
  });

  it('puts a chosen clip on the screen, and remembers it', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    const first = sceneVideoPresets[0]!;

    const menu = await openVideoMenu(wrapper);
    await menu[2]!.trigger('click');

    expect(useWelcomeBackground().video.value?.id).toBe(first.id);
    expect(localStorage.getItem('kwami.welcomeBackground')).toBe(first.id);
    expect(videoBtn(wrapper).attributes('aria-label')).toBe(`Background: ${first.name}`);
  });

  it('goes back to the gradient, and forgets the clip', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    useWelcomeBackground().setVideo(sceneVideoPresets[3]!.id);
    await wrapper.vm.$nextTick();

    const menu = await openVideoMenu(wrapper);
    await menu[0]!.trigger('click');

    expect(useWelcomeBackground().video.value).toBeNull();
    expect(localStorage.getItem('kwami.welcomeBackground')).toBeNull();
  });

  it('shuffles to a clip that is not the one already on', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });
    const bg = useWelcomeBackground();
    bg.setVideo(sceneVideoPresets[0]!.id);
    await wrapper.vm.$nextTick();

    const menu = await openVideoMenu(wrapper);
    // Many rolls, because "never the current one" is the claim and a single
    // roll passes by luck against a plain random index.
    for (let i = 0; i < 40; i++) {
      const before = bg.videoId.value;
      await menu[1]!.trigger('click');
      expect(bg.videoId.value).not.toBe(before);
    }
  });

  it('keeps the menu open while shuffling, so a few rolls is one gesture', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    const menu = await openVideoMenu(wrapper);
    await menu[1]!.trigger('click');
    await wrapper.vm.$nextTick();

    expect(videoBtn(wrapper).attributes('aria-expanded')).toBe('true');
  });

  it('opens only one menu at a time, though both hang off the same corner', async () => {
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    await openMenu(wrapper);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');

    await videoBtn(wrapper).trigger('click');
    await wrapper.vm.$nextTick();

    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
    expect(videoBtn(wrapper).attributes('aria-expanded')).toBe('true');
  });

  it('ignores a remembered clip that has since left the catalogue', () => {
    localStorage.setItem('kwami.welcomeBackground', 'a-clip-that-was-deleted');
    // Re-read through a fresh module instance, since the id is read at import.
    const wrapper = mountWithPinia(AuthPreferencesPill, { attachTo: document.body });

    useWelcomeBackground().setVideo('a-clip-that-was-deleted');

    expect(useWelcomeBackground().video.value).toBeNull();
    expect(videoBtn(wrapper).attributes('aria-label')).toBe('Change background');
  });
});
