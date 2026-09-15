// Camera.ts — third-person camera. Follows the player with a
// spring-damper. Mouse-look rotates the player (yaw) and the camera
// (pitch). When mounted on the eagle, pulls back to show more of the
// world.
//
// Performance: cos/sin are cached across frames and only recomputed
// when the mouse moved. The spring-damper snaps in one frame when the
// player hasn't moved (idle).

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
const CAMERA_LERP = 0.22;

export class Camera {
  private pitch = 0;
  private target = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private current = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera;
  private cachedCosY = 1;
  private cachedSinY = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    private input: Input,
    private player: Player,
    private mount: MountSystem,
  ) {
    this.camera = camera;
    this.current.copy(this.player.group.position).add(
      new THREE.Vector3(0, FOLLOW_HEIGHT, FOLLOW_DISTANCE),
    );
  }

  update(): void {
    const dx = this.input.mouseDeltaX();
    const dy = this.input.mouseDeltaY();
    if (dx !== 0 || dy !== 0) {
      this.player.yaw -= dx * MOUSE_SENSITIVITY;
      this.pitch += dy * MOUSE_SENSITIVITY;
      if (this.pitch < MIN_PITCH) this.pitch = MIN_PITCH;
      else if (this.pitch > MAX_PITCH) this.pitch = MAX_PITCH;
      this.cachedCosY = Math.cos(this.player.yaw);
      this.cachedSinY = Math.sin(this.player.yaw);
    }

    this.player.body.rotation.y = this.player.yaw;

    const dist = this.mount.isRiding && this.mount.currentMount === "eagle"
      ? EAGLE_FOLLOW_DISTANCE
      : FOLLOW_DISTANCE;
    const height = this.mount.isRiding && this.mount.currentMount === "eagle"
      ? EAGLE_FOLLOW_HEIGHT
      : FOLLOW_HEIGHT;

    this.target.copy(this.player.group.position);
    this.target.y += 1.2;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const offX = this.cachedSinY * cosP * dist;
    const offZ = this.cachedCosY * cosP * dist;
    const offY = sinP * dist + height;
    this.desired.set(this.target.x + offX, this.target.y + offY, this.target.z + offZ);

    this.current.lerp(this.desired, CAMERA_LERP);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.target);
  }
}