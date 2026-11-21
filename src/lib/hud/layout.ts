/**
 * Where the HUD puts a new window, and how it keeps one on screen.
 *
 * Tasks stack down the left, as a mission board; the live browser takes the right;
 * documents, videos and pages open in the middle band, cascading so a new one never
 * hides the last. Everything is clamped to the area the HUD has, which shrinks when
 * the browser split takes part of the screen, and leaves out the band the sidebar's
 * panel floats over (`left` / `right`), which would hide a window.
 */

export type HudKind = 'task' | 'document' | 'video' | 'web' | 'image' | 'browser';

export interface HudRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Covered on the left by the sidebar's panel, which floats over the HUD. */
  left?: number;
  /** Covered on the right, when the sidebar sits there. */
  right?: number;
}

export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 180;
/** Room left at the top for the control bar, and at the bottom for the dock. */
export const TOP_GUTTER = 64;
export const BOTTOM_GUTTER = 76;
export const SIDE_GUTTER = 16;
const CASCADE = 28;

export const DEFAULT_SIZES: Record<HudKind, { w: number; h: number }> = {
  task: { w: 440, h: 460 },
  document: { w: 680, h: 600 },
  video: { w: 760, h: 520 },
  web: { w: 900, h: 620 },
  image: { w: 600, h: 520 },
  browser: { w: 620, h: 460 },
};

/** The free band of the HUD, between whatever the sidebar covers on either side. */
export function freeBand(view: Viewport): { left: number; width: number } {
  const left = view.left ?? 0;
  return { left, width: Math.max(0, view.width - left - (view.right ?? 0)) };
}

