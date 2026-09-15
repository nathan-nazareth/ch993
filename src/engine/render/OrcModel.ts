// OrcModel.ts — runtime side of the downloaded uruk-hai model.
//
// The heavy lifting (decimation, texture atlas, scale normalization)
// happens OFFLINE in scripts/build-orc.ts. Here we only:
//   - fetch a compact binary (~150 KB) and map typed-array views onto
//     it (no parsing, no allocation churn),
//   - render ALL orcs through a single InstancedMesh = 1 draw call
//     (previously ~100 orcs x 9 box meshes = ~900 draw calls),
//   - animate their feet in the vertex shader: the OBJ has no
//     skeleton, so boot-region vertices swing around the ankle with
//     a left/right alternation driven by a per-instance step phase.
//     CPU cost: two floats per orc per frame.

import * as THREE from "three";
import { Materials } from "./Materials";
import type { Enemy } from "../entities/Enemy";

const MAGIC = 0x3143524f; // "ORC1" little-endian
const ORC_BIN = "assets/orc.bin";
const ORC_ATLAS = "assets/orc-atlas.jpg";

export interface OrcAssets {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

// Parse the offline binary. Layout:
//   u32 magic, u32 version, u32 vertCount, u32 indexCount,
//   f32 positions[vertCount*3], f32 normals[vertCount*3],
//   f32 uvs[vertCount*2], u16|u32 indices[indexCount]
function parseOrcBin(buffer: ArrayBuffer): OrcAssets {
  const header = new Uint32Array(buffer, 0, 4);
  if (header[0] !== MAGIC) throw new Error("orc.bin: bad magic");
  if (header[1] !== 1) throw new Error(`orc.bin: unsupported version ${header[1]}`);
  const vertCount = header[2];
  const indexCount = header[3];

  const posOffset = 16;
  const nrmOffset = posOffset + vertCount * 12;
  const uvOffset = nrmOffset + vertCount * 12;
  const idxOffset = uvOffset + vertCount * 8;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(
    new Float32Array(buffer, posOffset, vertCount * 3), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(
    new Float32Array(buffer, nrmOffset, vertCount * 3), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(
    new Float32Array(buffer, uvOffset, vertCount * 2), 2));
  if (vertCount <= 0xffff) {
    geometry.setIndex(new THREE.BufferAttribute(
      new Uint16Array(buffer, idxOffset, indexCount), 1));
  } else {
    geometry.setIndex(new THREE.BufferAttribute(
      new Uint32Array(buffer, idxOffset, indexCount), 1));
  }
  return { geometry, material: new THREE.MeshLambertMaterial({ color: 0xffffff }) };
}

// Plain boxes, used only if the model assets fail to load so the
// game stays playable (headless/test environments, offline, etc).
function fallbackOrcAssets(): OrcAssets {
  const geometry = new THREE.BoxGeometry(0.55, 1.85, 0.4);
  geometry.translate(0, 0.925, 0);
  return { geometry, material: Materials.orc };
}

export async function loadOrcAssets(): Promise<OrcAssets> {
  try {
    const [bin, tex] = await Promise.all([
      fetch(ORC_BIN).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      }),
      new THREE.TextureLoader().loadAsync(ORC_ATLAS),
    ]);
    const assets = parseOrcBin(bin);
    tex.colorSpace = THREE.SRGBColorSpace;
    (assets.material as THREE.MeshLambertMaterial).map = tex;
    assets.material.needsUpdate = true;
    return assets;
  } catch (err) {
    console.warn("orc model unavailable, using box fallback:", err);
    return fallbackOrcAssets();
  }
}

// Renders every enemy through one InstancedMesh. Per frame we compose
// one 4x4 matrix and write two floats per orc — the cheapest possible
// CPU profile for ~100 visible characters.
export class OrcRenderer {
  readonly mesh: THREE.InstancedMesh;
  private readonly step: THREE.InstancedBufferAttribute;
  private readonly dummy = new THREE.Object3D();
  private readonly dead = new Set<number>();

  constructor(assets: OrcAssets, count: number) {
    this.step = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    assets.geometry.setAttribute("aStep", this.step);

    const material = assets.material as THREE.MeshLambertMaterial;
    this.injectFootSwing(material);

    this.mesh = new THREE.InstancedMesh(assets.geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }

  // Vertex-shader foot swing for a static (unrigged) mesh: vertices in
  // the boot region rotate around an ankle pivot, left and right foot
  // half a cycle apart. Weights fade out below the knee so there is no
  // visible seam. Driven entirely by the per-instance (phase, speed).
  private injectFootSwing(material: THREE.MeshLambertMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute vec2 aStep;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* glsl */ `
        vec3 transformed = vec3( position );
        {
          float w = 1.0 - smoothstep(0.06, 0.20, position.y);
          float side = position.x >= 0.0 ? 1.0 : -1.0;
          float ang = sin(aStep.x + side * 3.14159) * 0.45 * w * aStep.y;
          float c = cos(ang), s = sin(ang);
          float py = transformed.y - 0.10; // ankle pivot
          transformed.y = 0.10 + c * py - s * transformed.z;
          transformed.z = s * py + c * transformed.z;
        }
        `,
      );
    };
    material.customProgramCacheKey = () => "orc-foot-swing";
  }

  update(enemies: Enemy[]): void {
    const dummy = this.dummy;
    dummy.rotation.order = "YXZ";
    let dirty = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      // Dead orcs don't move; leave their matrix and step attributes
      // alone (we set them on the death frame).
      if (e.isDead() && this.dead.has(i)) continue;
      if (e.isDead()) this.dead.add(i);
      // Root holds world position (and the tip-over on death); body
      // holds facing yaw, attack lean, and the walk bob.
      dummy.position.copy(e.group.position);
      dummy.position.y += e.body.position.y;
      dummy.rotation.set(
        e.isDead() ? e.group.rotation.x : e.body.rotation.x,
        e.body.rotation.y,
        0,
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.step.setXY(i, e.stepPhase, e.isChasing() ? 1 : 0);
      dirty = true;
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.step.needsUpdate = true;
    }
  }
}
