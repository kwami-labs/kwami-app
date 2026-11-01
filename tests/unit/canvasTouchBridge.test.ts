import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bridgeCanvasTouch, DOUBLE_TAP_MS } from '@/utils/canvasTouchBridge';

/**
 * The SDK's blob spins on mousemove and toggles the conversation on dblclick.
 * A phone sends neither for a drag, and not reliably for a double-tap; the
 * bridge replays touch pointers as those mouse events.
 */

type Logged = { type: string; x: number; y: number; trusted: boolean };

let canvas: HTMLCanvasElement;
let release: () => void;
let log: Logged[];

/** jsdom has no PointerEvent constructor everywhere; a MouseEvent with the fields set is enough. */
function pointer(
  type: string,
  x: number,
  y: number,
  opts: { id?: number; kind?: string; t?: number } = {},
) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: opts.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: opts.kind ?? 'touch' });
  if (opts.t !== undefined) Object.defineProperty(e, 'timeStamp', { value: opts.t });
  canvas.dispatchEvent(e);
}

function tap(x: number, y: number, t: number) {
  pointer('pointerdown', x, y, { t });
  pointer('pointerup', x, y, { t: t + 60 });
}

beforeEach(() => {
  canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  log = [];
  for (const type of ['mousedown', 'mousemove', 'mouseup', 'dblclick']) {
    canvas.addEventListener(type, (e) => {
      const m = e as MouseEvent;
      log.push({ type, x: m.clientX, y: m.clientY, trusted: m.isTrusted });
    });
  }
  release = bridgeCanvasTouch(canvas);
});

afterEach(() => {
  release();
  canvas.remove();
});

describe('canvas touch bridge', () => {
  it('replays a one-finger drag as mousedown, mousemove and mouseup', () => {
    pointer('pointerdown', 100, 100, { t: 0 });
    pointer('pointermove', 130, 110, { t: 16 });
    pointer('pointermove', 170, 120, { t: 32 });
    pointer('pointerup', 170, 120, { t: 48 });

    expect(log.map((e) => e.type)).toEqual(['mousedown', 'mousemove', 'mousemove', 'mouseup']);
    expect(log[2]).toMatchObject({ x: 170, y: 120 });
  });

  it('leaves mouse and pen input alone, since they already send mouse events', () => {
    pointer('pointerdown', 10, 10, { kind: 'mouse' });
    pointer('pointermove', 20, 20, { kind: 'mouse' });
    pointer('pointerup', 20, 20, { kind: 'pen' });
    expect(log).toEqual([]);
  });

  it('ignores a second finger rather than jumping the drag to it', () => {
    pointer('pointerdown', 100, 100, { id: 1, t: 0 });
    pointer('pointerdown', 300, 300, { id: 2, t: 5 });
    pointer('pointermove', 310, 310, { id: 2, t: 20 });
    pointer('pointermove', 110, 100, { id: 1, t: 20 });
    pointer('pointerup', 110, 100, { id: 1, t: 40 });
    expect(log.map((e) => e.type)).toEqual(['mousedown', 'mousemove', 'mouseup']);
    expect(log[1]).toMatchObject({ x: 110, y: 100 });
  });

  it('turns two quick taps in one spot into a single dblclick', () => {
    tap(200, 200, 0);
    tap(204, 198, 200);
    expect(log.filter((e) => e.type === 'dblclick')).toHaveLength(1);
  });

  it('does not count taps too far apart in time or space', () => {
    tap(200, 200, 0);
    tap(200, 200, DOUBLE_TAP_MS + 200);
    tap(200, 200, 2000);
    tap(260, 200, 2100);
    expect(log.filter((e) => e.type === 'dblclick')).toHaveLength(0);
  });

  it('does not take a drag for a tap', () => {
    tap(200, 200, 0);
    pointer('pointerdown', 200, 200, { t: 100 });
    pointer('pointermove', 260, 200, { t: 120 });
    pointer('pointerup', 260, 200, { t: 140 });
    expect(log.filter((e) => e.type === 'dblclick')).toHaveLength(0);
  });

  it('stops working once released', () => {
    release();
    pointer('pointerdown', 1, 1);
    pointer('pointerup', 1, 1);
    expect(log).toEqual([]);
    release = () => {};
  });
});
