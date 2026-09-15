// build-orc.ts — offline pipeline that turns the downloaded uruk-hai
// OBJ + Sketchfab textures into a compact, CPU-friendly game asset.
//
//   bun run build:orc [sourceDir]
//
// What it does (all OFFLINE, so the runtime does near-zero work):
//   1. Parses Posed.obj into per-material triangle sections.
//   2. Strips baked-in display floors (flat, huge-x sections).
//   3. Decimates ~166k tris down to ~12k with meshoptimizer.
//   4. Packs the 4 base-color textures (2048px each) into one
//      1024px atlas, remapping UVs into quadrants.
//   5. Normalizes scale: height 2.05 units, feet at y=0, centered.
//   6. Writes public/assets/orc.bin + public/assets/orc-atlas.png.
//
// Result at runtime: ONE geometry, ONE material, ONE texture for all
// ~100 orcs, rendered as a single InstancedMesh (1 draw call total,
// was ~900). Binary load = typed-array views, no text parsing.

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as THREE from "three";
import { MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2] ?? "assets-src";
const OUT_DIR = "public/assets";
const TARGET_HEIGHT = 2.05;
const TARGET_TRIS = 12_000;

// Section name -> base-color texture file. Derived from the archive's
// naming: each material has a matching texture set; "Skin" is the
// leftover "_MergeddefaultMat" (the first/default material).
const TEXTURE_MAP: Record<string, string> = {
  Skin: "_MergeddefaultMat_Base_Color.png",
  _MergeddefaultMat2: "_MergeddefaultMat2_Base_Color.png",
  _MergeddefaultMat23: "_MergeddefaultMat23_Base_Color.tga.png",
  Weapons: "Weapons_Base_Color.png",
};
const QUADRANT_ORDER = Object.keys(TEXTURE_MAP); // [Skin, Mat2, Mat23, Weapons]

interface Section {
  name: string;
  pos: number[]; // xyz
  uv: number[];  // uv
  idx: number[]; // triangle indices
  // Weld map: OBJ faces reference (vertex, texcoord) index pairs;
  // identical pairs are the same output vertex. Welding gives the
  // simplifier shared borders to collapse (without it every vertex
  // is a border vertex and LockBorder forbids all decimation).
  weld: Map<string, number>;
}

function parseObj(file: string): Section[] {
  const text = fs.readFileSync(file, "utf8");
  const vx: number[] = [], vy: number[] = [], vz: number[] = [];
  const tu: number[] = [], tv: number[] = [];
  const sections: Section[] = [];
  const byName = new Map<string, Section>();
  let cur: Section | null = null;
  let droppedFaces = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const p = line.split(/\s+/); // 3ds Max export uses double spaces
      vx.push(+p[1]); vy.push(+p[2]); vz.push(+p[3]);
    } else if (line.startsWith("vt ")) {
      const p = line.split(/\s+/);
      tu.push(+p[1]); tv.push(+p[2]);
    } else if (line.startsWith("usemtl ")) {
      cur = sectionFor(byName, sections, line.slice(7).trim());
    } else if (line.startsWith("f ") && cur) {
      const refs = line.slice(2).split(/\s+/);
      // OBJ indices can be negative (relative); this export is positive.
      const vi = refs.map(r => parseInt(r.split("/")[0], 10) - 1);
      const ti = refs.map(r => {
        const t = r.split("/")[1];
        return t ? parseInt(t, 10) - 1 : -1;
      });
      // Fan-triangulate the (usually quad) polygon, welding vertices.
      for (let i = 1; i + 1 < vi.length; i++) {
        for (const k of [0, i, i + 1]) {
          const key = `${vi[k]}/${ti[k]}`;
          let n = cur.weld.get(key);
          if (n === undefined) {
            n = cur.pos.length / 3;
            cur.weld.set(key, n);
            cur.pos.push(vx[vi[k]], vy[vi[k]], vz[vi[k]]);
            cur.uv.push(ti[k] >= 0 ? tu[ti[k]] : 0, ti[k] >= 0 ? tv[ti[k]] : 0);
          }
          cur.idx.push(n);
        }
      }
      if (vi.length > 3) droppedFaces++;
    }
  }
  void droppedFaces;
  return sections;
}

