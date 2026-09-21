/**
 * Whether a pointer event on the login screen landed on the avatar mesh,
 * not the empty canvas around it.
 *
 * The welcome canvas is full-bleed with `pointer-events: auto`, so a DOM
 * target check cannot tell "on Kwami" from "on the backdrop". The SDK already
 * raycasts for clicks on the blob; this is the same test, extracted so the
 * page can refuse a background gesture that actually hit the avatar.
 */

import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

const AUTH_CHROME = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tablist"]',
].join(', ');

/** Login chrome: the CTA, the open panel, the soundtrack and preference pills. */
export function isAuthChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(AUTH_CHROME) !== null;
}

export function hitsKwamiMesh(
  clientX: number,
  clientY: number,
  canvas: Pick<HTMLElement, 'getBoundingClientRect'>,
  camera: Camera,
  object: Object3D | null | undefined,
): boolean {
  // The welcome tests hand `getMesh()` a plain object. Raycaster needs a real
  // Object3D; anything else is a miss, not a throw.
  if (!object || typeof object.updateMatrixWorld !== 'function') return false;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  // The render loop normally keeps these current; a hit-test between frames
  // (or in a test that never drew) would otherwise raycast from the identity.
  object.updateMatrixWorld();
  camera.updateMatrixWorld();

  const ndc = new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(object, true).length > 0;
}
