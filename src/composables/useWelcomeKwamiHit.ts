/**
 * Whether a point on the login screen is on the avatar, not the backdrop.
 *
 * `WelcomeBlob` owns the mesh and the camera. `AuthPage` owns the
 * double-click that shuffles the video. They are siblings under `AuthPage`
 * with no props between them, so the hit-test lives here — same pattern as
 * `useWelcomeBackground` and `useWelcomeRandomizer`.
 */

type HitTest = (clientX: number, clientY: number) => boolean;

let hitTest: HitTest | null = null;

export interface WelcomeKwamiHit {
  /** Called from `WelcomeBlob` once the canvas exists; returns an unregister. */
  register: (fn: HitTest) => () => void;
  /** True when that point is on the live avatar mesh. */
  hitsKwami: (clientX: number, clientY: number) => boolean;
}

export function useWelcomeKwamiHit(): WelcomeKwamiHit {
  function register(fn: HitTest) {
    hitTest = fn;
    return () => {
      if (hitTest === fn) hitTest = null;
    };
  }

  function hitsKwami(clientX: number, clientY: number) {
    return hitTest?.(clientX, clientY) ?? false;
  }

  return { register, hitsKwami };
}
