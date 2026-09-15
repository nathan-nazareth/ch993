// Camera.ts — third-person camera. Follows the player with a
// spring-damper. Mouse-look rotates the player (yaw) and the camera
// (pitch). When mounted on the eagle, pulls back to show more of the
// world.

import * as THREE from "three";
import { Player } from "../entities/Player";
import { MountSystem } from "./MountSystem";
import { Input } from "../core/Input";

const MIN_PITCH = -1.4;
const MAX_PITCH = 1.4;
const MOUSE_SENSITIVITY = 0.0025;
const FOLLOW_DISTANCE = 4.5;
const FOLLOW_HEIGHT = 2.0;
const EAGLE_FOLLOW_DISTANCE = 9;
const EAGLE_FOLLOW_HEIGHT = 4;

export class Camera {
  private pitch = 0;
  private target = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private current = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera;

  constructor(
    camera: THREE.PerspectiveCamera,
    private input: Input,
    private player: Player,
    private mount: MountSystem,
  ) {
    this.camera = camera;
    this.current.copy(this.player.group.position).add(new THREE.Vector3(0, FOLLOW_HEIGHT, FOLLOW_DISTANCE));
  }

  update(): void {
    const sens = MOUSE_SENSITIVITY;
    this.player.yaw -= this.input.mouseDeltaX() * sens;
    this.pitch += this.input.mouseDeltaY() * sens;
    this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch));

    // The body always faces the camera direction (mouse-look is the
    // only thing that changes the view). Set it here so it tracks
    // the yaw without the 1-frame lag of the fixed-step loop.
    this.player.body.rotation.y = this.player.yaw;

    const dist = this.mount.isRiding && this.mount.currentMount === "eagle" ? EAGLE_FOLLOW_DISTANCE : FOLLOW_DISTANCE;
    const height = this.mount.isRiding && this.mount.currentMount === "eagle" ? EAGLE_FOLLOW_HEIGHT : FOLLOW_HEIGHT;

    this.target.copy(this.player.group.position);
    this.target.y += 1.2;

    // Camera is BEHIND the player: at +Z in the player's local frame.
    // Local +Z in world = (sin(yaw), 0, cos(yaw)) given Three.js's
    // rotation convention (rotation.y = 0 means the object's -Z faces
    // world -Z).
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const offX = Math.sin(this.player.yaw) * cosP * dist;
    const offZ = Math.cos(this.player.yaw) * cosP * dist;
    const offY = sinP * dist + height;
    this.desired.set(this.target.x + offX, this.target.y + offY, this.target.z + offZ);

    this.current.lerp(this.desired, 0.22);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.target);
  }
}
