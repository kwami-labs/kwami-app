import { IcosahedronGeometry, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyRoundedBlobGeometry,
  createRoundedBlobGeometry,
  icosahedronDetailForResolution,
} from '../../src/utils/blobGeometry';

describe('icosahedronDetailForResolution', () => {
  it('maps the app slider onto even subdivisions instead of pole meridians', () => {
    expect(icosahedronDetailForResolution(32)).toBe(4);
    expect(icosahedronDetailForResolution(160)).toBe(5);
    expect(icosahedronDetailForResolution(220)).toBe(6);
  });
});

describe('createRoundedBlobGeometry', () => {
  it('builds an icosahedron, which has no poles to pinch into a pyramid', () => {
    const geometry = createRoundedBlobGeometry(160);
    expect(geometry).toBeInstanceOf(IcosahedronGeometry);
    expect((geometry as IcosahedronGeometry).parameters.detail).toBe(5);
    geometry.dispose();
  });
});

describe('applyRoundedBlobGeometry', () => {
  it('replaces a SphereGeometry body so the poles cannot become a triangle', () => {
    const mesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshBasicMaterial());
    applyRoundedBlobGeometry(mesh, 160);

    expect(mesh.geometry).toBeInstanceOf(IcosahedronGeometry);
    expect((mesh.geometry as IcosahedronGeometry).parameters.detail).toBe(5);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('ignores a stub mesh with no geometry, which is what the welcome tests hand it', () => {
    expect(() => applyRoundedBlobGeometry({} as Mesh, 160)).not.toThrow();
    expect(() => applyRoundedBlobGeometry(null, 160)).not.toThrow();
  });

  it('leaves an already-matching icosahedron alone, so a tick does not rebuild it', () => {
    const mesh = new Mesh(new IcosahedronGeometry(1, 5), new MeshBasicMaterial());
    const before = mesh.geometry;
    applyRoundedBlobGeometry(mesh, 160);

    expect(mesh.geometry).toBe(before);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
