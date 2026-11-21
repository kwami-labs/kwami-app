/**
 * Refreshing the app without a page left lying over it, the interface sized for each
 * desktop, and screens that say which one they are and take a window dropped on their tab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { hudEn } from '@/i18n/hud.locale';
import { autoScale, parseScaleChoice } from '@/composables/useUiScale';

const invoke = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn() }),
}));

const { claimNative, nativeWeb, ownsNative, releaseNative, setNativeScale } =
  await import('@/lib/hud/nativeWeb');

const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } });

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useHudStore().setViewport({ width: 1600, height: 900 });
  invoke.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  setNativeScale(1);
});

describe("a window's native view survives a remount", () => {
  it('closes a moment after the window goes, unless it mounts again and takes it over', async () => {
    vi.useFakeTimers();
    const first = Symbol('first');
    expect(claimNative('w1', first)).toBe(false);
    releaseNative('w1', first);
    // Mounted again before the close: the view is adopted, never closed.
    const second = Symbol('second');
    expect(claimNative('w1', second)).toBe(true);
    expect(ownsNative('w1', first)).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(invoke).not.toHaveBeenCalledWith('hud_web_close', expect.anything());

    releaseNative('w1', second);
    await vi.advanceTimersByTimeAsync(2000);
    expect(invoke).toHaveBeenCalledWith('hud_web_close', { label: 'w1' });
  });

  it('a stale mount cannot close what a newer one owns', async () => {
    vi.useFakeTimers();
    const old = Symbol('old');
    const fresh = Symbol('fresh');
    claimNative('w2', old);
    claimNative('w2', fresh);
    releaseNative('w2', old);
    await vi.advanceTimersByTimeAsync(2000);
    expect(invoke).not.toHaveBeenCalled();
    expect(ownsNative('w2', fresh)).toBe(true);
  });

  it('places views in logical pixels when the interface is zoomed', async () => {
    setNativeScale(1.25);
    await nativeWeb.place('w3', { x: 100, y: 40, width: 400, height: 300 });
    expect(invoke).toHaveBeenCalledWith('hud_web_bounds', {
      label: 'w3',
      x: 125,
      y: 50,
      width: 500,
      height: 375,
      visible: true,
    });
  });
});

describe('the interface size', () => {
  it('fits the monitor on auto: 100 % up to 1920×1080, larger above, never past 175 %', () => {
    expect(autoScale(1920, 1080)).toBe(1);
    expect(autoScale(1366, 768)).toBe(1);
    expect(autoScale(2560, 1440)).toBe(1.35);
    expect(autoScale(3440, 1440)).toBe(1.35);
    expect(autoScale(3840, 2160)).toBe(1.75);
    expect(autoScale(0, 0)).toBe(1);
  });

  it('reads a size as said or stored: a factor, a percentage, or auto', () => {
    expect(parseScaleChoice('auto')).toBe('auto');
    expect(parseScaleChoice('125%')).toBe(1.25);
    expect(parseScaleChoice(150)).toBe(1.5);
    expect(parseScaleChoice('1.2')).toBe(1.2);
    expect(parseScaleChoice(500)).toBe(2);
    expect(parseScaleChoice(0.5)).toBe(0.8);
    expect(parseScaleChoice('huge')).toBeNull();
    expect(parseScaleChoice(null)).toBeNull();
  });
});

describe('screens that say which one they are', () => {
  it('switching says so, by screen', () => {
    const hud = useHudStore();
    const second = hud.addScreen('Media')!;
    hud.switchScreen(hud.screens[0].id);
    hud.switchScreen(second.id);
    expect(hud.screenNotice).toMatchObject({ screen: second.id });
    expect(hud.screenNotice?.moved).toBeUndefined();
  });

  it('a window dropped on a tab goes to that screen as it was, and the user is told', () => {
    const hud = useHudStore();
    const doc = hud.openDocument(hud.createDocument('Notes', '# Notes'), 'user');
    const home = hud.activeScreen;
    const before = { ...hud.rectOf(doc) };
    const other = hud.addScreen('Work')!;
    hud.switchScreen(home);
    hud.setRect(doc.id, { ...before, x: before.x + 300 }, true);
    hud.sendToScreen(doc.id, other.id, before);
    expect(doc.screen).toBe(other.id);
    expect(hud.rectOf(doc)).toMatchObject({ x: before.x, y: before.y });
    expect(hud.screenNotice).toMatchObject({ screen: other.id, moved: 'Notes' });
    expect(hud.activeScreen).toBe(home);
  });

  it('the banner names the screen and counts its windows', async () => {
    vi.useFakeTimers();
    const { default: Banner } = await import('@/components/hud/HudScreenBanner.vue');
    const hud = useHudStore();
    const wrapper = mount(Banner, { global: { plugins: [i18n()] } });
    hud.addScreen('Media');
    hud.openDocument(hud.createDocument('A', 'a'), 'user');
    await nextTick();
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('Media');
    expect(wrapper.text()).toContain('1 window');
    await vi.advanceTimersByTimeAsync(1500);
    await nextTick();
    expect(wrapper.find('.hud-screen-banner').exists()).toBe(false);
    hud.switchScreen(hud.screens[0].id);
    await nextTick();
    expect(wrapper.text()).toContain('Screen 1');
    wrapper.unmount();
  });

  it('Jarvis is told each screen by number, with its windows, and which is shown', async () => {
    const { useHudAgentTools } = await import('@/composables/useHudAgentTools');
    let show: (args: Record<string, unknown>) => Record<string, unknown> = () => ({});
    mount(
      defineComponent({
        setup() {
          show = useHudAgentTools().showOnScreen as typeof show;
          return () => h('div');
        },
      }),
      { global: { plugins: [i18n()] } },
    );
    const hud = useHudStore();
    hud.openDocument(hud.createDocument('A', 'a'), 'user');
    hud.addScreen('Media');
    hud.switchScreen(hud.screens[0].id);
    const listed = show({ action: 'list' }) as {
      screens: string[];
      screenDetails: unknown[];
      windows: { screenNumber: number }[];
    };
    expect(listed.screens).toEqual(['Screen 1', 'Media']);
    expect(listed.screenDetails).toEqual([
      { n: 1, name: 'Screen 1', windows: 1, shown: true },
      { n: 2, name: 'Media', windows: 0 },
    ]);
    expect(listed.windows[0].screenNumber).toBe(1);
  });
});

describe('screens as the user names them', () => {
  it('by number, ordinal, number word, name, or what is on them', async () => {
    const { useHudAgentTools } = await import('@/composables/useHudAgentTools');
    let find: (ref: string) => string | undefined = () => undefined;
    mount(
      defineComponent({
        setup() {
          find = useHudAgentTools().findScreen;
          return () => h('div');
        },
      }),
      { global: { plugins: [i18n()] } },
    );
    const hud = useHudStore();
    const first = hud.activeScreen;
    const media = hud.addScreen('Media')!;
    hud.open({ kind: 'video', title: 'Iron Man suits', url: 'https://www.youtube.com/watch?v=x' });
    const work = hud.addScreen('Trabajo')!;
    expect(find('2')).toBe(media.id);
    expect(find('la segunda')).toBe(media.id);
    expect(find('pantalla dos')).toBe(media.id);
    expect(find('screen three')).toBe(work.id);
    expect(find('trabajo')).toBe(work.id);
    expect(find('la del vídeo')).toBe(media.id);
    expect(find('the one with Iron Man')).toBe(media.id);
    expect(find('primera')).toBe(first);
    expect(find('Iron Man')).toBeUndefined();
    expect(find('décima')).toBeUndefined();
  });
});

describe('the HUD writes to storage only what changed', () => {
  it('does not rewrite an unchanged layout, and writes what is pending as the page goes', async () => {
    vi.useFakeTimers();
    const hud = useHudStore();
    const doc = hud.openDocument(hud.createDocument('Notes', 'x'), 'user');
    await vi.advanceTimersByTimeAsync(500);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    hud.focus(doc.id);
    hud.focus(doc.id);
    await vi.advanceTimersByTimeAsync(500);
    const layoutWrites = () => set.mock.calls.filter(([key]) => key === 'kwami-hud-layout').length;
    expect(layoutWrites()).toBeLessThanOrEqual(1);
    const before = layoutWrites();
    await vi.advanceTimersByTimeAsync(500);
    expect(layoutWrites()).toBe(before);

    hud.rename(doc.id, 'Renamed');
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem('kwami-hud-layout')).toContain('Renamed');
    set.mockRestore();
  });
});
