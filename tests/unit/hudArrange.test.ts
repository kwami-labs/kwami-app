/**
 * Arranging Jarvis's HUD: screens to switch between, windows gathered as tabs, snapped
 * to halves and quarters, tiled, renamed, and the whole arrangement kept for next time.
 * Plus the leaner traffic with the agent: frames only while someone looks, and the
 * report the agent already split from what it said.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useNavigationStore } from '@/stores/navigation';
import { useHud, REPORT_CHARS } from '@/composables/useHud';
import { hudEn } from '@/i18n/hud.locale';
import { composeReport } from '@/lib/hud/markdown';
import {
  freeRect,
  gridShape,
  leastCovering,
  sideSlots,
  snapRect,
  snapZoneAt,
  tileRects,
  TOP_GUTTER,
} from '@/lib/hud/layout';

vi.mock('@/lib/hud/external', () => ({ openExternal: vi.fn() }));

const view = { width: 1600, height: 900 };

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  setActivePinia(createPinia());
});

/** These tests place windows themselves: Jarvis's own tidying (hudVoice.test.ts) stays off. */
function store() {
  const hud = useHudStore();
  hud.setViewport(view);
  hud.setPref('autoArrange', false);
  return hud;
}

describe('snapping and tiling', () => {
  it('finds the zone under the pointer near an edge or a corner', () => {
    expect(snapZoneAt(10, 400, view)).toBe('left');
    expect(snapZoneAt(1590, 400, view)).toBe('right');
    expect(snapZoneAt(800, TOP_GUTTER + 4, view)).toBe('top');
    expect(snapZoneAt(10, TOP_GUTTER + 4, view)).toBe('topLeft');
    expect(snapZoneAt(1590, TOP_GUTTER + 4, view)).toBe('topRight');
    expect(snapZoneAt(10, 820, view)).toBe('bottomLeft');
    expect(snapZoneAt(1590, 820, view)).toBe('bottomRight');
    expect(snapZoneAt(800, 400, view)).toBeNull();
    expect(snapZoneAt(560, 400, { ...view, left: 540 })).toBe('left');
  });

  it('turns a zone into a half, a quarter or the whole band', () => {
    const left = snapRect('left', view);
    const right = snapRect('right', view);
    expect(left.x).toBe(16);
    expect(right.x).toBeGreaterThan(left.x + left.w);
    expect(snapRect('top', view).w).toBe(view.width - 32);
    const quarter = snapRect('bottomRight', view);
    expect(quarter.h).toBeLessThan(left.h);
    expect(snapRect('topLeft', view).y).toBe(snapRect('topRight', view).y);
    expect(snapRect('bottomLeft', view).x).toBe(16);
  });

  it('lays windows out as a grid', () => {
    expect(tileRects(0, view)).toEqual([]);
    expect(tileRects(1, view)[0].w).toBe(view.width - 32);
    const five = tileRects(5, view);
    expect(five).toHaveLength(5);
    expect(new Set(five.map((r) => r.y)).size).toBe(2);
  });

  it('never makes a grid cell narrower than a window can be', () => {
    const narrow = { width: 560, height: 900 };
    expect(gridShape(narrow).cols).toBe(1);
    const two = tileRects(2, narrow);
    expect(two[0].x).toBe(two[1].x);
    expect(gridShape({ width: 100, height: 100 })).toEqual({ cols: 1, rows: 1 });
  });

  it('finds the room the user’s windows leave', () => {
    const left = snapRect('left', view);
    const lower = snapRect('bottomRight', view);
    expect(freeRect(view, [left, lower])).toEqual({
      x: left.x + left.w + 8,
      y: TOP_GUTTER,
      w: view.width - 16 - (left.x + left.w + 8),
      h: lower.y - 8 - TOP_GUTTER,
    });
    expect(freeRect(view, [snapRect('top', view)])).toBeNull();
    const right = snapRect('right', view);
    const [only] = sideSlots(view, [right]);
    expect(only.x).toBe(16);
    expect(
      sideSlots({ width: 1000, height: 900 }, [snapRect('right', { width: 1000, height: 900 })]),
    ).toHaveLength(1);
    const middle = { x: 400, y: 100, w: 200, h: 200 };
    const [a, b] = sideSlots({ width: 1000, height: 900 }, [middle]);
    expect(a.x).toBe(16);
    expect(b.x + b.w).toBe(1000 - 16);
  });

  it('hides as little as it can when there is no room at all', () => {
    const top = snapRect('top', view);
    expect(leastCovering(view, [top]).x).toBeGreaterThan(view.width / 2);
    const left = snapRect('left', view);
    const lowRight = { ...snapRect('bottomRight', view) };
    const topRight = { ...snapRect('topRight', view) };
    const spot = leastCovering(view, [left, topRight, { ...lowRight, w: 100 }]);
    expect(spot.y).toBeGreaterThan(TOP_GUTTER);
  });
});

