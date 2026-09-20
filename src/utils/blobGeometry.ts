import { IcosahedronGeometry, type BufferGeometry, type Mesh } from 'three';

/**
 * SphereGeometry pinches every meridian into two poles. Once the blob
 * displaces those vertices the silhouette becomes a cone or a pyramid —
 * the triangle body the login screen was showing. An icosahedron has even
 * triangles and no poles, so the same displacement stays a rounded drop.
 *
 * `resolution` is the SphereGeometry segment count the rest of the app
 * still talks in. Mapped to icosahedron subdivisions rather than used
 * as-is: detail 5 is the gelatine default (~20k tris), 6 is the high
 * slider end.
 */
export function icosahedronDetailForResolution(resolution: number): number {
  if (resolution >= 220) return 6;
  if (resolution >= 72) return 5;
  return 4;
}

export function createRoundedBlobGeometry(resolution = 180): BufferGeometry {
  return new IcosahedronGeometry(1, icosahedronDetailForResolution(resolution));
}

type BlobMesh = Pick<Mesh, 'geometry'>;

export function applyRoundedBlobGeometry(
  mesh: BlobMesh | undefined | null,
  resolution = 180,
  detail = icosahedronDetailForResolution(resolution),
): void {
  if (!mesh?.geometry) return;
  const current = mesh.geometry as BufferGeometry & {
    type?: string;
    parameters?: { detail?: number };
    dispose?: () => void;
  };
  if (current.type === 'IcosahedronGeometry' && current.parameters?.detail === detail) {
    return;
  }

  const next = createRoundedBlobGeometry(resolution);
  current.dispose();
  mesh.geometry = next;
}
