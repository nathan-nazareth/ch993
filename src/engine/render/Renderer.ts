// Renderer.ts — Three.js renderer with CPU-first defaults.
//
// Caps devicePixelRatio (high DPI is the single biggest perf killer on
// no-GPU machines), uses simple unlit/lambert materials, and a fog that
// hides distant geometry so the scene stays cheap. Written from scratch
// for this project, not copied from the star-wars renderer.

import * as THREE from "three";

const DPR_CAP = 1.0;

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
    });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    this.three.setSize(window.innerWidth, window.innerHeight, false);
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.NoToneMapping;

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
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
