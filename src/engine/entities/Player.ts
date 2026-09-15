// Player.ts — the hero. Third-person character, walks, runs, attacks.
//
// The player is a small group of boxes (head, torso, arms, legs) with
// the current weapon attached. Walk direction is camera-relative.
// Stamina drains while running, regens while walking or idle.

import * as THREE from "three";
import { Geometries } from "../render/Geometries";
import { Materials } from "../render/Materials";
import { Input } from "../core/Input";
import { AudioBus } from "../core/Audio";
import { World } from "../world/World";

const WALK_SPEED = 4.0;
const RUN_SPEED = 8.0;

export class Player {
  readonly group: THREE.Group;
  body: THREE.Group;
  private weaponMesh: THREE.Group;
  private sword: THREE.Mesh;
  private bow: THREE.Mesh;
  private bowVisible = false;
  private torso: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private head: THREE.Mesh;

  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  velocity: THREE.Vector3 = new THREE.Vector3();
  yaw = 0;
  walkPhase = 0;
  swingPhase = 0;

  constructor(
    private world: World,
    private input: Input,
    private audio: AudioBus,
  ) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.weaponMesh = new THREE.Group();
    this.group.add(this.body);
    this.body.add(this.weaponMesh);

    const torso = new THREE.Mesh(Geometries.unitBox, Materials.clothingGreen);
    torso.scale.set(0.6, 0.9, 0.35);
    torso.position.y = 1.25;
    this.torso = torso;

    const head = new THREE.Mesh(Geometries.unitBox, Materials.hobbitSkin);
    head.scale.set(0.4, 0.4, 0.4);
    head.position.y = 1.95;
    this.head = head;

    const leftLeg = new THREE.Mesh(Geometries.unitBox, Materials.clothingBlue);
    leftLeg.scale.set(0.22, 0.9, 0.25);
    leftLeg.position.set(-0.18, 0.45, 0);
    this.leftLeg = leftLeg;

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    this.rightLeg = rightLeg;

    const leftArm = new THREE.Mesh(Geometries.unitBox, Materials.clothingGreen);
    leftArm.scale.set(0.18, 0.8, 0.22);
    leftArm.position.set(-0.45, 1.3, 0);
    this.leftArm = leftArm;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.45;
    this.rightArm = rightArm;

    this.body.add(torso, head, leftLeg, rightLeg, leftArm, rightArm);

    // Weapons: sword at the right hip, bow on the back (hidden).
    const swordGroup = new THREE.Group();
    const blade = new THREE.Mesh(Geometries.unitBox, Materials.swordBlade);
    blade.scale.set(0.05, 1.0, 0.15);
    blade.position.y = 0.4;
    const hilt = new THREE.Mesh(Geometries.unitBox, Materials.swordHilt);
    hilt.scale.set(0.15, 0.2, 0.15);
    hilt.position.y = -0.05;
    swordGroup.add(blade, hilt);
    swordGroup.position.set(0.45, 0.95, 0.2);
    this.sword = blade;
    this.weaponMesh.add(swordGroup);

    // Bow held in the right hand, in front of the body so the camera
    // (which sits behind the player) can see it.
    const bowGroup = new THREE.Group();
    const bowArc = new THREE.Mesh(Geometries.unitBox, Materials.bow);
    bowArc.scale.set(0.08, 1.5, 0.2);
    bowArc.position.y = 0.5;
    bowGroup.add(bowArc);
    // Bowstring — a thin vertical line through the bow.
    const string = new THREE.Mesh(Geometries.unitBox, Materials.thatch);
    string.scale.set(0.02, 1.4, 0.02);
    string.position.y = 0.5;
    bowGroup.add(string);
    bowGroup.position.set(0.35, 0.7, 0.3);
    bowGroup.visible = false;
    this.bow = bowArc;
    this.weaponMesh.add(bowGroup);
  }

  fixedUpdate(_dt: number): void {
    this.world.registerPlayerPosition(this.group.position);
  }

  // Called from Combat for melee and ranged attacks.
  getWeaponRange(): number {
    return this.bowVisible ? 35 : 2.5;
  }

  getWeaponDamage(): number {
    return this.bowVisible ? 100 : 100;
  }

  getWeaponCooldown(): number {
    return this.bowVisible ? 0.55 : 0.5;
  }

  isBowDrawn(): boolean { return this.bowVisible; }

  toggleWeapon(): void {
    this.bowVisible = !this.bowVisible;
    this.sword.parent!.visible = !this.bowVisible;
    this.bow.parent!.visible = this.bowVisible;
  }

  // Returns the desired movement direction in world space, given the
  // camera yaw. Camera-relative strafe — the body doesn't rotate, so
  // mouse-look is the only thing that changes where the player is
  // facing. Length is 0 if no movement, 1 otherwise.
  getMoveDir(cameraYaw: number, mounted: boolean): { dir: THREE.Vector3; speed: number } {
    let dx = 0;
    let dz = 0;
    if (this.input.isDown("w")) dz -= 1;
    if (this.input.isDown("s")) dz += 1;
    if (this.input.isDown("a")) dx -= 1;
    if (this.input.isDown("d")) dx += 1;
    if (dx === 0 && dz === 0) return { dir: new THREE.Vector3(), speed: 0 };

    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;

    // Camera basis: camera local +X = (cos(yaw), 0, -sin(yaw)) (right
    // of camera); camera local -Z = forward. So W (dz = -1) lands
    // on the camera-forward direction in world.
    const cosY = Math.cos(cameraYaw);
    const sinY = Math.sin(cameraYaw);
    const wx = dx * cosY + dz * sinY;
    const wz = -dx * sinY + dz * cosY;
    return { dir: new THREE.Vector3(wx, 0, wz), speed: mounted ? RUN_SPEED * 1.2 : WALK_SPEED };
  }

  // Apply a movement step. Clamps to ground. Updates the body bob.
  // Does NOT rotate the body — only mouse-look changes the view
  // direction. WASD is pure strafe.
  applyMovement(moveDir: THREE.Vector3, speed: number, dt: number, isRunning: boolean): void {
    if (speed > 0) {
      const targetX = this.group.position.x + moveDir.x * speed * dt;
      const targetZ = this.group.position.z + moveDir.z * speed * dt;
      const clamped = this.world.clampXZ(targetX, targetZ);
      const groundY = this.world.heightSampler(clamped.x, clamped.z);
      this.group.position.x = clamped.x;
      this.group.position.z = clamped.z;
      this.group.position.y = groundY;

      this.walkPhase += dt * (isRunning ? 12 : 7);
      if (Math.random() < dt * (isRunning ? 5 : 3)) this.audio.footstep();
    } else {
      this.walkPhase *= 0.9;
    }

    if (this.swingPhase > 0) {
      this.swingPhase = Math.max(0, this.swingPhase - dt);
      const t = 1 - this.swingPhase / 0.5;
      this.rightArm.rotation.x = -Math.sin(t * Math.PI) * 2.4;
    } else {
      this.rightArm.rotation.x = Math.sin(this.walkPhase) * (speed > 0 ? 0.5 : 0);
    }

    const bob = Math.sin(this.walkPhase) * (speed > 0 ? (isRunning ? 0.08 : 0.04) : 0);
    this.body.position.y = bob;
    this.leftLeg.rotation.x = Math.sin(this.walkPhase) * (speed > 0 ? 0.6 : 0);
    this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * (speed > 0 ? 0.6 : 0);
    this.leftArm.rotation.x = -Math.sin(this.walkPhase) * (speed > 0 ? 0.5 : 0);
  }

  triggerSwordSwing(): void {
    this.swingPhase = 0.5;
  }
}
