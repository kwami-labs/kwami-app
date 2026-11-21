import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  avatarSpot,
  clampRect,
  freeRect,
  fromShare,
  gridShape,
  isFeatured,
  leastCovering,
  maximizedRect,
  placeRect,
  presetRect,
  sideSlots,
  snapRect,
  stackRects,
  stageRect,
  tileRects,
  toShare,
  type AvatarSpot,
  type HudKind,
  type HudRect,
  type ShareRect,
  type SizePreset,
  type SnapZone,
  type Viewport,
} from '@/lib/hud/layout';

/**
 * Jarvis's HUD: the windows it opens on its own screen as it works.
 *
 * Every action has a place here: a task shows its live log, a report opens as a
 * document the user can edit, a video plays in the player, a page opens in the web
 * view, and Jarvis's Chrome is mirrored as it browses. Windows are deduplicated by a
 * key (`task:<id>`, `doc:<id>`, `url:<address>`, `browser`), so the same thing asked
 * for twice comes forward instead of opening again.
 *
 * The user arranges it as they like: several screens to switch between, windows
 * gathered as tabs of one window, snapped to halves and quarters, tiled, renamed,
 * more or less see-through. Documents and that arrangement are kept (localStorage,
 * per device); windows of the session (tasks, Jarvis's browser) are not.
 */

export type { HudKind, HudRect, SizePreset, SnapZone } from '@/lib/hud/layout';

export interface HudWidget {
  id: string;
  key: string;
  kind: HudKind;
  title: string;
  rect: HudRect;
  z: number;
  minimized: boolean;
  maximized: boolean;
  pinned: boolean;
  createdAt: number;
  /** Who opened it: Jarvis on its own, or the user clicking something. */
  source: 'agent' | 'user';
  /** The screen it is on (`HudScreen.id`). */
  screen: string;
  /** Windows that share a group are the tabs of one window. */
  group?: string;
  /** Placed by the user (dragged, resized, snapped): Jarvis's tidying leaves it be. */
  manual?: boolean;
  url?: string;
  docId?: string;
  taskId?: string;
  /** Seconds into a video to start at. */
  start?: number;
}

export interface HudScreen {
  id: string;
  name: string;
  /**
   * Laid out as a grid, and kept one: a window that opens, closes, folds or comes back
   * takes or leaves a cell, so none ever covers another. Moving a window by hand ends it.
   */
  tiled?: boolean;
}

export interface HudDocument {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
  taskId?: string;
  url?: string;
}

export type HudActionPhase = 'running' | 'done' | 'error' | 'cancelled';

export interface HudAction {
  id: string;
  name: string;
  detail: string;
  phase: HudActionPhase;
  startedAt: number;
  endedAt?: number;
  /** The tool's own progress report, when it sent one. */
  update?: string;
}

export interface OpenSpec {
  kind: HudKind;
  key?: string;
  title: string;
  url?: string;
  docId?: string;
  taskId?: string;
  start?: number;
  source?: 'agent' | 'user';
  /** Open without taking the front: a task Jarvis started while the user reads. */
  background?: boolean;
}

export interface HudPrefs {
  /** The HUD at all. Off, Jarvis still works; nothing opens on screen by itself. */
  enabled: boolean;
  /** Open a window for each task Jarvis starts. */
  tasks: boolean;
  /** Open the full report when a task finishes with one. */
  reports: boolean;
  /** Mirror Jarvis's Chrome while it browses. */
  browser: boolean;
  /** Links clicked in the app open here instead of the system browser. */
  links: boolean;
  /** The action log down the side. */
  actionLog: boolean;
  /** The lines that tie each window to the core. */
  tethers: boolean;
  /** How solid the windows' glass is, 0.4 (see-through) to 1. */
  glass: number;
  /** Jarvis keeps what it opens tidy: columns at the sides, the core in view. */
  autoArrange: boolean;
  /** Jarvis's own figure moves aside, and shrinks, to the part no window covers. */
  moveAside: boolean;
}

const DOCS_KEY = 'kwami-hud-documents';
const PREFS_KEY = 'kwami-hud-prefs';
const LAYOUT_KEY = 'kwami-hud-layout';
const LEARNED_KEY = 'kwami-hud-learned';
/** A change of the HUD's size, in pixels, worth laying Jarvis's windows out again for. */
const RELAYOUT_STEP = 48;
const MAX_DOCUMENTS = 60;
const MAX_ACTIONS = 40;
const MAX_SCREENS = 9;
/** Windows on screen at once before the oldest of Jarvis's own get folded into the dock. */
const MAX_OPEN = 6;
/** Windows that are worth reopening after a reload; tasks and the browser belong to a call. */
const KEPT_KINDS: readonly HudKind[] = ['document', 'web', 'video', 'image'];