describe('screens', () => {
  it('opens windows on the screen in view, and switches between screens', () => {
    const hud = store();
    const first = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const second = hud.addScreen('Investigación');
    expect(second && hud.activeScreen).toBe(second?.id);
    const other = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    expect(other.screen).toBe(second?.id);
    expect(hud.visible.map((w) => w.id)).toEqual([other.id]);
    hud.cycleScreen(1);
    expect(hud.visible.map((w) => w.id)).toEqual([first.id]);
    hud.cycleScreen(-1);
    expect(hud.activeScreen).toBe(second?.id);
    expect(hud.windowsOn('main')).toBe(1);
    hud.switchScreen('nope');
    hud.switchScreen(second!.id);
    expect(hud.activeScreen).toBe(second?.id);
  });

  it('brings a window asked for again to the screen in view', () => {
    const hud = store();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'D' });
    hud.addScreen();
    hud.open({ kind: 'document', docId: 'd', title: 'D' });
    expect(doc.screen).toBe(hud.activeScreen);
  });

  it('renames, moves windows between screens and never loses them when one goes', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const s2 = hud.addScreen()!;
    hud.renameScreen(s2.id, '  Medios  ');
    expect(hud.screens[1].name).toBe('Medios');
    hud.renameScreen('nope', 'x');
    hud.moveToScreen(a.id, s2.id);
    expect(a.screen).toBe(s2.id);
    hud.moveToScreen(a.id, 'nope');
    hud.moveToScreen('nope', s2.id);
    hud.removeScreen(s2.id);
    expect(a.screen).toBe('main');
    expect(hud.activeScreen).toBe('main');
    hud.removeScreen('main');
    expect(hud.screens).toHaveLength(1);
    hud.removeScreen('nope');
  });

  it('hands the first screen’s windows to the next when it is the one removed', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const s2 = hud.addScreen()!;
    hud.switchScreen('main');
    hud.removeScreen('main');
    expect(a.screen).toBe(s2.id);
    expect(hud.activeScreen).toBe(s2.id);
  });

  it('stops at nine screens', () => {
    const hud = store();
    for (let i = 0; i < 12; i++) hud.addScreen();
    expect(hud.screens).toHaveLength(9);
    expect(hud.addScreen()).toBeNull();
  });
});

