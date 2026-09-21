/**
 * How often the login blob puts its skin in wireframe.
 *
 * Seven solid rolls, then one wireframe — the screen used to force
 * `setWireframe(false)` on every tick, so the mode never appeared.
 */
export const WIREFRAME_PER_NORMAL = 7;

/**
 * True on one roll in eight (`1 / (7 + 1)`).
 *
 * The high end of `random()` is the wireframe so a test that pins
 * `Math.random` at 0 (to keep the renderer on blob-xyz) still lands on a
 * solid skin.
 */
export function pickWelcomeWireframe(random: () => number = Math.random): boolean {
  return random() >= WIREFRAME_PER_NORMAL / (WIREFRAME_PER_NORMAL + 1);
}