const DEFAULT_PREFS: HudPrefs = {
  enabled: true,
  tasks: true,
  reports: true,
  browser: true,
  links: true,
  actionLog: true,
  tethers: true,
  glass: 0.82,
  autoArrange: true,
  moveAside: true,
};
/** Windows per side column before Jarvis folds the oldest of its own into the dock. */
const PER_COLUMN = 3;

const FIRST_SCREEN: HudScreen = { id: 'main', name: '' };

interface SavedLayout {
  screens: HudScreen[];
  active: string;
  windows: HudWidget[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the HUD keeps working from memory.
  }
}

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function fallbackViewport(): Viewport {
  if (typeof window === 'undefined') return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/** A saved layout, checked: anything malformed is dropped rather than trusted. */
function readLayout(): SavedLayout {
  const saved = readJson<Partial<SavedLayout>>(LAYOUT_KEY, {});
  const screens = (Array.isArray(saved.screens) ? saved.screens : []).filter(
    (s): s is HudScreen => typeof s?.id === 'string' && typeof s?.name === 'string',
  );
  if (!screens.some((s) => s.id === FIRST_SCREEN.id)) screens.unshift({ ...FIRST_SCREEN });
  const ids = new Set(screens.map((s) => s.id));
  const windows = (Array.isArray(saved.windows) ? saved.windows : []).filter(
    (w): w is HudWidget =>
      typeof w?.id === 'string' &&
      typeof w?.key === 'string' &&
      KEPT_KINDS.includes(w?.kind) &&
      ids.has(w?.screen) &&
      typeof w?.rect?.x === 'number',
  );
  const active = typeof saved.active === 'string' && ids.has(saved.active) ? saved.active : 'main';
  return { screens, active, windows };
}

export const useHudStore = defineStore('hud', () => {
  const layout = readLayout();
  const widgets = ref<HudWidget[]>(layout.windows);
  const screens = ref<HudScreen[]>(layout.screens);
  const activeScreen = ref<string>(layout.active);
  /** Which tab of each group is in front. */
  const activeTabs = ref<Record<string, string>>({});
  const documents = ref<HudDocument[]>(readJson<HudDocument[]>(DOCS_KEY, []));
  // A saved window whose document was deleted meanwhile has nothing to show.
  widgets.value = widgets.value.filter(
    (w) => w.kind !== 'document' || documents.value.some((d) => d.id === w.docId),
  );
  const actions = ref<HudAction[]>([]);
  const prefs = ref<HudPrefs>({ ...DEFAULT_PREFS, ...readJson<Partial<HudPrefs>>(PREFS_KEY, {}) });
  /** The full answer of each finished task, for its report (brain_status carries the start). */
  const taskResults = ref<Record<string, { result: string; sources: string[]; title: string }>>({});
  const viewport = ref<Viewport>(fallbackViewport());
  const focusedId = ref<string | null>(null);
  /**
   * Native web views sit above every HTML element, menus included. While anything
   * that floats (a dock menu, a window being dragged) is up, they step aside.
   */
  const nativeHidden = ref(0);
  /** Where the sidebar's panel floats over the HUD (its own coordinates), if it does. */
  const cover = ref<HudRect | null>(null);
  /** What Jarvis's own browser is doing with sign-ins: the clean window and after. */
  const browserSignIn = ref<{ state: 'idle' | 'open' | 'done'; url: string }>({
    state: 'idle',
    url: '',
  });
  /** While a window is dragged: where it would snap, and the window it would join as a tab. */
  const snapPreview = ref<HudRect | null>(null);
  const dropTarget = ref<string | null>(null);
  /**
   * Arranging by hand: every window shows its handles and big controls, and can be
   * dragged from anywhere. The native web views step aside meanwhile.
   */
  const editing = ref(false);
  /** Windows being dragged or resized right now: frames stop taking the pointer. */
  const manipulating = ref(0);
  /** The window on centre stage: what Jarvis opened to be looked at, shown at its size. */
  const stageId = ref<string | null>(null);
  /**
   * Where the user likes each kind of window, learnt from where they last put one by
   * hand (in shares of the screen): the next one Jarvis opens goes there.
   */
  const learned = ref<Partial<Record<HudKind, ShareRect>>>(
    readJson<Partial<Record<HudKind, ShareRect>>>(LEARNED_KEY, {}),
  );
  let topZ = Math.max(10, ...layout.windows.map((w) => w.z));

  // Tabs come back as they were; a group left with one window is just that window.
  for (const widget of widgets.value) {
    if (!widget.group) continue;
    if (widgets.value.filter((w) => w.group === widget.group).length < 2) widget.group = undefined;
    else activeTabs.value[widget.group] ??= widget.id;
  }

  // -- what is where -----------------------------------------------------------------

  function byId(id: string): HudWidget | undefined {
    return widgets.value.find((w) => w.id === id);
  }

  function byKey(key: string): HudWidget | undefined {
    return widgets.value.find((w) => w.key === key);
  }

  /** The tabs a window shares its frame with, itself included, in the order they joined. */
  function membersOf(widget: HudWidget): HudWidget[] {
    if (!widget.group) return [widget];
    return widgets.value.filter((w) => w.group === widget.group);
  }

  function isFrontTab(widget: HudWidget): boolean {
    return !widget.group || activeTabs.value[widget.group] === widget.id;
  }

  /** On the screen in view, not folded away, and the tab in front of its window. */
  function isShown(widget: HudWidget): boolean {
    return widget.screen === activeScreen.value && !widget.minimized && isFrontTab(widget);
  }

  const visible = computed(() => widgets.value.filter(isShown));
  /** Folded into the dock, on this screen: one chip per window, whatever its tabs. */
  const docked = computed(() =>
    widgets.value.filter((w) => w.screen === activeScreen.value && w.minimized && isFrontTab(w)),
  );
  const runningActions = computed(() => actions.value.filter((a) => a.phase === 'running'));
  const currentScreen = computed(() => screens.value.find((s) => s.id === activeScreen.value));
  /** The screen in view is a grid (see `HudScreen.tiled`). */
  const tiled = computed(() => Boolean(currentScreen.value?.tiled));

  /** Each window counted once per screen, for the screen switcher. */
  function windowsOn(screenId: string): number {
    return widgets.value.filter((w) => w.screen === screenId && isFrontTab(w)).length;
  }

  /** The size Jarvis's windows were last laid out for. */
  let laidOutFor: Viewport | null = null;
  let relayoutTimer: ReturnType<typeof setTimeout> | null = null;

  function setViewport(view: Viewport): void {
    if (view.width <= 0 || view.height <= 0) return;
    viewport.value = view;
    for (const widget of widgets.value) {
      widget.rect = widget.maximized ? maximizedRect(view) : clampRect(widget.rect, view);
    }
    // The grid follows the screen's size; nothing is folded for a passing resize.
    if (tiled.value) retile(false);
    else if (laidOutFor && movedEnough(laidOutFor, view)) scheduleRelayout();
  }

  function movedEnough(from: Viewport, to: Viewport): boolean {
    return (
      Math.abs(from.width - to.width) >= RELAYOUT_STEP ||
      Math.abs(from.height - to.height) >= RELAYOUT_STEP ||
      Math.abs((from.left ?? 0) - (to.left ?? 0)) >= RELAYOUT_STEP ||
      Math.abs((from.right ?? 0) - (to.right ?? 0)) >= RELAYOUT_STEP
    );
  }

  /**
   * The window got bigger or smaller, or the sidebar's panel came or went: Jarvis's own
   * windows are laid out again for the new size (once it settles), so a video opened
   * on a small window grows with it and nothing ends up under the panel. What the user
   * placed stays where it is.
   */
  function scheduleRelayout(): void {
    if (relayoutTimer) clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(() => {
      relayoutTimer = null;
      if (manipulating.value || !prefs.value.enabled || !prefs.value.autoArrange) return;
      if (visible.value.some((w) => !w.manual && !w.maximized)) tidy();
    }, 220);
  }

  function focus(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    topZ += 1;
    for (const member of membersOf(widget)) member.z = topZ;
    focusedId.value = id;
  }

  /** Fold the oldest of Jarvis's own windows into the dock when the screen is full. */
  function makeRoom(): void {
    const open = visible.value
      .filter((w) => !w.pinned && w.source === 'agent')
      .sort((a, b) => a.z - b.z);
    let extra = visible.value.length - MAX_OPEN + 1;
    for (const widget of open) {
      if (extra <= 0) break;
      for (const member of membersOf(widget)) member.minimized = true;
      extra -= 1;
    }
  }

  function keyOf(spec: OpenSpec): string {
    if (spec.key) return spec.key;
    if (spec.taskId) return `task:${spec.taskId}`;
    if (spec.docId) return `doc:${spec.docId}`;
    if (spec.url) return `url:${spec.url}`;
    return newId(spec.kind);
  }

  function open(spec: OpenSpec): HudWidget {
    const key = keyOf(spec);
    const existing = byKey(key);
    if (existing) {
      existing.title = spec.title || existing.title;
      if (spec.url) existing.url = spec.url;
      if (spec.start !== undefined) existing.start = spec.start;
      if (!spec.background) {
        // Asked for again from another screen: it comes to this one.
        if (existing.screen !== activeScreen.value) moveToScreen(existing.id, activeScreen.value);
        if (existing.group) activeTabs.value[existing.group] = existing.id;
        for (const member of membersOf(existing)) member.minimized = false;
        focus(existing.id);
        settle();
      }
      return existing;
    }
    makeRoom();
    topZ += 1;
    const widget: HudWidget = {
      id: newId('hud'),
      key,
      kind: spec.kind,
      title: spec.title,
      rect: placeRect(spec.kind, visible.value, viewport.value),
      z: spec.background ? topZ - 200 : topZ,
      minimized: false,
      maximized: false,
      pinned: false,
      createdAt: Date.now(),
      source: spec.source ?? 'agent',
      screen: activeScreen.value,
      url: spec.url,
      docId: spec.docId,
      taskId: spec.taskId,
      start: spec.start,
    };
    widgets.value.push(widget);
    if (!spec.background) focusedId.value = widget.id;
    const added = widgets.value[widgets.value.length - 1];
    // Something to look at, opened to be seen: it takes centre stage, at its size.
    const featured = !spec.background && isFeatured(added.kind);
    if (featured) stageId.value = added.id;
    if (tiled.value) retile();
    else if (prefs.value.autoArrange && (added.source === 'agent' || featured)) {
      tidy({ widget: added, background: spec.background });
    }
    return added;
  }

  /** Take a window out of its group; the group goes when one tab is left. */
  function leaveGroup(widget: HudWidget): void {
    const group = widget.group;
    if (!group) return;
    widget.group = undefined;
    const rest = widgets.value.filter((w) => w.group === group);
    if (rest.length === 1) {
      rest[0].group = undefined;
      delete activeTabs.value[group];
    } else if (rest.length && activeTabs.value[group] === widget.id) {
      activeTabs.value[group] = rest[rest.length - 1].id;
    }
  }

  function close(id: string): void {
    const widget = byId(id);
    if (widget) leaveGroup(widget);
    widgets.value = widgets.value.filter((w) => w.id !== id);
    if (focusedId.value === id) focusedId.value = null;
    if (stageId.value === id) stageId.value = null;
    settle();
  }

  function closeAll(): void {
    for (const widget of widgets.value.filter((w) => !w.pinned)) leaveGroup(widget);
    widgets.value = widgets.value.filter((w) => w.pinned);
    focusedId.value = null;
    if (stageId.value && !byId(stageId.value)) stageId.value = null;
    settle();
  }

  /** Fold a window, with its tabs, into the dock. */
  function fold(widget: HudWidget): void {
    for (const member of membersOf(widget)) member.minimized = true;
  }

  function minimize(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    fold(widget);
    if (focusedId.value && membersOf(widget).some((m) => m.id === focusedId.value)) {
      focusedId.value = null;
    }
    settle();
  }

  function restore(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    if (widget.minimized) makeRoom();
    for (const member of membersOf(widget)) member.minimized = false;
    focus(id);
    settle();
  }

  function toggleMaximize(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    const maximized = !widget.maximized;
    for (const member of membersOf(widget)) member.maximized = maximized;
    focus(id);
    settle();
  }

  function togglePin(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    const pinned = !widget.pinned;
    for (const member of membersOf(widget)) member.pinned = pinned;
  }

  /**
   * `byUser`: the user put it there, so Jarvis's tidying will leave it alone. On a grid,
   * moving one window by hand ends the grid, and what it laid out stays as the user's.
   */
  function setRect(id: string, rect: HudRect, byUser = false): void {
    const widget = byId(id);
    if (!widget) return;
    if (byUser) leaveGrid(widget.screen, true);
    const clamped = clampRect(rect, viewport.value);
    for (const member of membersOf(widget)) {
      member.rect = { ...clamped };
      member.maximized = false;
      if (byUser) member.manual = true;
    }
  }

  function rectOf(widget: HudWidget): HudRect {
    return widget.maximized ? maximizedRect(viewport.value) : widget.rect;
  }

  function rename(id: string, title: string): void {
    const widget = byId(id);
    const name = title.trim();
    if (!widget || !name) return;
    widget.title = name.slice(0, 120);
    if (widget.docId) updateDocument(widget.docId, { title: widget.title });
  }

  // -- tabs -------------------------------------------------------------------------------

  /** Put `dragged` (with its own tabs) into `target`'s window, in front. */
  function joinTabs(draggedId: string, targetId: string): void {
    const dragged = byId(draggedId);
    const target = byId(targetId);
    if (!dragged || !target || dragged === target) return;
    if (dragged.group && dragged.group === target.group) return;
    const group = target.group ?? newId('tabs');
    target.group = group;
    const moving = membersOf(dragged);
    const old = dragged.group;
    if (old) delete activeTabs.value[old];
    for (const member of moving) {
      member.group = group;
      member.rect = { ...target.rect };
      member.screen = target.screen;
      member.minimized = target.minimized;
      member.maximized = target.maximized;
      member.pinned = target.pinned;
    }
    activeTabs.value[group] = dragged.id;
    focus(dragged.id);
    settle();
  }

  function activateTab(id: string): void {
    const widget = byId(id);
    if (!widget?.group) return;
    activeTabs.value[widget.group] = id;
    focus(id);
  }

  /** A tab becomes a window of its own, just beside the one it left. */
  function detachTab(id: string): void {
    const widget = byId(id);
    if (!widget?.group) return;
    leaveGroup(widget);
    setRect(id, { ...widget.rect, x: widget.rect.x + 36, y: widget.rect.y + 36 });
    widget.maximized = false;
    focus(id);
    settle();
  }

  // -- screens ----------------------------------------------------------------------------

  function addScreen(name = ''): HudScreen | null {
    if (screens.value.length >= MAX_SCREENS) return null;
    const screen = { id: newId('screen'), name: name.trim().slice(0, 40) };
    screens.value = [...screens.value, screen];
    activeScreen.value = screen.id;
    focusedId.value = null;
    return screen;
  }

  function renameScreen(id: string, name: string): void {
    const screen = screens.value.find((s) => s.id === id);
    if (screen) screen.name = name.trim().slice(0, 40);
  }

  /** The screen goes; its windows move to the one before it, never lost. */
  function removeScreen(id: string): void {
    const index = screens.value.findIndex((s) => s.id === id);
    if (index < 0 || screens.value.length === 1) return;
    const heir = screens.value[index === 0 ? 1 : index - 1].id;
    for (const widget of widgets.value) if (widget.screen === id) widget.screen = heir;
    screens.value = screens.value.filter((s) => s.id !== id);
    if (activeScreen.value === id) activeScreen.value = heir;
    settle();
  }

  function switchScreen(id: string): void {
    if (!screens.value.some((s) => s.id === id) || activeScreen.value === id) return;
    activeScreen.value = id;
    focusedId.value = null;
    settle();
  }

  /** The next or previous screen, round the end. */
  function cycleScreen(step: 1 | -1): void {
    const index = screens.value.findIndex((s) => s.id === activeScreen.value);
    const next = (index + step + screens.value.length) % screens.value.length;
    switchScreen(screens.value[next].id);
  }

  function moveToScreen(id: string, screenId: string): void {
    const widget = byId(id);
    if (!widget || !screens.value.some((s) => s.id === screenId)) return;
    for (const member of membersOf(widget)) member.screen = screenId;
    settle();
  }

  // -- arranging ----------------------------------------------------------------------------

  function snap(id: string, zone: SnapZone): void {
    setRect(id, snapRect(zone, viewport.value), true);
  }

  /**
   * Every window on this screen side by side, so none hides another, and the screen
   * stays a grid: what opens, closes, folds or comes back later takes or leaves a cell.
   */
  function organize(): void {
    const screen = currentScreen.value;
    if (!screen) return;
    screen.tiled = true;
    for (const widget of visible.value)
      for (const member of membersOf(widget)) member.manual = false;
    retile();
  }

  /**
   * Lay the grid out again. With more windows than cells (`gridShape`), the
   * least-recently used of Jarvis's own fold into the dock first; `foldExtra` false only
   * re-fits them, as when the screen changes size.
   */
  function retile(foldExtra = true): void {
    const inGrid = () => visible.value.filter((w) => !w.maximized);
    if (foldExtra) {
      const { cols, rows } = gridShape(viewport.value);
      let extra = inGrid().length - cols * rows;
      const foldable = inGrid()
        .filter((w) => w.source === 'agent' && !w.pinned)
        .sort((a, b) => a.z - b.z);
      for (const widget of foldable) {
        if (extra <= 0) break;
        fold(widget);
        extra -= 1;
      }
    }
    const shown = inGrid().sort((a, b) => a.createdAt - b.createdAt);
    tileRects(shown.length, viewport.value).forEach((rect, i) => setRect(shown[i].id, rect));
  }

  /** After a window comes, goes, folds or changes screen: a grid closes up or makes room. */
  function settle(): void {
    if (tiled.value) retile();
  }

  /**
   * The screen goes back to free windows. `keep`: the user moved one by hand, so what the
   * grid laid out stays where it is, as theirs; otherwise Jarvis may tidy it to the sides.
   */
  function leaveGrid(screenId = activeScreen.value, keep = false): void {
    const screen = screens.value.find((s) => s.id === screenId);
    if (!screen?.tiled) return;
    screen.tiled = false;
    if (!keep) return;
    for (const widget of widgets.value) {
      if (widget.screen === screenId && !widget.minimized) widget.manual = true;
    }
  }

  /**
   * Jarvis's own tidying, after it opens something: tasks in a column on the left, the
   * rest in a column on the right, the core in the middle left clear. Windows the user
   * placed or maximised stay where they are, and the columns go beside them, never over
   * them; past what a column holds (three, fewer on a short screen) the oldest of
   * Jarvis's own fold into the dock. On a grid, the grid makes room instead. `opened`:
   * the window just opened, and whether it opened behind (a task the user did not ask
   * to see). Returns how many windows it placed.
   */
  function tidy(opened?: { widget: HudWidget; background?: boolean }): number {
    if (tiled.value) {
      retile();
      return visible.value.length;
    }
    const view = viewport.value;
    laidOutFor = { ...view };
    const shown = visible.value;
    const taken = shown.filter((w) => w.manual || w.maximized).map(rectOf);
    // Centre stage first, at its size (or where the user likes that kind); the columns
    // go beside it.
    const star = shown.find((w) => w.id === stageId.value && !w.manual && !w.maximized);
    let staged = 0;
    if (star) {
      const liked = learned.value[star.kind];
      const rect = liked ? fromShare(liked, view) : stageRect(star.kind, view, taken);
      if (rect) {
        setRect(star.id, rect);
        taken.push(rect);
        staged = 1;
      }
    }
    const movable = shown
      .filter((w) => !w.manual && !w.maximized && !(staged && w === star))
      .sort((a, b) => b.z - a.z);
    if (!movable.length) return staged;
    const slots = sideSlots(view, taken);
    if (!slots.length) return staged + makeWay(movable, taken, opened);
    const perColumn = Math.min(PER_COLUMN, gridShape(view).rows);
    // Newest first: the newest stay, the rest fold; then oldest at the top.
    const keep = (list: HudWidget[]): HudWidget[] => {
      const kept: HudWidget[] = [];
      for (const widget of list) {
        if (kept.length < perColumn || widget.pinned || widget.source === 'user') kept.push(widget);
        else fold(widget);
      }
      return kept.reverse();
    };
    const isTask = (w: HudWidget) => w.kind === 'task';
    if (slots.length === 1) {
      const kept = keep(movable);
      const column = [...kept.filter(isTask), ...kept.filter((w) => !isTask(w))];
      stackRects(slots[0], column.length, view).forEach((r, i) => setRect(column[i].id, r));
      return staged + column.length;
    }
    const left = keep(movable.filter(isTask));
    const right = keep(movable.filter((w) => !isTask(w)));
    stackRects(slots[0], left.length, view).forEach((r, i) => setRect(left[i].id, r));
    stackRects(slots[1], right.length, view).forEach((r, i) => setRect(right[i].id, r));
    return staged + left.length + right.length;
  }

  // -- arranging, as the user would do it by hand -----------------------------------------

  /** A window put somewhere on purpose (by Jarvis when asked): tidying leaves it there. */
  function place(id: string, rect: HudRect): void {
    setRect(id, rect, true);
    focus(id);
  }

  /** A window brought to a named size, centred where it was. */
  function resizeTo(id: string, size: SizePreset): void {
    const widget = byId(id);
    if (!widget) return;
    place(id, presetRect(rectOf(widget), size, widget.kind, viewport.value));
  }

  function maximize(id: string, on = true): void {
    const widget = byId(id);
    if (widget && widget.maximized !== on) toggleMaximize(id);
  }

  /**
   * Put a window on centre stage: brought back if folded, at the size its kind needs,
   * with Jarvis's other windows beside it and its figure moved to what is left.
   */
  function feature(id: string): void {
    const widget = byId(id);
    if (!widget) return;
    if (widget.screen !== activeScreen.value) moveToScreen(id, activeScreen.value);
    if (widget.group) activeTabs.value[widget.group] = id;
    for (const member of membersOf(widget)) {
      member.minimized = false;
      member.maximized = false;
      member.manual = false;
    }
    stageId.value = id;
    focus(id);
    leaveGrid();
    tidy();
  }

  function setEditing(on: boolean): void {
    if (editing.value === on) return;
    editing.value = on;
    hideNative(on);
  }

  function beginManipulate(): void {
    manipulating.value += 1;
  }

  function endManipulate(): void {
    manipulating.value = Math.max(0, manipulating.value - 1);
  }

  /**
   * The user put a window where they want it: the next of its kind Jarvis opens to be
   * looked at goes there too. Tasks are not learnt: they stack in a column.
   */
  function learnPlacement(id: string): void {
    const widget = byId(id);
    if (!widget || widget.maximized || !isFeatured(widget.kind)) return;
    learned.value = { ...learned.value, [widget.kind]: toShare(widget.rect, viewport.value) };
    writeJson(LEARNED_KEY, learned.value);
  }

  /** Forget where the user liked a kind (or every kind): Jarvis goes back to its stage. */
  function forgetPlacement(kind?: HudKind): void {
    if (kind) {
      const rest = { ...learned.value };
      delete rest[kind];
      learned.value = rest;
    } else {
      learned.value = {};
    }
    writeJson(LEARNED_KEY, learned.value);
  }

  // -- Jarvis's figure ------------------------------------------------------------------

  /**
   * Where Jarvis's figure belongs now: centred in the part of the free band no window
   * covers, shrunk to fit it (`avatarSpot`). At full scale it takes about a square of the
   * shorter side (Jarvis's rings span 0.9 of the height; its side panels stay where they
   * are, drawn apart from the camera). Switched off, it stays in the middle of the canvas.
   */
  const avatar = computed<AvatarSpot>(() => {
    const view = viewport.value;
    if (!prefs.value.enabled || !prefs.value.moveAside) {
      return { x: view.width / 2, y: view.height / 2, scale: 1 };
    }
    const side = Math.max(1, Math.min(view.width, view.height) * 0.95);
    return avatarSpot(view, visible.value.map(rectOf), { w: side, h: side });
  });

  /**
   * No column left beside the user's windows: Jarvis folds its older ones and shows the
   * new one in the largest empty part left (`freeRect`), or, with none, where it hides
   * least. A window that opened behind just folds, and nothing else moves for it: it is
   * not worth covering what the user is looking at.
   */
  function makeWay(
    movable: HudWidget[],
    taken: HudRect[],
    opened?: { widget: HudWidget; background?: boolean },
  ): number {
    const newest =
      (opened && movable.find((w) => w.id === opened.widget.id)) ??
      [...movable].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!newest) return 0;
    if (opened?.background && newest.source === 'agent' && !newest.pinned) {
      fold(newest);
      return 0;
    }
    for (const widget of movable) {
      if (widget !== newest && widget.source === 'agent' && !widget.pinned) fold(widget);
    }
    const view = viewport.value;
    setRect(newest.id, freeRect(view, taken) ?? leastCovering(view, taken));
    return 1;
  }

  // -- documents -------------------------------------------------------------------

  function saveDocuments(): void {
    writeJson(DOCS_KEY, documents.value.slice(0, MAX_DOCUMENTS));
  }

  function documentById(id: string | undefined): HudDocument | undefined {
    return id ? documents.value.find((d) => d.id === id) : undefined;
  }

  function createDocument(
    title: string,
    markdown: string,
    origin: { taskId?: string; url?: string } = {},
  ): HudDocument {
    if (origin.taskId) {
      const already = documents.value.find((d) => d.taskId === origin.taskId);
      if (already) {
        already.markdown = markdown;
        already.title = title || already.title;
        already.updatedAt = Date.now();
        saveDocuments();
        return already;
      }
    }
    const now = Date.now();
    const doc: HudDocument = {
      id: newId('doc'),
      title,
      markdown,
      createdAt: now,
      updatedAt: now,
      ...origin,
    };
    documents.value = [doc, ...documents.value].slice(0, MAX_DOCUMENTS);
    saveDocuments();
    return documents.value[0];
  }

  function updateDocument(
    id: string,
    patch: Partial<Pick<HudDocument, 'title' | 'markdown'>>,
  ): void {
    const doc = documentById(id);
    if (!doc) return;
    if (patch.title !== undefined) doc.title = patch.title;
    if (patch.markdown !== undefined) doc.markdown = patch.markdown;
    doc.updatedAt = Date.now();
    for (const widget of widgets.value) {
      if (widget.docId === id && patch.title !== undefined) widget.title = patch.title;
    }
    saveDocuments();
  }

  function deleteDocument(id: string): void {
    for (const widget of widgets.value.filter((w) => w.docId === id)) leaveGroup(widget);
    documents.value = documents.value.filter((d) => d.id !== id);
    widgets.value = widgets.value.filter((w) => w.docId !== id);
    saveDocuments();
  }

  function openDocument(doc: HudDocument, source: 'agent' | 'user' = 'user'): HudWidget {
    return open({ kind: 'document', docId: doc.id, title: doc.title, source });
  }

  // -- the action log --------------------------------------------------------------

  function actionStarted(id: string, name: string, detail: string): void {
    actions.value = [
      { id, name, detail, phase: 'running' as const, startedAt: Date.now() },
      ...actions.value.filter((a) => a.id !== id),
    ].slice(0, MAX_ACTIONS);
  }

  function actionUpdated(id: string, update: string): void {
    const action = actions.value.find((a) => a.id === id);
    if (action) action.update = update;
  }

  function actionEnded(id: string, status: string): void {
    const action = actions.value.find((a) => a.id === id);
    if (!action) return;
    action.phase = status === 'done' ? 'done' : status === 'cancelled' ? 'cancelled' : 'error';
    action.endedAt = Date.now();
  }

  function clearActions(): void {
    actions.value = [];
  }

  // -- settings ------------------------------------------------------------------------

  function setPref<K extends keyof HudPrefs>(key: K, value: HudPrefs[K]): void {
    prefs.value = { ...prefs.value, [key]: value };
    writeJson(PREFS_KEY, prefs.value);
  }

  function rememberResult(taskId: string, result: string, sources: string[], title: string): void {
    taskResults.value = { ...taskResults.value, [taskId]: { result, sources, title } };
  }

  function setCover(rect: HudRect | null): void {
    const same =
      rect && cover.value
        ? rect.x === cover.value.x &&
          rect.y === cover.value.y &&
          rect.w === cover.value.w &&
          rect.h === cover.value.h
        : rect === cover.value;
    if (!same) cover.value = rect;
  }

  /** Whether the sidebar's panel lies over `widget`. */
  function underCover(widget: HudWidget): boolean {
    const c = cover.value;
    if (!c) return false;
    const r = rectOf(widget);
    return r.x < c.x + c.w && r.x + r.w > c.x && r.y < c.y + c.h && r.y + r.h > c.y;
  }

  function hideNative(hidden: boolean): void {
    nativeHidden.value = Math.max(0, nativeHidden.value + (hidden ? 1 : -1));
  }

  /** Whether a window with a higher z overlaps `widget`: its native view must not cover it. */
  function covered(widget: HudWidget): boolean {
    const mine = rectOf(widget);
    return visible.value.some((other) => {
      if (other.id === widget.id || other.z < widget.z) return false;
      if (widget.group && other.group === widget.group) return false;
      const r = rectOf(other);
      return (
        r.x < mine.x + mine.w && r.x + r.w > mine.x && r.y < mine.y + mine.h && r.y + r.h > mine.y
      );
    });
  }

  function setBrowserSignIn(state: 'idle' | 'open' | 'done', url = ''): void {
    browserSignIn.value = { state, url: url || browserSignIn.value.url };
  }

  // -- keeping the arrangement ---------------------------------------------------------

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function saveLayout(): void {
    writeJson(LAYOUT_KEY, {
      screens: screens.value,
      active: activeScreen.value,
      windows: widgets.value.filter((w) => KEPT_KINDS.includes(w.kind)),
    });
  }
  watch(
    [widgets, screens, activeScreen],
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveLayout, 400);
    },
    { deep: true },
  );

  return {
    nativeHidden,
    cover,
    setCover,
    underCover,
    browserSignIn,
    hideNative,
    covered,
    setBrowserSignIn,
    widgets,
    screens,
    activeScreen,
    activeTabs,
    snapPreview,
    dropTarget,
    documents,
    actions,
    prefs,
    taskResults,
    viewport,
    focusedId,
    visible,
    docked,
    runningActions,
    byId,
    byKey,
    membersOf,
    isShown,
    windowsOn,
    setViewport,
    focus,
    open,
    close,
    closeAll,
    minimize,
    restore,
    toggleMaximize,
    togglePin,
    setRect,
    rectOf,
    rename,
    joinTabs,
    activateTab,
    detachTab,
    addScreen,
    renameScreen,
    removeScreen,
    switchScreen,
    cycleScreen,
    moveToScreen,
    snap,
    organize,
    leaveGrid,
    tiled,
    tidy,
    editing,
    manipulating,
    stageId,
    learned,
    avatar,
    place,
    resizeTo,
    maximize,
    feature,
    setEditing,
    beginManipulate,
    endManipulate,
    learnPlacement,
    forgetPlacement,
    saveLayout,
    documentById,
    createDocument,
    updateDocument,
    deleteDocument,
    openDocument,
    actionStarted,
    actionUpdated,
    actionEnded,
    clearActions,
    setPref,
    rememberResult,
  };
});
