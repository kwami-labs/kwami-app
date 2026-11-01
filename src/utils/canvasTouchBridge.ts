/**
 * Let a finger do what the mouse does to the avatar canvas.
 *
 * The SDK's blob renderer (kwami `BlobXyz.enableClickInteraction`) listens for
 * mouse events only: `mousedown`/`mousemove`/`mouseup` to spin the blob,
 * `dblclick` to start or stop a conversation. A phone turns a tap into
 * mousedown/mouseup/click, so taps worked, but it fires no mousemove during a
 * drag, so the blob could not be spun; and whether two taps become a dblclick
 * depends on the browser. So:
 *
 * - a one-finger drag is replayed as mousedown → mousemove… → mouseup;
 * - two quick taps in the same spot become exactly one dblclick. Ours is
 *   dispatched, and a native dblclick that a browser derives from the same taps
 *   is stopped before it reaches the canvas, so a double-tap never toggles the
 *   conversation twice.
 *
 * Mouse and pen input is untouched: those already send mouse events. Renderers
 * that use pointer events themselves (Jarvis) are unaffected, as the original
 * pointer events still go through. Needs `touch-action: none` on the canvas, or
 * the browser claims the drag as a pan and cancels the pointer.
 */

/** Two taps closer together than this in time and distance are a double-tap. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;
/** Movement or duration beyond these makes a touch a drag, not a tap. */
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 350;
/** How long after a touch a trusted dblclick is taken to be the browser's own. */
const NATIVE_DBLCLICK_WINDOW_MS = 600;

interface Point {
  x: number;
  y: number;
  t: number;
}

export function bridgeCanvasTouch(canvas: HTMLElement): () => void {
  let active: { id: number; start: Point } | null = null;
  let lastTap: Point | null = null;
  let lastTouchEndAt = -Infinity;

  function emit(type: string, x: number, y: number, extra: MouseEventInit = {}) {
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        ...extra,
      }),
    );
  }

  function isTouch(e: PointerEvent) {
    return e.pointerType === 'touch';
  }

  function onDown(e: PointerEvent) {
    // One finger spins; a second finger joining in is ignored rather than
    // teleporting the drag to wherever it landed.
    if (!isTouch(e) || active) return;
    active = { id: e.pointerId, start: { x: e.clientX, y: e.clientY, t: e.timeStamp } };
    emit('mousedown', e.clientX, e.clientY, { buttons: 1 });
  }

  function onMove(e: PointerEvent) {
    if (!active || e.pointerId !== active.id) return;
    emit('mousemove', e.clientX, e.clientY, { buttons: 1 });
  }

  function onUp(e: PointerEvent) {
    if (!active || e.pointerId !== active.id) return;
    const { start } = active;
    active = null;
    lastTouchEndAt = performance.now();
    emit('mouseup', e.clientX, e.clientY);
    if (e.type === 'pointercancel') return;

    const isTap =
      Math.hypot(e.clientX - start.x, e.clientY - start.y) <= TAP_SLOP_PX &&
      e.timeStamp - start.t <= TAP_MAX_MS;
    if (!isTap) {
      lastTap = null;
      return;
    }
    const tap = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (
      lastTap &&
      tap.t - lastTap.t <= DOUBLE_TAP_MS &&
      Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) <= DOUBLE_TAP_PX
    ) {
      lastTap = null;
      emit('dblclick', tap.x, tap.y, { detail: 2 });
    } else {
      lastTap = tap;
    }
  }

  // Capture on window, so this runs before the SDK's listener on the canvas.
  function onNativeDblClick(e: MouseEvent) {
    if (e.target !== canvas || !e.isTrusted) return;
    if (performance.now() - lastTouchEndAt > NATIVE_DBLCLICK_WINDOW_MS) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('dblclick', onNativeDblClick, true);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('dblclick', onNativeDblClick, true);
  };
}
