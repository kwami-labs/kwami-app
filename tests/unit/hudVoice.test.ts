/**
 * Jarvis runs its own screen by voice, as it works: it opens, folds, brings back,
 * closes, snaps, gathers tabs, moves windows between screens and makes screens, and
 * keeps what it opens out of the way (columns at the sides, the core in view), never
 * moving what the user placed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useHudAgentTools } from '@/composables/useHudAgentTools';
import { hudEn } from '@/i18n/hud.locale';
import { gridShape, sideColumns, snapRect, tileRects } from '@/lib/hud/layout';

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn() }),
}));

type Show = (args: Record<string, unknown>) => Record<string, unknown>;

const view = { width: 1600, height: 900 };
let show: Show;
let tools: ReturnType<typeof useHudAgentTools>;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useHudStore().setViewport(view);
  const Host = defineComponent({
    setup() {
      tools = useHudAgentTools();
      show = tools.showOnScreen as Show;
      return () => h('div');
    },
  });
  mount(Host, {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } })] },
  });
});

describe('out of the way', () => {
  it('puts tasks on the left, the rest on the right, the core clear', () => {
    const { left, right } = sideColumns(2, 3, view);
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(3);
    expect(left[0].x).toBe(16);
    expect(right[0].x + right[0].w).toBe(view.width - 16);
    expect(left[0].x + left[0].w).toBeLessThan(view.width / 2 - 100);
    expect(right[1].y).toBeGreaterThan(right[0].y);
    expect(sideColumns(0, 0, view)).toEqual({ left: [], right: [] });
  });

  it('stacks everything in one column on a narrow screen', () => {
    const narrow = { width: 900, height: 700 };
    const { left, right } = sideColumns(1, 1, narrow);
    expect(left[0].x).toBe(right[0].x);
    expect(right[0].y).toBeGreaterThan(left[0].y);
  });

  it('tidies what Jarvis opens, folds its oldest past three, and leaves the user’s', () => {
    const hud = useHudStore();
    const mine = hud.open({ kind: 'web', url: 'https://user/', title: 'mine', source: 'user' });
    hud.setRect(mine.id, { x: 600, y: 200, w: 400, h: 300 }, true);
    const task = hud.open({ kind: 'task', taskId: 't', title: 'task' });
    const docs = [1, 2, 3, 4].map((n) =>
      hud.open({ kind: 'document', docId: `d${n}`, title: `d${n}` }),
    );
    expect(mine.rect.x).toBe(600);
    expect(task.rect.x).toBe(16);
    expect(docs[3].rect.x).toBeGreaterThan(view.width / 2);
    expect(docs[0].minimized).toBe(true);
    expect(docs.slice(1).every((d) => !d.minimized)).toBe(true);
  });

  it('leaves everything where it is when the user turns it off', () => {
    const hud = useHudStore();
    hud.setPref('autoArrange', false);
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    expect(doc.rect.x).toBeLessThan(view.width / 2);
  });

  it('marks what the user drags or snaps as theirs', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    expect(a.manual).toBeFalsy();
    hud.snap(a.id, 'left');
    expect(a.manual).toBe(true);
  });
});

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('never over the user’s windows', () => {
  it('puts its columns beside a window the user placed', () => {
    const hud = useHudStore();
    const mine = hud.open({ kind: 'web', url: 'https://user/', title: 'mine', source: 'user' });
    hud.setRect(mine.id, { x: 900, y: 64, w: 680, h: 760 }, true);
    const task = hud.open({ kind: 'task', taskId: 't', title: 'task' });
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    expect(overlaps(task.rect, mine.rect)).toBe(false);
    expect(overlaps(doc.rect, mine.rect)).toBe(false);
    expect(task.rect.x).toBeLessThan(doc.rect.x);
  });

  it('shares one stretch between both columns, or stacks them in a narrow one', () => {
    const hud = useHudStore();
    const mine = hud.open({ kind: 'web', url: 'https://user/', title: 'mine', source: 'user' });
    hud.snap(mine.id, 'left');
    const task = hud.open({ kind: 'task', taskId: 't', title: 'task' });
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    for (const w of [task, doc]) expect(overlaps(w.rect, mine.rect)).toBe(false);
    expect(task.rect.y).toBe(doc.rect.y);
    hud.setViewport({ width: 1000, height: 900 });
    hud.snap(mine.id, 'left');
    hud.tidy();
    expect(task.rect.x).toBe(doc.rect.x);
    expect(doc.rect.y).toBeGreaterThan(task.rect.y);
    for (const w of [task, doc]) expect(overlaps(w.rect, mine.rect)).toBe(false);
  });

  it('with no room left, folds its older windows and shows the new one where it hides least', () => {
    const hud = useHudStore();
    const mine = hud.open({ kind: 'web', url: 'https://user/', title: 'mine', source: 'user' });
    hud.snap(mine.id, 'left');
    const other = hud.open({ kind: 'web', url: 'https://other/', title: 'o', source: 'user' });
    hud.snap(other.id, 'bottomRight');
    const old = hud.open({ kind: 'document', docId: 'old', title: 'old' });
    const task = hud.open({ kind: 'task', taskId: 't', title: 'task', background: true });
    expect(task.minimized).toBe(true);
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    expect(old.minimized).toBe(true);
    expect(doc.minimized).toBe(false);
    expect(overlaps(doc.rect, mine.rect)).toBe(false);
    expect(overlaps(doc.rect, other.rect)).toBe(false);
    expect(mine.rect).toEqual(snapRect('left', view));
  });

  it('keeps a column short enough that its windows never overlap', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 1600, height: 560 });
    // The newest takes centre stage; two fit in the column beside it at this height.
    const docs = [1, 2, 3, 4].map((n) =>
      hud.open({ kind: 'document', docId: `d${n}`, title: `d${n}` }),
    );
    expect(hud.stageId).toBe(docs[3].id);
    expect(docs[0].minimized).toBe(true);
    const shown = docs.filter((d) => !d.minimized);
    expect(shown).toHaveLength(3);
    shown.forEach((a, i) =>
      shown.slice(i + 1).forEach((b) => expect(overlaps(a.rect, b.rect)).toBe(false)),
    );
  });
});

describe('a screen laid out as a grid stays one', () => {
  it('gives what opens its own cell, and closes up when a window goes', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b', source: 'user' });
    hud.organize();
    expect(hud.tiled).toBe(true);
    expect(a.manual).toBeFalsy();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    const cells = [a, b, doc].map((w) => w.rect);
    expect(cells).toEqual(tileRects(3, view));
    hud.minimize(doc.id);
    expect([a.rect, b.rect]).toEqual(tileRects(2, view));
    hud.restore(doc.id);
    expect(doc.rect).toEqual(tileRects(3, view)[2]);
    hud.close(doc.id);
    expect([a.rect, b.rect]).toEqual(tileRects(2, view));
  });

  it('folds Jarvis’s least used windows when the cells run out', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 800, height: 600 });
    const { cols, rows } = gridShape(hud.viewport);
    hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    hud.organize();
    const docs = Array.from({ length: cols * rows }, (_, i) =>
      hud.open({ kind: 'document', docId: `d${i}`, title: `d${i}` }),
    );
    expect(docs[0].minimized).toBe(true);
    expect(hud.visible).toHaveLength(cols * rows);
    for (const [i, w] of hud.visible.entries()) {
      for (const other of hud.visible.slice(i + 1))
        expect(overlaps(w.rect, other.rect)).toBe(false);
    }
  });

  it('follows the screen’s size, and the grid moves to tabs and screens', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b', source: 'user' });
    hud.organize();
    hud.setViewport({ width: 1200, height: 800 });
    expect([a.rect, b.rect]).toEqual(tileRects(2, hud.viewport));
    hud.joinTabs(b.id, a.id);
    expect(b.rect).toEqual(tileRects(1, hud.viewport)[0]);
    hud.detachTab(b.id);
    expect([a.rect, b.rect]).toEqual(tileRects(2, hud.viewport));
    hud.addScreen('Otra');
    hud.moveToScreen(b.id, hud.activeScreen);
    hud.switchScreen('main');
    expect(a.rect).toEqual(tileRects(1, hud.viewport)[0]);
  });

  it('ends when the user moves a window, keeping the rest where it was', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b', source: 'user' });
    hud.organize();
    const bWas = { ...b.rect };
    hud.setRect(a.id, { ...a.rect, x: a.rect.x + 40 }, true);
    expect(hud.tiled).toBe(false);
    expect(b.manual).toBe(true);
    hud.open({ kind: 'document', docId: 'd', title: 'd' });
    expect(b.rect).toEqual(bWas);
  });

  it('ends from the dock or by voice, and tidy then takes Jarvis’s windows to the sides', () => {
    const hud = useHudStore();
    hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    hud.organize();
    hud.leaveGrid(hud.activeScreen, true);
    expect(hud.tiled).toBe(false);
    expect(doc.manual).toBe(true);
    hud.organize();
    expect(show({ action: 'tidy' })).toMatchObject({ success: true });
    expect(hud.tiled).toBe(false);
    expect(doc.rect.x + doc.rect.w).toBe(view.width - 16);
    hud.leaveGrid();
    hud.leaveGrid('nowhere');
  });
});

describe('by voice', () => {
  it('opens and lists, with screens and state', () => {
    const hud = useHudStore();
    expect(show({ kind: 'document', content: '# Plan\n\nx' })).toMatchObject({ success: true });
    show({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' });
    const listed = show({ action: 'list' }) as {
      windows: { state: string; title: string }[];
      screens: string[];
    };
    expect(listed.screens).toEqual(['Screen 1']);
    expect(listed.windows.map((w) => w.state)).toEqual(['shown', 'shown']);
    const video = hud.widgets.find((w) => w.kind === 'video')!;
    hud.minimize(video.id);
    expect((show({ action: 'list' }) as { windows: { state: string }[] }).windows[1].state).toBe(
      'folded',
    );
  });

  it('finds a window by id, by words of its title, or by its kind as said aloud', () => {
    const hud = useHudStore();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'Informe del oro' });
    const vid = hud.open({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Tráiler' });
    expect(tools.findWindow(doc.id)).toBe(doc);
    expect(tools.findWindow('ORO')).toBe(doc);
    expect(tools.findWindow('el vídeo')).toBe(vid);
    expect(tools.findWindow('trailer')).toBe(vid);
    expect(tools.findWindow('nada de esto')).toBeUndefined();
    expect(tools.findWindow('  ')).toBeUndefined();
  });

  it('folds, brings back, snaps, renames and closes', () => {
    const hud = useHudStore();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'Informe', source: 'user' });
    expect(show({ action: 'minimize', id: 'informe' })).toMatchObject({ success: true });
    expect(doc.minimized).toBe(true);
    show({ action: 'restore', id: 'informe' });
    expect(doc.minimized).toBe(false);
    show({ action: 'snap', id: doc.id, zone: 'left' });
    expect(doc.rect.x).toBe(16);
    show({ action: 'snap', id: doc.id, zone: 'nowhere' });
    expect(doc.rect.x).toBeGreaterThan(view.width / 2 - 20);
    expect(show({ action: 'rename', id: doc.id })).toMatchObject({ success: false });
    show({ action: 'rename', id: doc.id, name: 'Plan' });
    expect(doc.title).toBe('Plan');
    show({ action: 'close', id: 'plan' });
    expect(hud.widgets).toHaveLength(0);
    expect(show({ action: 'close', id: 'plan' })).toMatchObject({ success: false });
    expect(show({ action: 'fly', id: 'x' })).toMatchObject({ success: false });
  });

  it('brings back a window from another screen or from behind a tab', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'b', source: 'user' });
    show({ action: 'tab_with', id: b.id, with: a.id });
    expect(hud.membersOf(a)).toHaveLength(2);
    expect(show({ action: 'tab_with', id: b.id, with: 'nothing' })).toMatchObject({
      success: false,
    });
    show({ action: 'restore', id: a.id });
    expect(hud.isShown(a)).toBe(true);
    show({ action: 'detach', id: b.id });
    expect(b.group).toBeUndefined();
    hud.addScreen('Otra');
    show({ action: 'restore', id: a.id });
    expect(hud.activeScreen).toBe('main');
  });

  it('makes, names, switches, moves to and removes screens', () => {
    const hud = useHudStore();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'doc', source: 'user' });
    expect(show({ action: 'new_screen', name: 'Medios' })).toMatchObject({ success: true });
    expect(show({ action: 'switch_screen', screen: '1' })).toMatchObject({ success: true });
    expect(hud.activeScreen).toBe('main');
    show({ action: 'move_to_screen', id: 'doc', screen: 'medios' });
    expect(doc.screen).toBe(hud.screens[1].id);
    show({ action: 'move_to_screen', id: 'doc', screen: 'Investigación' });
    expect(hud.screens.map((s) => s.name)).toContain('Investigación');
    show({ action: 'switch_screen', screen: hud.screens[1].id });
    show({ action: 'rename_screen', name: 'Vídeos' });
    expect(hud.screens[1].name).toBe('Vídeos');
    expect(show({ action: 'switch_screen', screen: 'ninguna' })).toMatchObject({ success: false });
    expect(show({ action: 'switch_screen' })).toMatchObject({ success: false });
    show({ action: 'remove_screen', screen: 'vídeos' });
    expect(hud.screens).toHaveLength(2);
    for (let i = 0; i < 10; i++) show({ action: 'new_screen' });
    expect(show({ action: 'new_screen' })).toMatchObject({ success: false });
    expect(show({ action: 'move_to_screen', id: 'doc', screen: 'una más' })).toMatchObject({
      success: false,
    });
  });

  it('lays out, tidies and closes everything', () => {
    const hud = useHudStore();
    hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    hud.open({ kind: 'web', url: 'https://b/', title: 'b', source: 'user' });
    expect(show({ action: 'organize' })).toMatchObject({ success: true });
    expect(show({ action: 'tidy' })).toMatchObject({ success: true });
    show({ action: 'close_all' });
    expect(hud.widgets).toHaveLength(0);
  });

  it('says why it cannot open', () => {
    expect(show({ kind: 'document', content: '' })).toMatchObject({ success: false });
    expect(show({ kind: 'web', url: 'javascript:x' })).toMatchObject({ success: false });
    useHudStore().setPref('enabled', false);
    expect(show({ url: 'https://a.b' })).toMatchObject({ success: false });
  });
});
