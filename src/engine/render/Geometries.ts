// Geometries.ts — shared THREE geometries. One BoxGeometry instance
// is reused across every box in the world. The trick is that every
// mesh can share the same geometry AND the same material; the
// transform matrix is the only per-mesh data.

import * as THREE from "three";

export const Geometries = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  unitSphere: new THREE.SphereGeometry(0.5, 8, 6),
  unitCylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  unitCone: new THREE.ConeGeometry(0.5, 1, 8),
  unitPlane: new THREE.PlaneGeometry(1, 1),
  unitDisc: new THREE.CircleGeometry(0.5, 16),
} as const;

// Tile a single PlaneGeometry into a larger flat terrain patch.
export function makeFlatTerrain(size: number, segments: number): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(size, size, segments, segments);
}