describe('tabs', () => {
  it('gathers windows as tabs of one, which move, fold and grow together', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const b = hud.open({ kind: 'document', docId: 'd', title: 'b' });
    hud.setRect(a.id, { x: 100, y: 100, w: 500, h: 400 });
    hud.joinTabs(b.id, a.id);
    expect(hud.membersOf(a).map((w) => w.id)).toEqual([a.id, b.id]);
    expect(b.rect).toEqual(a.rect);
    expect(hud.isShown(b) && !hud.isShown(a)).toBe(true);
    expect(hud.visible).toHaveLength(1);

    hud.activateTab(a.id);
    expect(hud.isShown(a)).toBe(true);
    hud.setRect(a.id, { x: 200, y: 120, w: 520, h: 420 });
    expect(b.rect.x).toBe(200);
    hud.minimize(a.id);
    expect(b.minimized).toBe(true);
    expect(hud.docked).toHaveLength(1);
    hud.restore(b.id);
    expect(a.minimized).toBe(false);
    hud.toggleMaximize(a.id);
    expect(b.maximized).toBe(true);
    hud.togglePin(a.id);
    expect(b.pinned).toBe(true);
    expect(hud.covered(a)).toBe(false);
    hud.joinTabs(a.id, b.id); // already together
    hud.joinTabs(a.id, a.id);
    hud.joinTabs('nope', a.id);
    hud.activateTab('nope');
  });

  it('takes a tab out beside its window, and a window of one is no longer a group', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    hud.joinTabs(b.id, a.id);
    hud.detachTab(b.id);
    expect(a.group).toBeUndefined();
    expect(b.group).toBeUndefined();
    expect(b.rect.x).toBeGreaterThan(a.rect.x);
    hud.detachTab(b.id);
    hud.detachTab('nope');
  });

  it('keeps a group of three when one tab closes, with another in front', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    const c = hud.open({ kind: 'web', url: 'https://c/', title: 'c' });
    hud.joinTabs(b.id, a.id);
    hud.joinTabs(c.id, a.id);
    expect(hud.membersOf(a)).toHaveLength(3);
    hud.close(c.id);
    expect(hud.membersOf(a)).toHaveLength(2);
    expect(hud.visible).toHaveLength(1);
    hud.closeAll();
    expect(hud.widgets).toHaveLength(0);
  });

  it('merges a window that has tabs into another', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    const c = hud.open({ kind: 'web', url: 'https://c/', title: 'c' });
    hud.joinTabs(c.id, b.id);
    hud.joinTabs(b.id, a.id);
    expect(hud.membersOf(a)).toHaveLength(3);
  });

  it('opens a tab asked for again in front, and drops a deleted document’s tab', () => {
    const hud = store();
    const doc = hud.createDocument('D', 'x');
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const d = hud.openDocument(doc);
    hud.joinTabs(d.id, a.id);
    hud.activateTab(a.id);
    hud.openDocument(doc);
    expect(hud.isShown(d)).toBe(true);
    hud.deleteDocument(doc.id);
    expect(a.group).toBeUndefined();
  });
});

describe('arranging and renaming', () => {
  it('snaps and lays out the windows in view', () => {
    const hud = store();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    hud.snap(a.id, 'left');
    expect(a.rect).toEqual(snapRect('left', view));
    hud.organize();
    expect(a.rect.y).toBe(b.rect.y);
    expect(a.rect.x).not.toBe(b.rect.x);
  });

  it('renames a window, and a document with it', () => {
    const hud = store();
    const doc = hud.createDocument('Old', 'x');
    const w = hud.openDocument(doc);
    hud.rename(w.id, '  Informe final  ');
    expect(w.title).toBe('Informe final');
    expect(hud.documentById(doc.id)?.title).toBe('Informe final');
    hud.rename(w.id, '   ');
    expect(w.title).toBe('Informe final');
    hud.rename('nope', 'x');
  });
});