export function clampRect(rect: HudRect, view: Viewport): HudRect {
  const band = freeBand(view);
  const maxW = Math.max(MIN_WIDTH, band.width - SIDE_GUTTER * 2);
  const maxH = Math.max(MIN_HEIGHT, view.height - TOP_GUTTER - BOTTOM_GUTTER);
  const w = Math.min(Math.max(rect.w, MIN_WIDTH), maxW);
  const h = Math.min(Math.max(rect.h, MIN_HEIGHT), maxH);
  const minX = band.left + SIDE_GUTTER;
  const x = Math.min(
    Math.max(rect.x, minX),
    Math.max(minX, band.left + band.width - w - SIDE_GUTTER),
  );
  const y = Math.min(
    Math.max(rect.y, TOP_GUTTER),
    Math.max(TOP_GUTTER, view.height - h - BOTTOM_GUTTER),
  );
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** The rect for a new window of `kind`, given how many of each kind are already open. */
export function placeRect(
  kind: HudKind,
  open: { kind: HudKind; minimized: boolean }[],
  view: Viewport,
): HudRect {
  const size = DEFAULT_SIZES[kind];
  const band = freeBand(view);
  const sameKind = open.filter((w) => w.kind === kind && !w.minimized).length;
  const shown = open.filter(
    (w) => !w.minimized && w.kind !== 'task' && w.kind !== 'browser',
  ).length;
  let rect: HudRect;
  if (kind === 'task') {
    rect = {
      x: band.left + SIDE_GUTTER + 8 + sameKind * CASCADE,
      y: TOP_GUTTER + 24 + sameKind * CASCADE * 2,
      ...size,
    };
  } else if (kind === 'browser') {
    rect = {
      x: band.left + band.width - size.w - SIDE_GUTTER - 8,
      y: TOP_GUTTER + 24,
      ...size,
    };
  } else {
    const step = shown % 6;
    rect = {
      x: band.left + (band.width - size.w) / 2 + step * CASCADE,
      y: TOP_GUTTER + 20 + step * CASCADE,
      ...size,
    };
  }
  return clampRect(rect, view);
}

/** The whole free band, for a window the user maximised. */
export function maximizedRect(view: Viewport): HudRect {
  const band = freeBand(view);
  return clampRect(
    {
      x: band.left + SIDE_GUTTER,
      y: TOP_GUTTER,
      w: band.width - SIDE_GUTTER * 2,
      h: view.height - TOP_GUTTER - BOTTOM_GUTTER,
    },
    view,
  );
}

// ---------------------------------------------------------------------------
// Snapping and tiling
// ---------------------------------------------------------------------------

/** Where a window dropped near an edge or a corner goes, as Windows does it. */
export type SnapZone =
  'left' | 'right' | 'top' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** How close to an edge of the free band a drag has to come to snap. */
export const SNAP_MARGIN = 28;

/**
 * How far a drag has to have carried the pointer toward an edge for that edge to snap.
 * A window at the top of the screen is held by a header already near the top: moved
 * sideways, it must not fill the screen when it is dropped.
 */
export const SNAP_TRAVEL = 24;

/**
 * The zone under a pointer (in HUD coordinates) while a window is dragged, if any.
 * `travel`: how far the drag has gone; an edge only counts when the pointer went toward it.
 */
export function snapZoneAt(
  x: number,
  y: number,
  view: Viewport,
  travel?: { dx: number; dy: number },
): SnapZone | null {
  const band = freeBand(view);
  const left = x - band.left < SNAP_MARGIN && (!travel || travel.dx <= -SNAP_TRAVEL);
  const right = band.left + band.width - x < SNAP_MARGIN && (!travel || travel.dx >= SNAP_TRAVEL);
  const top = y - TOP_GUTTER < SNAP_MARGIN && (!travel || travel.dy <= -SNAP_TRAVEL);
  const bottom =
    view.height - BOTTOM_GUTTER - y < SNAP_MARGIN && (!travel || travel.dy >= SNAP_TRAVEL);
  if (left && top) return 'topLeft';
  if (right && top) return 'topRight';
  if (left && bottom) return 'bottomLeft';
  if (right && bottom) return 'bottomRight';
  if (left) return 'left';
  if (right) return 'right';
  if (top) return 'top';
  return null;
}

/** The rect a zone stands for: a half, a quarter, or the whole free band. */
export function snapRect(zone: SnapZone, view: Viewport): HudRect {
  const whole = maximizedRect(view);
  const gap = 8;
  const halfW = Math.floor((whole.w - gap) / 2);
  const halfH = Math.floor((whole.h - gap) / 2);
  const rightX = whole.x + halfW + gap;
  const lowerY = whole.y + halfH + gap;
  const rects: Record<SnapZone, HudRect> = {
    top: whole,
    left: { x: whole.x, y: whole.y, w: halfW, h: whole.h },
    right: { x: rightX, y: whole.y, w: halfW, h: whole.h },
    topLeft: { x: whole.x, y: whole.y, w: halfW, h: halfH },
    topRight: { x: rightX, y: whole.y, w: halfW, h: halfH },
    bottomLeft: { x: whole.x, y: lowerY, w: halfW, h: halfH },
    bottomRight: { x: rightX, y: lowerY, w: halfW, h: halfH },
  };
  return rects[zone];
}

const GAP = 8;

/**
 * How many columns and rows of windows the free band holds before a window would be
 * smaller than a window can be: a grid of more cells would make them overlap.
 */
export function gridShape(view: Viewport): { cols: number; rows: number } {
  const whole = maximizedRect(view);
  return {
    cols: Math.max(1, Math.floor((whole.w + GAP) / (MIN_WIDTH + GAP))),
    rows: Math.max(1, Math.floor((whole.h + GAP) / (MIN_HEIGHT + GAP))),
  };
}

/** `count` windows laid out as a grid over the free band, row by row. */
export function tileRects(count: number, view: Viewport): HudRect[] {
  if (count <= 0) return [];
  const whole = maximizedRect(view);
  const gap = GAP;
  const cols = Math.min(Math.ceil(Math.sqrt(count)), gridShape(view).cols);
  const rows = Math.ceil(count / cols);
  const w = Math.floor((whole.w - gap * (cols - 1)) / cols);
  const h = Math.floor((whole.h - gap * (rows - 1)) / rows);
  return Array.from({ length: count }, (_, i) => ({
    x: whole.x + (i % cols) * (w + gap),
    y: whole.y + Math.floor(i / cols) * (h + gap),
    w,
    h,
  }));
}

/** A column of the free band Jarvis stacks its windows in: where it starts, how wide. */
export interface Slot {
  x: number;
  w: number;
}

/**
 * The stretches of the free band, left to right, that none of `taken` covers. A window
 * takes its whole width from top to bottom: a column beside it is a column that never
 * runs into it, however tall the column grows.
 */
function openStretches(whole: HudRect, taken: HudRect[]): Slot[] {
  const end = whole.x + whole.w;
  const spans = taken
    .filter((r) => r.y < whole.y + whole.h && r.y + r.h > whole.y)
    .map((r) => [Math.max(whole.x, r.x - GAP), Math.min(end, r.x + r.w + GAP)] as const)
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  const open: Slot[] = [];
  let cursor = whole.x;
  for (const [from, to] of spans) {
    if (from > cursor) open.push({ x: cursor, w: from - cursor });
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) open.push({ x: cursor, w: end - cursor });
  return open;
}

/**
 * Where Jarvis's columns go, left to right: two (tasks, then the rest) or one (both
 * stacked), or none when the windows in `taken` (the user's, or a maximised one) leave
 * no stretch a window fits in. With nothing taken, the columns hug the sides and leave
 * the core in view; on a narrow screen one column takes them all.
 */
export function sideSlots(view: Viewport, taken: HudRect[] = []): Slot[] {
  const whole = maximizedRect(view);
  const wide = whole.w >= 1100;
  const colW = Math.max(MIN_WIDTH, Math.min(560, Math.floor(whole.w * (wide ? 0.32 : 0.5))));
  if (!taken.length) {
    const right = { x: whole.x + whole.w - colW, w: colW };
    return wide ? [{ x: whole.x, w: colW }, right] : [right];
  }
  const open = openStretches(whole, taken).filter((s) => s.w >= MIN_WIDTH);
  if (!open.length) return [];
  const fit = (s: Slot, againstRight: boolean): Slot => {
    const w = Math.min(colW, s.w);
    return { x: againstRight ? s.x + s.w - w : s.x, w };
  };
  if (open.length >= 2) return [fit(open[0], false), fit(open[open.length - 1], true)];
  const only = open[0];
  if (wide && only.w >= MIN_WIDTH * 2 + GAP) {
    const w = Math.min(colW, Math.floor((only.w - GAP) / 2));
    return [
      { x: only.x, w },
      { x: only.x + only.w - w, w },
    ];
  }
  // Against the side of the screen the stretch reaches; the right one if it reaches both.
  const reachesRight = only.x + only.w >= whole.x + whole.w;
  const reachesLeft = only.x <= whole.x;
  return [fit(only, reachesRight || !reachesLeft)];
}

/** `count` windows stacked down a column, sharing its height. */
export function stackRects(slot: Slot, count: number, view: Viewport): HudRect[] {
  if (count <= 0) return [];
  const whole = maximizedRect(view);
  const h = Math.floor((whole.h - GAP * (count - 1)) / count);
  return Array.from({ length: count }, (_, i) => ({
    x: slot.x,
    y: whole.y + i * (h + GAP),
    w: slot.w,
    h,
  }));
}

/**
 * Jarvis's own arrangement, meant to stay out of the way: tasks stacked in a column on
 * the left, everything else in a column on the right, the core in the middle left in
 * view. On a narrow screen there is no room for two columns and one takes them all.
 */
export function sideColumns(
  leftCount: number,
  rightCount: number,
  view: Viewport,
): { left: HudRect[]; right: HudRect[] } {
  const slots = sideSlots(view);
  if (slots.length === 1) {
    const all = stackRects(slots[0], leftCount + rightCount, view);
    return { left: all.slice(0, leftCount), right: all.slice(leftCount) };
  }
  return {
    left: stackRects(slots[0], leftCount, view),
    right: stackRects(slots[1], rightCount, view),
  };
}

function overlap(a: HudRect, b: HudRect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The largest empty part of the free band, across and down, that none of `taken` covers,
 * if a window fits in it: the quarter two snapped windows leave, say. Its edges can only
 * be the band's or those of the windows, so those are the only ones tried.
 */
export function freeRect(view: Viewport, taken: HudRect[]): HudRect | null {
  const whole = maximizedRect(view);
  const blocks = taken.map((r) => ({
    x: r.x - GAP,
    y: r.y - GAP,
    w: r.w + GAP * 2,
    h: r.h + GAP * 2,
  }));
  const edges = (from: number, size: number, of: (b: HudRect) => number[]) =>
    [
      ...new Set(
        [from, from + size, ...blocks.flatMap(of)].map((v) =>
          Math.min(from + size, Math.max(from, v)),
        ),
      ),
    ].sort((a, b) => a - b);
  const xs = edges(whole.x, whole.w, (b) => [b.x, b.x + b.w]);
  const ys = edges(whole.y, whole.h, (b) => [b.y, b.y + b.h]);
  let best: HudRect | null = null;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const w = xs[j] - xs[i];
      if (w < MIN_WIDTH) continue;
      for (let k = 0; k < ys.length; k++) {
        for (let l = k + 1; l < ys.length; l++) {
          const h = ys[l] - ys[k];
          if (h < MIN_HEIGHT || (best && w * h <= best.w * best.h)) continue;
          const rect = { x: xs[i], y: ys[k], w, h };
          if (!blocks.some((b) => overlap(rect, b) > 0)) best = rect;
        }
      }
    }
  }
  return best;
}

