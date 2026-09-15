// Renderer.ts — Three.js renderer with CPU-first defaults.
//
// Caps devicePixelRatio (high DPI is the single biggest perf killer on
// no-GPU machines), uses simple unlit/lambert materials, and a fog that
// hides distant geometry so the scene stays cheap. Written from scratch
// for this project, not copied from the star-wars renderer.
//
// Power-preference: "low-power" hints the browser to use the
// integrated GPU (or software fallback) instead of the discrete GPU.
// This is the explicit "no GPU" path: no WebGL2, no MSAA, no shadows,
// no post-processing.

import * as THREE from "three";

const DPR_CAP = 1.0;
const FAR_FOG = 220;
const NEAR_FOG = 60;

export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, private scene: THREE.Scene) {
    this.three = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "low-power",
      stencil: false,
      depth: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    this.three.setSize(window.innerWidth, window.innerHeight, false);
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.NoToneMapping;
    this.three.shadowMap.enabled = false;
    this.three.autoClear = true;

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      FAR_FOG + 60,
    );
    this.camera.position.set(0, 4, 12);
    this.camera.lookAt(0, 1, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  render(): void {
    this.three.render(this.scene, this.camera);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.three.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.three.dispose();
  }
}

export { FAR_FOG, NEAR_FOG };