describe('the arrangement is kept', () => {
  it('comes back after a reload: screens, places and tabs, not the session’s windows', () => {
    const hud = store();
    const doc = hud.createDocument('D', 'x');
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const d = hud.openDocument(doc);
    hud.joinTabs(d.id, a.id);
    hud.open({ kind: 'task', taskId: 't', title: 'task' });
    const s2 = hud.addScreen('Dos')!;
    hud.open({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'v' });
    hud.saveLayout();

    setActivePinia(createPinia());
    const again = useHudStore();
    expect(again.screens.map((s) => s.name)).toEqual(['', 'Dos']);
    expect(again.activeScreen).toBe(s2.id);
    expect(again.widgets.map((w) => w.kind).sort()).toEqual(['document', 'video', 'web']);
    const web = again.widgets.find((w) => w.kind === 'web')!;
    expect(again.membersOf(web)).toHaveLength(2);
  });

  it('saves on its own, a moment after a change', async () => {
    vi.useFakeTimers();
    const hud = store();
    hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    await nextTick();
    vi.advanceTimersByTime(500);
    expect(localStorage.getItem('kwami-hud-layout')).toContain('https://a/');
  });

  it('drops what no longer holds: a deleted document, a lone tab, a broken save', () => {
    localStorage.setItem(
      'kwami-hud-layout',
      JSON.stringify({
        screens: [{ id: 'x', name: 'X' }, { nope: 1 }],
        active: 'gone',
        windows: [
          {
            id: 'w1',
            key: 'doc:gone',
            kind: 'document',
            docId: 'gone',
            screen: 'main',
            rect: { x: 1 },
          },
          {
            id: 'w2',
            key: 'url:a',
            kind: 'web',
            screen: 'main',
            group: 'g',
            rect: { x: 1, y: 1, w: 400, h: 300 },
            z: 3,
          },
          { id: 'w3', key: 'task:t', kind: 'task', screen: 'main', rect: { x: 1 } },
          { id: 'w4', key: 'url:b', kind: 'web', screen: 'elsewhere', rect: { x: 1 } },
        ],
      }),
    );
    const hud = useHudStore();
    expect(hud.screens.map((s) => s.id)).toEqual(['main', 'x']);
    expect(hud.activeScreen).toBe('main');
    expect(hud.widgets.map((w) => w.id)).toEqual(['w2']);
    expect(hud.widgets[0].group).toBeUndefined();

    setActivePinia(createPinia());
    localStorage.setItem('kwami-hud-layout', '{"screens": 3, "windows": "x"}');
    expect(useHudStore().screens.map((s) => s.id)).toEqual(['main']);
  });
});

describe('talking less with the agent', () => {
  function mountHud() {
    const Host = defineComponent({
      setup() {
        useHud();
        return () => h('div');
      },
    });
    return mount(Host, {
      global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } })] },
    });
  }

  function sent(): Record<string, unknown>[] {
    return calls.map((bytes) => JSON.parse(new TextDecoder().decode(bytes)));
  }

  const calls: Uint8Array[] = [];
  const listen = (e: Event) => calls.push((e as CustomEvent<Uint8Array>).detail);

  it('asks for frames only while someone looks at Jarvis’s browser', async () => {
    calls.length = 0;
    window.addEventListener('kwami:send_data', listen);
    const wrapper = mountHud();
    const hud = useHudStore();
    const nav = useNavigationStore();
    nav.updateState({ url: 'https://a.b' });
    window.dispatchEvent(new CustomEvent('kwami:browser_session', { detail: { action: 'open' } }));
    await nextTick();
    expect(sent()).toEqual([]);
    const browser = hud.byKey('browser')!;
    hud.minimize(browser.id);
    await nextTick();
    expect(sent().at(-1)).toEqual({ type: 'browser_frames', on: false });
    hud.restore(browser.id);
    await nextTick();
    expect(sent().at(-1)).toEqual({ type: 'browser_frames', on: true });

    hud.close(browser.id);
    hud.setPref('browser', false);
    await nextTick();
    calls.length = 0;
    window.dispatchEvent(new CustomEvent('kwami:browser_session', { detail: { action: 'open' } }));
    expect(sent()).toEqual([{ type: 'browser_frames', on: false }]);
    wrapper.unmount();
    window.removeEventListener('kwami:send_data', listen);
  });

  it('uses the report the agent split from what it said', () => {
    const wrapper = mountHud();
    const hud = useHudStore();
    const report = `# Informe\n\n${'x'.repeat(REPORT_CHARS)}`;
    window.dispatchEvent(
      new CustomEvent('kwami:agent_message', {
        detail: {
          type: 'brain_result',
          id: 't1-ab',
          result: `Hecho.\n\nDetalle:\n\n${report}`,
          spoken: 'Hecho.',
          report,
        },
      }),
    );
    expect(hud.documents[0].markdown).toBe(report);
    wrapper.unmount();
  });

  it('composes the document from the two parts', () => {
    expect(composeReport('Dicho.', '# Título\nTexto')).toBe('# Título\nTexto');
    expect(composeReport('Una.\nDos.', 'cuerpo')).toBe('> Una.\n> Dos.\n\ncuerpo');
    expect(composeReport('  ', ' cuerpo ')).toBe('cuerpo');
  });
});
