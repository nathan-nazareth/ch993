// Materials.ts — small palette of shared materials for the world.
//
// All materials are MeshLambertMaterial (cheap, unlit-ish, GPU-friendly
// even on software fallback). Materials are defined once and reused
// across every mesh in the world. This is the standard CPU-first 3D
// trick: the same shader is bound once per draw call.

import * as THREE from "three";

export const Materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x4f7a3e }),
  grassDark: new THREE.MeshLambertMaterial({ color: 0x3a5a2c }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x6b4a32 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8a8478 }),
  stoneDark: new THREE.MeshLambertMaterial({ color: 0x4a4640 }),
  tree: new THREE.MeshLambertMaterial({ color: 0x3d5a2a }),
  treeTrunk: new THREE.MeshLambertMaterial({ color: 0x4a3826 }),
  water: new THREE.MeshLambertMaterial({ color: 0x4a6a8a, transparent: true, opacity: 0.7 }),
  sky: new THREE.MeshBasicMaterial({ color: 0x87a8c0, side: THREE.BackSide }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4a2e }),
  thatch: new THREE.MeshLambertMaterial({ color: 0xa08458 }),
  horse: new THREE.MeshLambertMaterial({ color: 0x4a2e1a }),
  eagle: new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  eagleBeak: new THREE.MeshLambertMaterial({ color: 0xd4a547 }),
  orc: new THREE.MeshLambertMaterial({ color: 0x4a5a3a }),
  hobbitSkin: new THREE.MeshLambertMaterial({ color: 0xd4a888 }),
  elfSkin: new THREE.MeshLambertMaterial({ color: 0xe0c8a8 }),
  dwarfSkin: new THREE.MeshLambertMaterial({ color: 0xc8a888 }),
  clothingRed: new THREE.MeshLambertMaterial({ color: 0x8a2e2e }),
  clothingBlue: new THREE.MeshLambertMaterial({ color: 0x2e4a6a }),
  clothingGreen: new THREE.MeshLambertMaterial({ color: 0x3a6a4a }),
  swordBlade: new THREE.MeshLambertMaterial({ color: 0xc8d8e0 }),
  swordHilt: new THREE.MeshLambertMaterial({ color: 0x4a2e1a }),
  bow: new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  arrow: new THREE.MeshLambertMaterial({ color: 0x8a6a3a }),
  eyeRed: new THREE.MeshLambertMaterial({ color: 0xc53030, emissive: 0x4a1010 }),
} as const;

Object.freeze(Materials);