// The OBJ switches usemtl back and forth (Skin, Mat2, Skin, ...) —
// merge blocks that share a material name so each material is one
// vertex stream, one atlas quadrant, one decimation run.
function sectionFor(byName: Map<string, Section>, sections: Section[], name: string): Section {
  let s = byName.get(name);
  if (!s) {
    s = { name, pos: [], uv: [], idx: [], weld: new Map() };
    byName.set(name, s);
    sections.push(s);
  }
  return s;
}

function sectionSpans(s: Section) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (let i = 0; i < s.pos.length; i += 3) {
    const x = s.pos[i], y = s.pos[i + 1];
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return { x: maxx - minx, y: maxy - miny };
}

async function decimate(s: Section, targetTris: number): Promise<Section> {
  const srcIdx = new Uint32Array(s.idx);
  const srcPos = new Float32Array(s.pos);
  const [newIdx] = MeshoptSimplifier.simplify(
    srcIdx, srcPos, 3, targetTris * 3, 0.05, ["LockBorder"],
  );
  // Compact: keep only vertices still referenced.
  const remap = new Map<number, number>();
  const out: Section = { name: s.name, pos: [], uv: [], idx: [], weld: new Map() };
  for (const old of newIdx) {
    let n = remap.get(old);
    if (n === undefined) {
      n = out.pos.length / 3;
      remap.set(old, n);
      out.pos.push(s.pos[old * 3], s.pos[old * 3 + 1], s.pos[old * 3 + 2]);
      out.uv.push(s.uv[old * 2], s.uv[old * 2 + 1]);
    }
    out.idx.push(n);
  }
  return out;
}

