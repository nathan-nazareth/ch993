// NPC.ts — a non-player character. Body, name, head, idle bob.

import * as THREE from "three";
import { Geometries } from "../render/Geometries";
import { Materials } from "../render/Materials";

export interface NPCDef {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export class NPC {
  readonly group: THREE.Group;
  readonly id: string;
  readonly name: string;
  private body: THREE.Group;
  private head: THREE.Mesh;
  private bobPhase = Math.random() * Math.PI * 2;

  constructor(def: NPCDef) {
    this.id = def.id;
    this.name = def.name;
    this.group = new THREE.Group();
    this.group.position.set(def.x, def.y, def.z);
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = new THREE.Mesh(Geometries.unitBox, this.pickClothing());
    torso.scale.set(0.6, 0.9, 0.35);
    torso.position.y = 1.25;
    this.body.add(torso);

    const head = new THREE.Mesh(Geometries.unitBox, Materials.hobbitSkin);
    head.scale.set(0.35, 0.35, 0.35);
    head.position.y = 1.95;
    this.head = head;
    this.body.add(head);

    const armMat = this.pickClothing();
    const leftArm = new THREE.Mesh(Geometries.unitBox, armMat);
    leftArm.scale.set(0.16, 0.7, 0.2);
    leftArm.position.set(-0.4, 1.3, 0);
    this.body.add(leftArm);
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.4;
    this.body.add(rightArm);

    const legMat = Materials.clothingBlue;
    const leftLeg = new THREE.Mesh(Geometries.unitBox, legMat);
    leftLeg.scale.set(0.2, 0.7, 0.22);
    leftLeg.position.set(-0.16, 0.35, 0);
    this.body.add(leftLeg);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.16;
    this.body.add(rightLeg);
  }

  fixedUpdate(_dt: number): void {
    this.bobPhase += _dt;
  }

  update(_dt: number): void {
    this.body.position.y = Math.sin(this.bobPhase * 1.4) * 0.04;
    this.body.rotation.y = Math.sin(this.bobPhase * 0.4) * 0.15;
  }

  faceTowards(target: THREE.Vector3): void {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    this.body.rotation.y = Math.atan2(dx, dz);
  }

  private pickClothing(): THREE.MeshLambertMaterial {
    const r = Math.random();
    if (r < 0.33) return Materials.clothingRed;
    if (r < 0.66) return Materials.clothingBlue;
    return Materials.clothingGreen;
  }
}
