import { onBeforeUnmount, watch } from 'vue';
import { useHudStore } from '@/stores/hud';
import { useKwami } from '@/composables/useKwami';

/**
 * Jarvis's own figure makes room for its windows: as they open, move, fold or close, it
 * glides to the part of the screen none of them covers and shrinks to fit there
 * (`hud.avatar`), and comes back to the middle when they go.
 *
 * Done with the camera's view offset, so it works for every figure (the blob, the eye,
 * Jarvis's interface) without touching any of them: the canvas shows the scene as if it
 * were rendered larger and shifted, which puts the figure's centre at the spot and scales
 * it, while a flat backdrop (a colour, a gradient, Jarvis's own backdrop) stays put.
 */

interface ViewCamera {
  view: { enabled: boolean } | null;
  setViewOffset(
    fullWidth: number,
    fullHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  clearViewOffset(): void;
}

/** How quickly it follows, per second: settles in about a third of a second. */
const FOLLOW = 9;

export function useAvatarAside() {
  const hud = useHudStore();
  const { kwami } = useKwami();
  /** Where the figure is drawn now, chasing `hud.avatar`. */
  const now = { x: Number.NaN, y: Number.NaN, scale: 1 };
  let raf = 0;
  let last = 0;

  function camera(): ViewCamera | null {
    const scene = kwami.value?.avatar.getScene?.();
    return (scene?.camera as unknown as ViewCamera | undefined) ?? null;
  }

  function canvasSize(): { w: number; h: number } | null {
    const el = document.getElementById('kwami-canvas');
    return el && el.clientWidth > 0 && el.clientHeight > 0
      ? { w: el.clientWidth, h: el.clientHeight }
      : null;
  }

  function apply(): void {
    const cam = camera();
    const box = canvasSize();
    if (!cam || !box) return;
    const { w, h } = box;
    const centred =
      Math.abs(now.scale - 1) < 1e-3 &&
      Math.abs(now.x - w / 2) < 0.5 &&
      Math.abs(now.y - h / 2) < 0.5;
    if (centred) {
      if (cam.view?.enabled) cam.clearViewOffset();
      return;
    }
    const s = now.scale;
    cam.setViewOffset(w, h, w / 2 - now.x / s, h / 2 - now.y / s, w / s, h / s);
  }

  function step(time: number): void {
    raf = 0;
    const target = hud.avatar;
    if (Number.isNaN(now.x)) {
      const box = canvasSize();
      now.x = box ? box.w / 2 : target.x;
      now.y = box ? box.h / 2 : target.y;
    }
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
    last = time;
    const k = 1 - Math.exp(-dt * FOLLOW);
    now.x += (target.x - now.x) * k;
    now.y += (target.y - now.y) * k;
    now.scale += (target.scale - now.scale) * k;
    const settled =
      Math.abs(target.x - now.x) < 0.5 &&
      Math.abs(target.y - now.y) < 0.5 &&
      Math.abs(target.scale - now.scale) < 0.002;
    if (settled) {
      now.x = target.x;
      now.y = target.y;
      now.scale = target.scale;
    }
    apply();
    if (settled) last = 0;
    else raf = requestAnimationFrame(step);
  }

  function follow(): void {
    if (!raf) raf = requestAnimationFrame(step);
  }

  watch(() => [hud.avatar.x, hud.avatar.y, hud.avatar.scale], follow);
  // The figure is there once the kwami starts; a new one starts in the middle.
  watch(
    kwami,
    () => {
      now.x = Number.NaN;
      follow();
    },
    { immediate: true },
  );
  // The offset is in the canvas's pixels: when it changes size, it is set again (after
  // the scene's own resize, which keeps the old full size).
  watch(
    () => [hud.viewport.width, hud.viewport.height],
    () => requestAnimationFrame(apply),
  );

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    camera()?.clearViewOffset();
  });

  return { apply };
}
