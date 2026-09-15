// Horse.ts — the player's starting mount. Procedural horse.

import * as THREE from "three";
import { Geometries } from "../render/Geometries";
import { Materials } from "../render/Materials";

export class Horse {
  readonly group: THREE.Group;
  private body: THREE.Group;
  private legs: THREE.Mesh[] = [];
  walkPhase = 0;

  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = new THREE.Mesh(Geometries.unitBox, Materials.horse);
    torso.scale.set(1.4, 0.8, 0.5);
    torso.position.y = 1.5;
    this.body.add(torso);

    const neck = new THREE.Mesh(Geometries.unitBox, Materials.horse);
    neck.scale.set(0.4, 0.9, 0.4);
    neck.position.set(0.5, 2.1, 0);
    neck.rotation.z = -Math.PI / 4;
    this.body.add(neck);

    const head = new THREE.Mesh(Geometries.unitBox, Materials.horse);
    head.scale.set(0.35, 0.35, 0.35);
    head.position.set(0.85, 2.45, 0);
    this.body.add(head);

    const tail = new THREE.Mesh(Geometries.unitBox, Materials.horse);
    tail.scale.set(0.12, 0.4, 0.12);
    tail.position.set(-0.7, 1.7, 0);
    tail.rotation.z = 0.3;
    this.body.add(tail);

    const legPositions: Array<[number, number, number]> = [
      [0.5, 0.5, 0.18],
      [0.5, 0.5, -0.18],
      [-0.5, 0.5, 0.18],
      [-0.5, 0.5, -0.18],
    ];
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(Geometries.unitBox, Materials.horse);
      leg.scale.set(0.18, 1.0, 0.18);
      leg.position.set(x, y, z);
      this.body.add(leg);
      this.legs.push(leg);
    }
  }

  fixedUpdate(dt: number, speed: number): void {
    this.walkPhase += dt * (speed > 0.1 ? 10 : 0);
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.7;
    this.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.7;
    this.legs[2].rotation.x = -Math.sin(this.walkPhase) * 0.7;
    this.legs[3].rotation.x = Math.sin(this.walkPhase) * 0.7;
  }
}