/**
 * Where a window covers least of `taken`, when there is no room left beside them: a
 * compact window in whichever corner hides the least, the top right on a tie.
 */
export function leastCovering(view: Viewport, taken: HudRect[]): HudRect {
  const whole = maximizedRect(view);
  const w = Math.min(whole.w, Math.max(MIN_WIDTH, Math.min(420, Math.floor(whole.w * 0.4))));
  const h = Math.min(whole.h, Math.max(MIN_HEIGHT, Math.floor(whole.h * 0.55)));
  const right = whole.x + whole.w - w;
  const bottom = whole.y + whole.h - h;
  const corners: HudRect[] = [
    { x: right, y: whole.y, w, h },
    { x: right, y: bottom, w, h },
    { x: whole.x, y: whole.y, w, h },
    { x: whole.x, y: bottom, w, h },
  ];
  let best = corners[0];
  let least = Infinity;
  for (const corner of corners) {
    const hidden = taken.reduce((sum, r) => sum + overlap(corner, r), 0);
    if (hidden < least) {
      best = corner;
      least = hidden;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Arranging by hand: resizing from any edge, edges drawn to each other, sizes
// ---------------------------------------------------------------------------

/** An edge or a corner a window is resized from. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * `origin` resized from `edge` by the pointer's travel: the opposite edges stay where
 * they are, and the window never gets smaller than a window can be nor leaves the area
 * windows have.
 */
export function resizeRect(
  origin: HudRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  view: Viewport,
): HudRect {
  const whole = maximizedRect(view);
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.w;
  let bottom = origin.y + origin.h;
  if (edge.includes('w')) left = Math.min(Math.max(whole.x, left + dx), right - MIN_WIDTH);
  if (edge.includes('e')) {
    right = Math.max(Math.min(whole.x + whole.w, right + dx), left + MIN_WIDTH);
  }
  if (edge.includes('n')) top = Math.min(Math.max(whole.y, top + dy), bottom - MIN_HEIGHT);
  if (edge.includes('s')) {
    bottom = Math.max(Math.min(whole.y + whole.h, bottom + dy), top + MIN_HEIGHT);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** How near an edge has to come to another, in pixels, to be drawn to it. */
export const MAGNET = 10;

/** The pull that brings the nearest of `edges` onto one of `lines`, if one is near enough. */
function pull(edges: number[], lines: number[]): number {
  let best = 0;
  let least = MAGNET + 1;
  for (const edge of edges) {
    for (const line of lines) {
      const d = line - edge;
      if (Math.abs(d) < least) {
        least = Math.abs(d);
        best = d;
      }
    }
  }
  return least <= MAGNET ? best : 0;
}

/**
 * What a window's edges are drawn to as it moves or is resized: the edges of the area
 * windows have, and those of every other window, lined up with them or a gap apart.
 */
function magnetLines(view: Viewport, others: HudRect[]): { xs: number[]; ys: number[] } {
  const whole = maximizedRect(view);
  const xs = [whole.x, whole.x + whole.w];
  const ys = [whole.y, whole.y + whole.h];
  for (const r of others) {
    xs.push(r.x, r.x + r.w, r.x - GAP, r.x + r.w + GAP);
    ys.push(r.y, r.y + r.h, r.y - GAP, r.y + r.h + GAP);
  }
  return { xs, ys };
}

/**
 * `rect` with its edges drawn to the nearest line within `MAGNET`: moved whole, or,
 * resized from `edge`, only the edges that move. Lining windows up by hand is then a
 * matter of dropping them near each other.
 */
export function magnetRect(
  rect: HudRect,
  view: Viewport,
  others: HudRect[],
  edge?: ResizeEdge,
): HudRect {
  const { xs, ys } = magnetLines(view, others);
  if (!edge) {
    return {
      ...rect,
      x: rect.x + pull([rect.x, rect.x + rect.w], xs),
      y: rect.y + pull([rect.y, rect.y + rect.h], ys),
    };
  }
  let { x, y, w, h } = rect;
  if (edge.includes('w')) {
    const d = pull([x], xs);
    if (w - d >= MIN_WIDTH) {
      x += d;
      w -= d;
    }
  }
  if (edge.includes('e')) {
    const d = pull([x + w], xs);
    if (w + d >= MIN_WIDTH) w += d;
  }
  if (edge.includes('n')) {
    const d = pull([y], ys);
    if (h - d >= MIN_HEIGHT) {
      y += d;
      h -= d;
    }
  }
  if (edge.includes('s')) {
    const d = pull([y + h], ys);
    if (h + d >= MIN_HEIGHT) h += d;
  }
  return { x, y, w, h };
}

/** Where a window can be sent with its size kept: a side, a corner or the middle. */
export type PlaceZone = SnapZone | 'bottom' | 'center';

/** `rect`, its size kept, moved to a side, a corner or the middle of the area windows have. */
export function moveToZone(rect: HudRect, zone: PlaceZone, view: Viewport): HudRect {
  const whole = maximizedRect(view);
  const w = Math.min(rect.w, whole.w);
  const h = Math.min(rect.h, whole.h);
  const left = whole.x;
  const right = whole.x + whole.w - w;
  const midX = whole.x + (whole.w - w) / 2;
  const top = whole.y;
  const bottom = whole.y + whole.h - h;
  const midY = whole.y + (whole.h - h) / 2;
  const spots: Record<PlaceZone, [number, number]> = {
    left: [left, midY],
    right: [right, midY],
    top: [midX, top],
    bottom: [midX, bottom],
    center: [midX, midY],
    topLeft: [left, top],
    topRight: [right, top],
    bottomLeft: [left, bottom],
    bottomRight: [right, bottom],
  };
  const [x, y] = spots[zone];
  return { x: Math.round(x), y: Math.round(y), w, h };
}

export type SizePreset = 'small' | 'medium' | 'large';

/** A video window's header, controls and footer: what it needs beyond the picture. */
export const VIDEO_CHROME = 104;

/** The window's height for a picture `w` wide at 16:9. */
function videoHeight(w: number): number {
  return Math.round((w * 9) / 16) + VIDEO_CHROME;
}

/**
 * A window brought to a size the user or Jarvis named, kept centred where it was: a
 * third, half or most of the area, a video at 16:9 and anything else taller.
 */
export function presetRect(
  rect: HudRect,
  size: SizePreset,
  kind: HudKind,
  view: Viewport,
): HudRect {
  const whole = maximizedRect(view);
  const share = { small: 0.32, medium: 0.5, large: 0.72 }[size];
  let w = Math.max(MIN_WIDTH, Math.round(whole.w * share));
  let h =
    kind === 'video'
      ? videoHeight(w)
      : Math.round(whole.h * { small: 0.5, medium: 0.72, large: 0.94 }[size]);
  if (h > whole.h) {
    h = whole.h;
    if (kind === 'video') w = Math.max(MIN_WIDTH, Math.round(((h - VIDEO_CHROME) * 16) / 9));
  }
  return clampRect({ x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h }, view);
}

/**
 * A video window given a size by voice keeps its picture at 16:9: the height follows the
 * width (or, when that would not fit, the width follows the height), around `anchor`
 * ('centre' keeps its middle, 'corner' its top left).
 */
export function keepPicture(rect: HudRect, view: Viewport, anchor: 'centre' | 'corner'): HudRect {
  const whole = maximizedRect(view);
  let w = Math.max(MIN_WIDTH, rect.w);
  let h = videoHeight(w);
  if (h > whole.h) {
    h = whole.h;
    w = Math.max(MIN_WIDTH, Math.round(((h - VIDEO_CHROME) * 16) / 9));
  }
  const x = anchor === 'centre' ? rect.x + (rect.w - w) / 2 : rect.x;
  const y = anchor === 'centre' ? rect.y + (rect.h - h) / 2 : rect.y;
  return clampRect({ x, y, w, h }, view);
}

/** A place in shares of the area windows have (0 to 1), so it holds at any screen size. */
export interface ShareRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function toShare(rect: HudRect, view: Viewport): ShareRect {
  const whole = maximizedRect(view);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    x: round((rect.x - whole.x) / whole.w),
    y: round((rect.y - whole.y) / whole.h),
    w: round(rect.w / whole.w),
    h: round(rect.h / whole.h),
  };
}

export function fromShare(share: ShareRect, view: Viewport): HudRect {
  const whole = maximizedRect(view);
  return clampRect(
    {
      x: whole.x + share.x * whole.w,
      y: whole.y + share.y * whole.h,
      w: share.w * whole.w,
      h: share.h * whole.h,
    },
    view,
  );
}

// ---------------------------------------------------------------------------
// Centre stage: the thing worth looking at, and Jarvis's figure moving aside
// ---------------------------------------------------------------------------

/** What Jarvis opens to be looked at, rather than a task it keeps an eye on. */
export function isFeatured(kind: HudKind): boolean {
  return kind === 'video' || kind === 'document' || kind === 'web' || kind === 'image';
}

/** How wide the stage may grow for each kind: a report reads best not too wide. */
const STAGE_MAX_W: Record<HudKind, number> = {
  video: 1180,
  document: 900,
  web: 1180,
  image: 1000,
  task: 560,
  browser: 900,
};

/** The least room worth a stage: a window at its size and a column beside it. */
const STAGE_MIN_W = 900;
const STAGE_MIN_H_SHARE = 0.6;

/**
 * Where Jarvis shows the thing worth looking at: on the right of the largest part of
 * the area the windows in `taken` leave, at a size made for it (a video 16:9, a report
 * the full height), with the rest of that part left for its other windows and its own
 * figure. Null when that part is too small for both (a narrow screen, or one the user
 * has mostly taken): then the thing goes in a column like the rest.
 */
export function stageRect(kind: HudKind, view: Viewport, taken: HudRect[] = []): HudRect | null {
  const whole = maximizedRect(view);
  const area = taken.length ? freeRect(view, taken) : whole;
  if (!area || area.w < STAGE_MIN_W || area.h < whole.h * STAGE_MIN_H_SHARE) return null;
  const share = area.w >= 1100 ? 0.6 : 0.64;
  let w = Math.min(area.w, STAGE_MAX_W[kind], Math.max(MIN_WIDTH, Math.round(area.w * share)));
  let h = area.h;
  if (kind === 'video') {
    h = Math.min(area.h, videoHeight(w));
    w = Math.min(w, Math.max(MIN_WIDTH, Math.round(((h - VIDEO_CHROME) * 16) / 9)));
  }
  return {
    x: area.x + area.w - w,
    y: area.y + Math.round((area.h - h) / 2),
    w,
    h,
  };
}

/** Where Jarvis's figure sits and how big, in the HUD's coordinates (1 is its full size). */
export interface AvatarSpot {
  x: number;
  y: number;
  scale: number;
}

/** Below this the figure would be a speck: it stays where it was, behind the windows. */
const MIN_AVATAR_SCALE = 0.22;

/** The largest part of `area` none of `blocks` covers, at least `minW` by `minH`. */
function largestEmpty(
  area: HudRect,
  blocks: HudRect[],
  minW: number,
  minH: number,
): HudRect | null {
  const edges = (from: number, size: number, of: (b: HudRect) => number[]) =>
    [
      ...new Set(
        [from, from + size, ...blocks.flatMap(of)].map((v) =>
          Math.min(from + size, Math.max(from, v)),
        ),
      ),
    ].sort((a, b) => a - b);
  const xs = edges(area.x, area.w, (b) => [b.x, b.x + b.w]);
  const ys = edges(area.y, area.h, (b) => [b.y, b.y + b.h]);
  // Squarer wins over a long sliver of the same area: the figure is round.
  const worth = (r: HudRect) => Math.min(r.w, r.h) ** 2 + r.w * r.h * 0.25;
  let best: HudRect | null = null;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const w = xs[j] - xs[i];
      if (w < minW) continue;
      for (let k = 0; k < ys.length; k++) {
        for (let l = k + 1; l < ys.length; l++) {
          const h = ys[l] - ys[k];
          if (h < minH) continue;
          const rect = { x: xs[i], y: ys[k], w, h };
          if (best && worth(rect) <= worth(best)) continue;
          if (!blocks.some((b) => overlap(rect, b) > 0)) best = rect;
        }
      }
    }
  }
  return best;
}

/**
 * Where Jarvis's own figure goes so that no window covers it: the middle of the largest
 * part of the free band left uncovered, shrunk to fit there. `content` is how much of the
 * canvas the figure takes at full size (Jarvis's interface spans it; a blob is a square
 * about the height). With nowhere worth it, the middle of the band, behind the windows.
 */
export function avatarSpot(
  view: Viewport,
  windows: HudRect[],
  content: { w: number; h: number },
): AvatarSpot {
  const band = freeBand(view);
  const area = { x: band.left, y: 0, w: band.width, h: view.height };
  const fit = (r: HudRect) => Math.min(1, r.w / content.w, r.h / content.h);
  const whole = { x: area.x + area.w / 2, y: area.y + area.h / 2, scale: fit(area) };
  if (!windows.length) return whole;
  const blocks = windows.map((r) => ({
    x: r.x - GAP,
    y: r.y - GAP,
    w: r.w + GAP * 2,
    h: r.h + GAP * 2,
  }));
  const free = largestEmpty(area, blocks, 80, 80);
  if (!free || fit(free) < MIN_AVATAR_SCALE) return whole;
  return { x: free.x + free.w / 2, y: free.y + free.h / 2, scale: fit(free) };
}
