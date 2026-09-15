// Eagle.ts — the great eagle you can find and ride. Flies in a slow
// circle around its perch so it catches your eye, with a faint gold
// point light so it's visible from far away. Once you get within
// 10 units and press F, it becomes a flight creature.

import * as THREE from "three";
import { Geometries } from "../render/Geometries";
import { Materials } from "../render/Materials";

const PERCH_RADIUS = 2.2;
const PERCH_PERIOD_S = 12;

export class Eagle {
  readonly group: THREE.Group;
  private perchCenter: THREE.Vector3;
  private circlePhase = 0;
  private leftWing: THREE.Mesh;
  private rightWing: THREE.Mesh;
  private glow: THREE.PointLight;
  flapPhase = 0;
  isFlying = false;

  constructor() {
    this.perchCenter = new THREE.Vector3(0, 0, 0);
    this.group = new THREE.Group();

    const body = new THREE.Mesh(Geometries.unitBox, Materials.eagle);
    body.scale.set(0.4, 0.5, 1.0);
    this.group.add(body);

    const head = new THREE.Mesh(Geometries.unitBox, Materials.eagle);
    head.scale.set(0.3, 0.3, 0.4);
    head.position.set(0, 0.25, -0.7);
    this.group.add(head);

    const beak = new THREE.Mesh(Geometries.unitBox, Materials.eagleBeak);
    beak.scale.set(0.1, 0.1, 0.3);
    beak.position.set(0, 0.15, -0.95);
    this.group.add(beak);

    const leftWing = new THREE.Mesh(Geometries.unitBox, Materials.eagle);
    leftWing.scale.set(1.6, 0.05, 0.6);
    leftWing.position.set(-1.0, 0.1, 0);
    this.leftWing = leftWing;
    this.group.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.x = 1.0;
    this.rightWing = rightWing;
    this.group.add(rightWing);

    const tail = new THREE.Mesh(Geometries.unitBox, Materials.eagle);
    tail.scale.set(0.2, 0.05, 0.6);
    tail.position.set(0, -0.1, 0.7);
    this.group.add(tail);

    // Gold glow so the eagle is findable from far away.
    this.glow = new THREE.PointLight(0xd4a547, 1.4, 18, 1.5);
    this.glow.position.set(0, 0.2, 0);
    this.group.add(this.glow);
  }

  setPerch(center: THREE.Vector3): void {
    this.perchCenter.copy(center);
    this.group.position.copy(center);
  }

  get perch(): THREE.Vector3 {
    return this.perchCenter;
  }

  fixedUpdate(dt: number, isFlying: boolean, _speed: number): void {
    this.isFlying = isFlying;
    if (isFlying) {
      // When mounted, the MountSystem drives position. We just flap.
      this.flapPhase += dt * 10;
    } else {
      // Slow circle around the perch center so the eagle is animated
      // and easy to spot in the distance.
      this.circlePhase += (dt / PERCH_PERIOD_S) * Math.PI * 2;
      const px = this.perchCenter.x + Math.cos(this.circlePhase) * PERCH_RADIUS;
      const pz = this.perchCenter.z + Math.sin(this.circlePhase) * PERCH_RADIUS;
      this.group.position.set(px, this.perchCenter.y, pz);
      this.group.rotation.y = -this.circlePhase + Math.PI / 2;
      this.flapPhase += dt * 4;
    }
    this.leftWing.rotation.z = 0.1 + Math.sin(this.flapPhase) * 0.5;
    this.rightWing.rotation.z = -0.1 - Math.sin(this.flapPhase) * 0.5;
  }
}
