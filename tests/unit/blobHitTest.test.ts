/**
 * Distinguishing a click on the login avatar from one on the empty canvas.
 *
 * The welcome canvas is full-bleed, so the DOM target is the canvas either
 * way. These are the two predicates AuthPage uses before it will shuffle the
 * backdrop: chrome (leave it alone) and a real mesh hit (the SDK's gesture).
 */
import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, SphereGeometry } from 'three';
import { hitsKwamiMesh, isAuthChromeTarget } from '@/utils/blobHitTest';

function canvasAt(width: number, height: number) {
  return {
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  };
}

describe('isAuthChromeTarget', () => {
  it('ignores the empty backdrop', () => {
    const page = document.createElement('div');
    page.className = 'page';

    expect(isAuthChromeTarget(page)).toBe(false);
    expect(isAuthChromeTarget(null)).toBe(false);
  });

  it('treats the login button and an open panel as chrome', () => {
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    panel.appendChild(button);
    document.body.appendChild(panel);

    expect(isAuthChromeTarget(button)).toBe(true);
    expect(isAuthChromeTarget(panel)).toBe(true);

    panel.remove();
  });
});

describe('hitsKwamiMesh', () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 5;
  camera.updateProjectionMatrix();
  const mesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshBasicMaterial());
  const canvas = canvasAt(200, 200);

  it('hits the center of a sphere sitting in front of the camera', () => {
    expect(hitsKwamiMesh(100, 100, canvas, camera, mesh)).toBe(true);
  });

  it('misses a corner that sees only empty space', () => {
    expect(hitsKwamiMesh(0, 0, canvas, camera, mesh)).toBe(false);
  });

  it('misses when there is no mesh, rather than throwing', () => {
    expect(hitsKwamiMesh(100, 100, canvas, camera, null)).toBe(false);
    expect(hitsKwamiMesh(100, 100, canvas, camera, { rotation: {} } as never)).toBe(false);
  });
});
