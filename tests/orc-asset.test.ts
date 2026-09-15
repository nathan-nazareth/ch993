// orc-asset.test.ts — validates the built uruk-hai asset produced by
// scripts/build-orc.ts. If someone re-runs the pipeline with settings
// that break normalization, balloon the triangle budget, or corrupt
// the binary, this goes red before the game ever loads it.
//
// Run with: bun test

import * as fs from "node:fs";
import { test, expect } from "bun:test";

const MAGIC = 0x3143524f; // "ORC1" little-endian

function loadOrcBin() {
  const buffer = fs.readFileSync("public/assets/orc.bin");
  const bytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const header = new Uint32Array(bytes, 0, 4);
  expect(header[0]).toBe(MAGIC);
  expect(header[1]).toBe(1);
  const vertCount = header[2];
  const indexCount = header[3];
  const positions = new Float32Array(bytes, 16, vertCount * 3);
  const indices =
    vertCount <= 0xffff
      ? new Uint16Array(bytes, 16 + vertCount * 32, indexCount)
      : new Uint32Array(bytes, 16 + vertCount * 32, indexCount);
  return { vertCount, indexCount, positions, indices };
}

test("orc.bin is a well-formed, normalized mesh", () => {
  const { vertCount, indexCount, positions, indices } = loadOrcBin();

  // Triangle budget: the whole point of the offline decimation.
  expect(indexCount % 3).toBe(0);
  expect(indexCount / 3).toBeLessThanOrEqual(15_000);

  // Geometry sanity: feet on y=0, orc-height ~2.05 (matches the old
  // box orc), centered and thin in depth, no NaNs.
  let miny = Infinity, maxy = -Infinity, minx = Infinity, maxx = -Infinity;
  let minz = Infinity, maxz = -Infinity, nan = false;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (Number.isNaN(x + y + z)) nan = true;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  expect(nan).toBe(false);
  expect(miny).toBeGreaterThanOrEqual(-0.01);
  expect(maxy).toBeCloseTo(2.05, 1);
  expect(maxx - minx).toBeLessThan(3.0); // posed figure, weapon arm out (floor would be ~6+)
  expect(maxz - minz).toBeLessThan(2.0); // weapon thrust forward (floor would be flat & huge)

  // Every index points at a real vertex.
  for (let i = 0; i < indices.length; i++) {
    expect(indices[i]).toBeLessThan(vertCount);
  }
});

test("orc atlas exists and is a JPEG", () => {
  const buf = fs.readFileSync("public/assets/orc-atlas.jpg");
  expect(buf.length).toBeGreaterThan(10_000);
  expect(buf[0]).toBe(0xff); // JPEG SOI
  expect(buf[1]).toBe(0xd8);
});
