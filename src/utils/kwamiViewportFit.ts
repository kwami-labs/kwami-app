/**
 * Keep the 3D kwami in the middle of its canvas, and small enough to fit.
 *
 * The SDK camera is a 100° perspective sitting at z=6. On a wide desktop that
 * frames a blob of scale 3.5 with room to spare. On a portrait phone the same
 * blob is wider than the frustum, so it reads as clipped or off-centre even
 * when its origin is at (0, 0). Fitting against the shorter visible side and
 * resetting the blob's normalized position to (0.5, 0.5) is the one move that
 * keeps every canvas — login and workspace — looking at the same companion.
 */

/** Matches `createCamera` in the SDK (`fov || 100`, `cameraPosition.z || 6`). */
export const KWAMI_CAMERA_FOV_DEG = 100;
export const KWAMI_CAMERA_DISTANCE = 6;

/** Desktop hero sizes the login screen already used on a wide viewport. */
export const HERO_BLOB_SCALE = 3.5;
export const HERO_EYE_SCALE = 4.2;

/**
 * How much of the shorter visible side the avatar may fill.
 *
 * Below 1 so spikes and the eye limbus stay inside the frame. 0.72 is the
 * largest fill that still leaves a gutter on a 390×844 phone at these camera
 * numbers; desktop never hits the cap because 3.5 already sits inside it.
 */
export const HERO_FILL = 0.72;

export type KwamiHeroRenderer = 'blob-xyz' | 'eye-iris';

export function visibleWorldSize(
  width: number,
  height: number,
  fovDeg: number = KWAMI_CAMERA_FOV_DEG,
  distance: number = KWAMI_CAMERA_DISTANCE,
): { width: number; height: number } {
  const safeHeight = Math.max(1, height);
  const visibleHeight = 2 * Math.tan((fovDeg * Math.PI) / 180 / 2) * distance;
  const visibleWidth = visibleHeight * (Math.max(1, width) / safeHeight);
  return { width: visibleWidth, height: visibleHeight };
}

export function heroScaleForViewport(
  width: number,
  height: number,
  renderer: KwamiHeroRenderer = 'blob-xyz',
): number {
  const world = visibleWorldSize(width, height);
  const shortest = Math.min(world.width, world.height);
  const maxScale = (shortest * HERO_FILL) / 2;
  const desktop = renderer === 'eye-iris' ? HERO_EYE_SCALE : HERO_BLOB_SCALE;
  return Math.min(desktop, maxScale);
}

export function measureKwamiCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const parent = canvas.parentElement;
  const width = parent?.clientWidth || canvas.clientWidth || window.innerWidth;
  const height = parent?.clientHeight || canvas.clientHeight || window.innerHeight;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

export interface FitKwamiAvatar {
  getScene?: () => { resize?: (width: number, height: number) => void } | null;
  getBlob?: () => {
    position?: { reset?: () => unknown; refresh?: () => unknown };
    setScale?: (scale: number) => void;
  } | null;
  getEyeIris?: () => { setScale?: (scale: number) => void } | null;
  setScale?: (scale: number) => void;
}

export interface FitKwamiInstance {
  avatar: FitKwamiAvatar;
}

export interface FitKwamiOptions {
  renderer?: KwamiHeroRenderer;
  /** Stored / preferred scale. Live size is the smaller of this and the fit. */
  desiredScale?: number;
}

/**
 * Resize the scene, pin the mesh to the canvas centre, and cap the scale so
 * the avatar stays fully visible.
 */
export function fitKwamiInView(
  kwami: FitKwamiInstance,
  canvas: HTMLCanvasElement,
  options: FitKwamiOptions = {},
): { width: number; height: number; scale: number } {
  const { width, height } = measureKwamiCanvas(canvas);
  kwami.avatar.getScene?.()?.resize?.(width, height);

  const renderer = options.renderer ?? 'blob-xyz';
  const fitted = heroScaleForViewport(width, height, renderer);
  const scale = options.desiredScale == null ? fitted : Math.min(options.desiredScale, fitted);

  if (renderer === 'eye-iris') {
    kwami.avatar.getEyeIris?.()?.setScale?.(scale);
  } else {
    kwami.avatar.setScale?.(scale);
    const position = kwami.avatar.getBlob?.()?.position;
    position?.reset?.();
    position?.refresh?.();
  }

  return { width, height, scale };
}