async function main() {
  await MeshoptSimplifier.ready;
  const objFile = path.join(SRC, "Posed.obj");
  if (!fs.existsSync(objFile)) throw new Error(`missing ${objFile} — pass the extraction dir as argv[1]`);

  // 1) Parse + 2) strip floors.
  const all = parseObj(objFile);
  const keep: Section[] = [];
  for (const s of all) {
    const spans = sectionSpans(s);
    const isFloor = spans.x > 100 && spans.x > 2.5 * spans.y;
    console.log(`${isFloor ? "STRIP" : "keep "}  ${s.name.padEnd(34)} x-span ${spans.x.toFixed(0).padStart(5)}  tris ${(s.idx.length / 3).toLocaleString()}`);
    if (!isFloor) keep.push(s);
  }
  const totalTris = keep.reduce((n, s) => n + s.idx.length / 3, 0);

  // 3) Decimate proportionally to the section size.
  const simplified: Section[] = [];
  for (const s of keep) {
    const share = (s.idx.length / 3) / totalTris;
    const target = Math.max(64, Math.round(TARGET_TRIS * share / 3) * 3);
    simplified.push(await decimate(s, target));
  }

  // Facing heuristic: weapons centroid z vs whole-body centroid z.
  // (Weapons are held in front on this model; printed for reference.)
  const weapons = simplified.find(s => s.name === "Weapons")!;
  let wz = 0;
  for (let i = 2; i < weapons.pos.length; i += 3) wz += weapons.pos[i];
  wz /= weapons.pos.length / 3;
  let bz = 0, bn = 0;
  for (const s of simplified) for (let i = 2; i < s.pos.length; i += 3) { bz += s.pos[i]; bn++; }
  console.log(`weapons z-centroid ${wz.toFixed(2)} vs body ${(bz / bn).toFixed(2)} (positive = model faces +z)`);

  // 4) UV -> atlas quadrants (2x2).
  simplified.forEach((s, i) => {
    const qx = i % 2, qy = Math.floor(i / 2);
    for (let u = 0; u < s.uv.length; u += 2) {
      s.uv[u] = (s.uv[u] + qx) / 2;
      s.uv[u + 1] = (s.uv[u + 1] + qy) / 2;
    }
  });

  // 5) Normalize: model bbox (post-floor-strip), feet at 0, centered.
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const s of simplified) for (let i = 0; i < s.pos.length; i += 3) {
    const x = s.pos[i], y = s.pos[i + 1], z = s.pos[i + 2];
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
    if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const scale = TARGET_HEIGHT / (maxy - miny);
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
  for (const s of simplified) for (let i = 0; i < s.pos.length; i += 3) {
    s.pos[i] = (s.pos[i] - cx) * scale;
    s.pos[i + 1] = (s.pos[i + 1] - miny) * scale;
    s.pos[i + 2] = (s.pos[i + 2] - cz) * scale;
  }

  // Merge sections into one indexed geometry, compute smooth normals
  // offline so the runtime loader stays dumb.
  let pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const s of simplified) {
    const base = pos.length / 3;
    pos = pos.concat(s.pos);
    uv = uv.concat(s.uv);
    idx = idx.concat(s.idx.map(i => i + base));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // 6) Emit binary. Header: magic, version, vertCount, idxCount.
  // (Typed-array rule used below: `new Uint8Array(f32)` converts
  // element-wise (floats -> bytes, garbage); a byte view needs
  // .buffer/.byteOffset/.byteLength.)
  const asBytes = (a: Float32Array) =>
    new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const vertCount = pos.length / 3, idxCount = idx.length;
  const indexArray = vertCount <= 0xffff ? new Uint16Array(idx) : new Uint32Array(idx);
  const header = new ArrayBuffer(16);
  new Uint32Array(header).set([0x3143524f /* "ORC1" LE */, 1, vertCount, idxCount]);
  const normalAttr = geo.getAttribute("normal") as THREE.BufferAttribute;
  const blob = [
    new Uint8Array(header),
    asBytes(geo.getAttribute("position").array as Float32Array),
    asBytes(normalAttr.array as Float32Array),
    asBytes(new Float32Array(uv)),
    new Uint8Array(indexArray.buffer),
  ];
  const binPath = path.join(OUT_DIR, "orc.bin");
  fs.writeFileSync(binPath, Buffer.concat(blob.map(b => Buffer.from(b))));

  // 4b) Atlas via ImageMagick: 4 x 512 -> 1024, quadrant (qx,qy)
  // pasted so it lands at UV (qx,qy) with three.js flipY textures.
  // (execFileSync = no shell, so no escaped parens; resize each
  // texture to a temp file, then composite them one by one.)
  const atlasPath = path.join(OUT_DIR, "orc-atlas.jpg");
  const args = ["-size", "1024x1024", "xc:black"];
  const tmpQuads: string[] = [];
  simplified.forEach((s, i) => {
    const tex = TEXTURE_MAP[s.name] ?? TEXTURE_MAP[QUADRANT_ORDER[i]];
    const qx = i % 2, qy = Math.floor(i / 2);
    const px = qx * 512, py = 1024 - (qy + 1) * 512;
    const tmp = path.join("/tmp", `orc-quad-${i}.png`);
    execFileSync("convert", [path.join(SRC, "textures", tex), "-resize", "512x512", tmp]);tmpQuads.push(tmp);
    args.push(tmp, "-geometry", `+${px}+${py}`, "-composite");
  });
  args.push("-quality", "88", atlasPath);
  execFileSync("convert", args, { stdio: "inherit" });
  for (const t of tmpQuads) fs.unlinkSync(t);

  const outTris = idxCount / 3;
  console.log(
    `\ndone: ${vertCount.toLocaleString()} verts, ${outTris.toLocaleString()} tris ` +
    `(was ${totalTris.toLocaleString()}), orc.bin ${fs.statSync(binPath).size.toLocaleString()}B, ` +
    `atlas ${fs.statSync(atlasPath).size.toLocaleString()}B`,
  );
}

main();
