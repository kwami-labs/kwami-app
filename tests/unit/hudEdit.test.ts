/**
 * Full editing of Jarvis's screen, by hand and by voice: windows resize from any edge,
 * their edges line up as they come near, they take named sizes; what is worth looking
 * at takes centre stage at its size, Jarvis's figure moves aside to what is left, and
 * where the user puts a kind of window by hand is where the next one goes. Jarvis has
 * the same hands: move, resize, place, maximise, bring forward, pin, feature, and turn
 * edit mode on for the user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useHudAgentTools } from '@/composables/useHudAgentTools';
import { hudEn } from '@/i18n/hud.locale';
import {
  avatarSpot,
  fromShare,
  magnetRect,
  maximizedRect,
  MIN_HEIGHT,
  MIN_WIDTH,
  moveToZone,
  presetRect,
  resizeRect,
  snapZoneAt,
  stageRect,
  toShare,
  TOP_GUTTER,
  VIDEO_CHROME,
  type HudRect,
} from '@/lib/hud/layout';

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn() }),
}));

type Show = (args: Record<string, unknown>) => Record<string, unknown>;

const view = { width: 1600, height: 900 };
let show: Show;

const overlaps = (a: HudRect, b: HudRect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useHudStore().setViewport(view);
  const Host = defineComponent({
    setup() {
      show = useHudAgentTools().showOnScreen as Show;
      return () => h('div');
    },
  });
  mount(Host, {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } })] },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resizing by hand', () => {
  const box = { x: 400, y: 200, w: 500, h: 400 };

  it('moves only the edges it is pulled by', () => {
    expect(resizeRect(box, 'e', 60, 99, view)).toEqual({ x: 400, y: 200, w: 560, h: 400 });
    expect(resizeRect(box, 's', 99, 50, view)).toEqual({ x: 400, y: 200, w: 500, h: 450 });
    expect(resizeRect(box, 'w', -100, 0, view)).toEqual({ x: 300, y: 200, w: 600, h: 400 });
    expect(resizeRect(box, 'n', 0, 40, view)).toEqual({ x: 400, y: 240, w: 500, h: 360 });
    expect(resizeRect(box, 'nw', 20, 20, view)).toEqual({ x: 420, y: 220, w: 480, h: 380 });
    expect(resizeRect(box, 'se', 10, 10, view)).toEqual({ x: 400, y: 200, w: 510, h: 410 });
  });

  it('never makes a window smaller than one can be, nor leaves the screen', () => {
    const small = resizeRect(box, 'w', 2000, 0, view);
    expect(small.w).toBe(MIN_WIDTH);
    expect(small.x + small.w).toBe(box.x + box.w);
    expect(resizeRect(box, 'n', 0, 2000, view).h).toBe(MIN_HEIGHT);
    const whole = maximizedRect(view);
    expect(resizeRect(box, 'w', -5000, 0, view).x).toBe(whole.x);
    const wide = resizeRect(box, 'se', 5000, 5000, view);
    expect(wide.x + wide.w).toBe(whole.x + whole.w);
    expect(wide.y + wide.h).toBe(whole.y + whole.h);
  });

  it('draws edges to the screen and to other windows as they come near', () => {
    const whole = maximizedRect(view);
    const other = { x: 1000, y: 200, w: 300, h: 300 };
    // Moved within reach of the screen's left edge and of the other window's top.
    const moved = magnetRect({ x: whole.x + 6, y: 207, w: 300, h: 200 }, view, [other]);
    expect(moved.x).toBe(whole.x);
    expect(moved.y).toBe(200);
    // Its right edge comes to a gap before the other window.
    const beside = magnetRect({ x: 690, y: 600, w: 300, h: 100 }, view, [other]);
    expect(beside.x + beside.w).toBe(other.x - 8);
    // Far from everything, nothing moves.
    const free = { x: 500, y: 400, w: 200, h: 150 };
    expect(magnetRect(free, view, [other])).toEqual(free);
    // Resizing pulls only the edge being dragged.
    const grown = magnetRect({ x: 600, y: 300, w: 395, h: 100 }, view, [other], 'e');
    expect(grown).toEqual({ x: 600, y: 300, w: 392, h: 100 });
  });

  it('snaps to an edge only when the drag went toward it', () => {
    // A window at the top, held by its header, dragged sideways: no snap to the top.
    expect(snapZoneAt(800, TOP_GUTTER + 20, view, { dx: 500, dy: 2 })).toBeNull();
    expect(snapZoneAt(800, TOP_GUTTER + 4, view, { dx: 0, dy: -60 })).toBe('top');
    // Toward the left edge it snaps left; held near it but dragged away, it does not.
    expect(snapZoneAt(10, 400, view, { dx: -300, dy: 0 })).toBe('left');
    expect(snapZoneAt(10, 400, view, { dx: 2, dy: 300 })).toBeNull();
    expect(snapZoneAt(10, TOP_GUTTER + 4, view, { dx: -300, dy: -100 })).toBe('topLeft');
  });

  it('brings a window to a named size, a video at 16:9, kept where it was', () => {
    const r = { x: 600, y: 300, w: 400, h: 300 };
    const video = presetRect(r, 'medium', 'video', view);
    expect(video.h - VIDEO_CHROME).toBeCloseTo((video.w * 9) / 16, -1);
    expect(Math.abs(video.x + video.w / 2 - (r.x + r.w / 2))).toBeLessThan(2);
    const small = presetRect(r, 'small', 'document', view);
    const large = presetRect(r, 'large', 'document', view);
    expect(large.w).toBeGreaterThan(small.w);
    expect(large.h).toBeGreaterThan(small.h);
    expect(large.h).toBeLessThanOrEqual(maximizedRect(view).h);
  });

  it('sends a window to a side, a corner or the middle without changing its size', () => {
    const whole = maximizedRect(view);
    const r = { x: 600, y: 300, w: 400, h: 300 };
    expect(moveToZone(r, 'topLeft', view)).toEqual({ x: whole.x, y: whole.y, w: 400, h: 300 });
    const right = moveToZone(r, 'right', view);
    expect(right.x + right.w).toBe(whole.x + whole.w);
    const centre = moveToZone(r, 'center', view);
    expect(Math.round(centre.x + 200)).toBe(Math.round(whole.x + whole.w / 2));
  });

  it('keeps a place as shares of the screen, so it holds at another size', () => {
    const r = { x: 800, y: 200, w: 500, h: 400 };
    expect(fromShare(toShare(r, view), view)).toEqual(r);
    const bigger = { width: 2400, height: 1300 };
    const there = fromShare(toShare(r, view), bigger);
    expect(there.w).toBeGreaterThan(r.w);
    expect(there.x).toBeGreaterThan(r.x);
  });
});

describe('centre stage', () => {
  it('gives a video 16:9 and a report the full height, on the right', () => {
    const whole = maximizedRect(view);
    const video = stageRect('video', view)!;
    expect(video.h - VIDEO_CHROME).toBeCloseTo((video.w * 9) / 16, -1);
    expect(video.x + video.w).toBe(whole.x + whole.w);
    const report = stageRect('document', view)!;
    expect(report.h).toBe(whole.h);
    expect(report.w).toBeLessThanOrEqual(900);
  });

  it('is no stage on a narrow screen or beside a big window of the user', () => {
    expect(stageRect('video', { width: 900, height: 700 })).toBeNull();
    const half = { x: 16, y: 64, w: 776, h: 760 };
    expect(stageRect('video', view, [half])).toBeNull();
  });

  it('opens what is worth looking at centre stage, with the rest beside it', () => {
    const hud = useHudStore();
    const task = hud.open({ kind: 'task', taskId: 't', title: 'task' });
    const video = hud.open({ kind: 'video', url: 'https://youtu.be/x', title: 'clip' });
    expect(hud.stageId).toBe(video.id);
    expect(video.rect).toEqual(stageRect('video', view));
    expect(overlaps(task.rect, video.rect)).toBe(false);
    // A report after it takes the stage; the video goes to the column.
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'report' });
    expect(hud.stageId).toBe(doc.id);
    expect(doc.rect.h).toBe(maximizedRect(view).h);
    for (const w of hud.visible.filter((v) => v !== doc)) {
      expect(overlaps(w.rect, doc.rect)).toBe(false);
    }
  });

  it('features a window on request, even one the user had moved or folded', () => {
    const hud = useHudStore();
    const page = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    hud.setRect(page.id, { x: 200, y: 100, w: 300, h: 200 }, true);
    hud.minimize(page.id);
    hud.feature(page.id);
    expect(page.minimized).toBe(false);
    expect(page.manual).toBe(false);
    expect(hud.stageId).toBe(page.id);
    expect(page.rect.w).toBeGreaterThan(600);
  });
});

describe('Jarvis’s figure moves aside', () => {
  const figure = { w: 720, h: 720 };

  it('sits in the middle of the free band with nothing open', () => {
    const spot = avatarSpot({ ...view, left: 400 }, [], figure);
    expect(spot.x).toBe(400 + 1200 / 2);
    expect(spot.y).toBe(450);
    expect(spot.scale).toBe(1);
  });

  it('goes to the part no window covers, shrunk to fit it', () => {
    const stage = stageRect('video', view)!;
    const spot = avatarSpot(view, [stage], figure);
    expect(spot.x).toBeLessThan(stage.x);
    expect(spot.scale).toBeLessThan(1);
    expect(spot.scale).toBeGreaterThan(0.22);
    const half = (figure.w * spot.scale) / 2;
    expect(spot.x + half).toBeLessThanOrEqual(stage.x);
  });

  it('stays in the middle, behind, when the windows leave no room', () => {
    const whole = maximizedRect(view);
    const spot = avatarSpot(view, [{ x: 0, y: 0, w: view.width, h: view.height }], figure);
    expect(spot.x).toBe(view.width / 2);
    expect(whole.w).toBeGreaterThan(0);
  });

  it('follows the windows in the store, and stays put when switched off', () => {
    const hud = useHudStore();
    const centre = { ...hud.avatar };
    hud.open({ kind: 'video', url: 'https://youtu.be/x', title: 'clip' });
    expect(hud.avatar.x).toBeLessThan(centre.x);
    hud.setPref('moveAside', false);
    expect(hud.avatar).toEqual({ x: view.width / 2, y: view.height / 2, scale: 1 });
  });
});

describe('learning where the user likes things', () => {
  it('opens the next of a kind where the user last put one', () => {
    const hud = useHudStore();
    const first = hud.open({ kind: 'video', url: 'https://youtu.be/a', title: 'a' });
    const corner = { x: 40, y: 500, w: 520, h: 330 };
    hud.setRect(first.id, corner, true);
    hud.learnPlacement(first.id);
    hud.close(first.id);
    const next = hud.open({ kind: 'video', url: 'https://youtu.be/b', title: 'b' });
    expect(next.rect).toEqual(fromShare(toShare(corner, view), view));
    // Kept for next time, and forgotten on request.
    expect(JSON.parse(localStorage.getItem('kwami-hud-learned') ?? '{}').video).toBeTruthy();
    hud.forgetPlacement('video');
    expect(hud.learned.video).toBeUndefined();
  });

  it('does not learn tasks, which stack in their column', () => {
    const hud = useHudStore();
    const task = hud.open({ kind: 'task', taskId: 't', title: 't' });
    hud.setRect(task.id, { x: 900, y: 300, w: 300, h: 300 }, true);
    hud.learnPlacement(task.id);
    expect(hud.learned.task).toBeUndefined();
  });
});

describe('the screen grows', () => {
  it('lays Jarvis’s windows out again for the new size, once it settles', () => {
    vi.useFakeTimers();
    const hud = useHudStore();
    hud.setViewport({ width: 800, height: 600 });
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'd' });
    const small = { ...doc.rect };
    hud.setViewport({ width: 1920, height: 1017 });
    expect(doc.rect).toEqual(small);
    vi.advanceTimersByTime(300);
    expect(doc.rect.w).toBeGreaterThan(small.w);
    expect(doc.rect.h).toBeGreaterThan(small.h);
  });

  it('leaves what the user placed where it is', () => {
    vi.useFakeTimers();
    const hud = useHudStore();
    const mine = hud.open({ kind: 'web', url: 'https://a/', title: 'a', source: 'user' });
    hud.setRect(mine.id, { x: 100, y: 100, w: 400, h: 300 }, true);
    hud.open({ kind: 'task', taskId: 't', title: 't' });
    hud.setViewport({ width: 1920, height: 1017 });
    vi.advanceTimersByTime(300);
    expect(mine.rect).toEqual({ x: 100, y: 100, w: 400, h: 300 });
  });
});

describe('Jarvis arranges by voice with the user’s own hands', () => {
  it('moves, resizes and places a window, in percent of the screen', () => {
    const hud = useHudStore();
    const doc = hud.open({ kind: 'document', docId: 'd', title: 'Informe', source: 'user' });
    const whole = maximizedRect(view);
    expect(show({ action: 'move', id: 'informe', zone: 'topLeft' })).toMatchObject({
      success: true,
    });
    expect(doc.rect.x).toBe(whole.x);
    expect(doc.rect.y).toBe(whole.y);
    expect(doc.manual).toBe(true);
    show({ action: 'move', id: doc.id, x: 25, y: 0 });
    expect(doc.rect.x).toBe(Math.round(whole.x + whole.w / 4));
    const res = show({ action: 'resize', id: doc.id, w: 25, h: 50 });
    expect(res).toMatchObject({ success: true, place: { w: 25, h: 50 } });
    show({ action: 'resize', id: doc.id, size: 'large' });
    expect(doc.rect.w).toBe(Math.round(whole.w * 0.72));
    show({ action: 'place', id: doc.id, x: 10, y: 10, w: 40, h: 60 });
    expect(toShare(doc.rect, view)).toMatchObject({ x: 0.1, y: 0.1, w: 0.4, h: 0.6 });
    expect(show({ action: 'move', id: doc.id })).toMatchObject({ success: false });
    expect(show({ action: 'resize', id: doc.id })).toMatchObject({ success: false });
    expect(show({ action: 'place', id: doc.id })).toMatchObject({ success: false });
  });

  it('keeps a video at 16:9 whatever height it is given', () => {
    const hud = useHudStore();
    const video = hud.open({ kind: 'video', url: 'https://youtu.be/x', title: 'clip' });
    show({ action: 'place', id: 'clip', x: 75, y: 2, w: 22, h: 20 });
    const picture = video.rect.h - VIDEO_CHROME;
    expect(picture).toBeCloseTo((video.rect.w * 9) / 16, -1);
    show({ action: 'resize', id: 'clip', h: 60 });
    expect(video.rect.h - VIDEO_CHROME).toBeCloseTo((video.rect.w * 9) / 16, -1);
    expect(video.rect.h).toBeGreaterThan(picture);
  });

  it('maximises, restores, brings forward, pins and features', () => {
    const hud = useHudStore();
    const a = hud.open({ kind: 'web', url: 'https://a/', title: 'alpha', source: 'user' });
    const b = hud.open({ kind: 'web', url: 'https://b/', title: 'beta', source: 'user' });
    show({ action: 'maximize', id: 'alpha' });
    expect(a.maximized).toBe(true);
    show({ action: 'restore', id: 'alpha' });
    expect(a.maximized).toBe(false);
    show({ action: 'focus', id: 'beta' });
    expect(hud.focusedId).toBe(b.id);
    hud.minimize(a.id);
    show({ action: 'focus', id: 'alpha' });
    expect(a.minimized).toBe(false);
    show({ action: 'pin', id: 'alpha' });
    expect(a.pinned).toBe(true);
    show({ action: 'pin', id: 'alpha' });
    expect(a.pinned).toBe(true);
    show({ action: 'unpin', id: 'alpha' });
    expect(a.pinned).toBe(false);
    show({ action: 'feature', id: 'beta' });
    expect(hud.stageId).toBe(b.id);
  });

  it('turns edit mode on and off for the user', () => {
    const hud = useHudStore();
    show({ action: 'edit_mode', on: true });
    expect(hud.editing).toBe(true);
    // Native web views step aside while editing.
    expect(hud.nativeHidden).toBe(1);
    show({ action: 'edit_mode', on: false });
    expect(hud.editing).toBe(false);
    expect(hud.nativeHidden).toBe(0);
    show({ action: 'edit_mode' });
    expect(hud.editing).toBe(true);
  });

  it('says where everything is, where its figure is and what the user likes', () => {
    const hud = useHudStore();
    const video = hud.open({ kind: 'video', url: 'https://youtu.be/x', title: 'clip' });
    hud.setRect(video.id, { x: 100, y: 100, w: 640, h: 464 }, true);
    hud.learnPlacement(video.id);
    const listed = show({ action: 'list' }) as {
      windows: { place?: object; placedByHand?: boolean }[];
      figure: { x: number; y: number; size: number };
      likedPlaces: Record<string, object>;
      editing: boolean;
    };
    expect(listed.windows[0].place).toEqual({ x: 5, y: 5, w: 41, h: 61 });
    expect(listed.windows[0].placedByHand).toBe(true);
    expect(listed.figure.size).toBeGreaterThan(0);
    expect(listed.likedPlaces.video).toEqual({ x: 5, y: 5, w: 41, h: 61 });
    expect(listed.editing).toBe(false);
  });
});
