import * as THREE from 'three';
import type { BodyDef } from '../content/bodies.ts';
import { COMBAT, PALETTE } from '../content/tuning.ts';

// Player and ghost bodies, built from primitives. Local +Z is forward.
// Each look is designed to read from behind and above: antlers, curled
// horns, a striped back and brush tail, splayed frog legs, a comb and tail
// fan, a rolling faceted stone.

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const CONE = new THREE.ConeGeometry(1, 1, 5);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const HORN = new THREE.TorusGeometry(0.28, 0.1, 5, 9, Math.PI * 1.5);

const CREAM = 0xf7ead0;
const DARK = 0x3a2a1c;

/** What the renderer tells a body about its current state. */
export interface BodyPose {
  moving: boolean;
  travelled: number;
  /** Height above ground. */
  y: number;
  time: number;
  /** 0..1 strength of the hit flash. */
  flash: number;
  invulnerable: boolean;
  /** 0..1, jumps to 1 when an attack fires. */
  attack: number;
  /** 0..1 progress of the death tumble. */
  dying: number;
  gliding: boolean;
}

interface Leg {
  pivot: THREE.Group;
  phase: number;
}

const LOOK = {
  strideRadPerMetre: 2.4,
  legSwing: 0.7,
  bob: 0.07,
  airStretch: 1.22,
  landSquash: 0.68,
  squashSec: 0.2,
  lunge: 0.3,
  ghostFloat: 0.35,
  ghostOpacity: 0.5,
} as const;

export class BodyVisual {
  readonly group = new THREE.Group();
  private readonly inner = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly wings: THREE.Object3D[] = [];
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  private readonly ghostMaterial: THREE.MeshLambertMaterial | null;
  private roller: THREE.Object3D | null = null;
  private tail: THREE.Object3D | null = null;
  private rollRadius = 1;
  private moveAmount = 0;
  private squash = 0;
  private wasAirborne = false;
  private readonly isGhost: boolean;

  constructor(body: BodyDef, ghost: boolean) {
    this.isGhost = ghost;
    this.ghostMaterial = ghost
      ? new THREE.MeshLambertMaterial({
          color: PALETTE.ghost,
          emissive: PALETTE.ghostGlow,
          transparent: true,
          opacity: LOOK.ghostOpacity,
          flatShading: true,
          depthWrite: false,
        })
      : null;
    this.group.add(this.inner);
    switch (body.model) {
      case 'stag':
        this.buildStag(body.color);
        break;
      case 'ram':
        this.buildRam(body.color);
        break;
      case 'wolf':
        this.buildWolf(body.color);
        break;
      case 'frog':
        this.buildFrog(body.color);
        break;
      case 'hen':
        this.buildHen(body.color);
        break;
      case 'stone':
        this.buildStone(body.color, body.radius);
        break;
    }
  }

  private mat(color: number): THREE.MeshLambertMaterial {
    if (this.ghostMaterial) return this.ghostMaterial;
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.set(color, m);
    }
    return m;
  }

  private part(
    geo: THREE.BufferGeometry,
    color: number,
    size: [number, number, number],
    pos: [number, number, number],
    parent: THREE.Object3D = this.inner,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, this.mat(color));
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(pos[0], pos[1], pos[2]);
    parent.add(mesh);
    return mesh;
  }

  private leg(x: number, hipY: number, z: number, width: number, color: number, phase: number): void {
    const pivot = new THREE.Group();
    pivot.position.set(x, hipY, z);
    this.part(BOX, color, [width, hipY, width], [0, -hipY / 2, 0], pivot);
    this.inner.add(pivot);
    this.legs.push({ pivot, phase });
  }

  private fourLegs(dx: number, dz: number, hipY: number, width: number, color: number): void {
    this.leg(-dx, hipY, dz, width, color, 0);
    this.leg(dx, hipY, dz, width, color, Math.PI);
    this.leg(-dx, hipY, -dz, width, color, Math.PI);
    this.leg(dx, hipY, -dz, width, color, 0);
  }

  private buildStag(color: number): void {
    const coat = color;
    this.part(BOX, coat, [0.62, 0.7, 1.5], [0, 1.3, 0]);
    this.part(BOX, CREAM, [0.3, 0.3, 0.14], [0, 1.5, -0.8]);
    const neck = this.part(BOX, coat, [0.3, 0.85, 0.32], [0, 1.9, 0.72]);
    neck.rotation.x = 0.45;
    this.part(BOX, coat, [0.32, 0.34, 0.6], [0, 2.32, 1.05]);
    this.part(BOX, DARK, [0.2, 0.16, 0.12], [0, 2.26, 1.38]);
    for (const side of [-1, 1]) {
      const beam = this.part(BOX, CREAM, [0.12, 1.0, 0.12], [side * 0.42, 2.92, 0.9]);
      beam.rotation.z = -side * 0.55;
      const tineA = this.part(BOX, CREAM, [0.1, 0.5, 0.1], [side * 0.75, 3.25, 1.05]);
      tineA.rotation.x = 0.7;
      const tineB = this.part(BOX, CREAM, [0.1, 0.45, 0.1], [side * 0.5, 2.95, 0.7]);
      tineB.rotation.x = -0.8;
      const tineC = this.part(BOX, CREAM, [0.1, 0.4, 0.1], [side * 0.86, 3.3, 0.8]);
      tineC.rotation.z = -side * 1.1;
    }
    this.fourLegs(0.22, 0.56, 0.98, 0.14, 0x8f4f1e);
  }

  private buildRam(color: number): void {
    this.part(BOX, color, [0.95, 0.8, 1.3], [0, 0.98, 0]);
    this.part(BALL, CREAM, [0.42, 0.32, 0.42], [0, 1.42, 0.3]);
    this.part(BALL, CREAM, [0.46, 0.34, 0.46], [0.08, 1.44, -0.3]);
    this.part(BALL, CREAM, [0.36, 0.3, 0.36], [-0.25, 1.38, 0]);
    this.part(BOX, 0x5a3a22, [0.42, 0.46, 0.5], [0, 1.08, 0.85]);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(HORN, this.mat(DARK));
      horn.position.set(side * 0.4, 1.28, 0.7);
      horn.rotation.y = Math.PI / 2;
      horn.scale.set(1.5, 1.5, 2.2);
      this.inner.add(horn);
    }
    this.part(BOX, CREAM, [0.2, 0.2, 0.16], [0, 1.15, -0.7]);
    this.fourLegs(0.3, 0.42, 0.6, 0.17, 0x5a3a22);
  }

  private buildWolf(color: number): void {
    this.part(BOX, color, [0.48, 0.5, 1.35], [0, 0.88, 0]);
    this.part(BOX, DARK, [0.2, 0.06, 1.25], [0, 1.15, 0]);
    this.part(BOX, color, [0.42, 0.5, 0.42], [0, 1.02, 0.68]);
    this.part(BOX, color, [0.38, 0.36, 0.42], [0, 1.2, 0.98]);
    this.part(BOX, CREAM, [0.2, 0.18, 0.34], [0, 1.12, 1.3]);
    for (const side of [-1, 1]) {
      this.part(CONE, DARK, [0.1, 0.28, 0.1], [side * 0.13, 1.5, 0.9]);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 1.0, -0.65);
    this.part(BOX, color, [0.22, 0.22, 0.7], [0, 0.12, -0.35], tail);
    this.part(BOX, CREAM, [0.2, 0.2, 0.24], [0, 0.12, -0.8], tail);
    tail.rotation.x = 0.3;
    this.inner.add(tail);
    this.tail = tail;
    this.fourLegs(0.17, 0.5, 0.64, 0.12, 0x7a2a1a);
  }

  private buildFrog(color: number): void {
    this.part(BALL, color, [0.62, 0.4, 0.74], [0, 0.44, 0]);
    this.part(BOX, DARK, [0.2, 0.06, 0.2], [0.14, 0.8, -0.05]);
    this.part(BOX, DARK, [0.16, 0.06, 0.16], [-0.2, 0.78, -0.25]);
    this.part(BOX, DARK, [0.14, 0.06, 0.14], [-0.1, 0.8, 0.2]);
    for (const side of [-1, 1]) {
      this.part(BALL, CREAM, [0.17, 0.17, 0.17], [side * 0.27, 0.8, 0.42]);
      this.part(BOX, DARK, [0.1, 0.12, 0.06], [side * 0.27, 0.82, 0.57]);
      this.part(BOX, color, [0.16, 0.16, 0.3], [side * 0.42, 0.14, 0.45]);
      // Hind legs fold out to the sides; they kick back during a hop.
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.5, 0.3, -0.25);
      const thigh = this.part(BOX, color, [0.22, 0.22, 0.7], [side * 0.18, 0, -0.1], pivot);
      thigh.rotation.y = side * 0.7;
      this.part(BOX, 0xd06a10, [0.3, 0.08, 0.4], [side * 0.36, -0.22, 0.1], pivot);
      this.inner.add(pivot);
      this.wings.push(pivot);
    }
  }

  private buildHen(color: number): void {
    this.part(BALL, color, [0.46, 0.42, 0.56], [0, 0.72, 0]);
    for (const [angle, lift] of [[-0.45, 0.0], [0, 0.12], [0.45, 0.0]] as const) {
      const feather = this.part(BOX, CREAM, [0.2, 0.62, 0.07], [Math.sin(angle) * 0.25, 1.1 + lift, -0.5]);
      feather.rotation.set(-0.6, 0, -angle * 0.8);
    }
    this.part(BALL, color, [0.22, 0.24, 0.22], [0, 1.2, 0.42]);
    this.part(BOX, PALETTE.elite, [0.08, 0.2, 0.32], [0, 1.47, 0.42]);
    this.part(BOX, PALETTE.elite, [0.07, 0.14, 0.07], [0, 1.03, 0.62]);
    const beak = this.part(CONE, 0xf08a1c, [0.08, 0.2, 0.08], [0, 1.2, 0.68]);
    beak.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.42, 0.9, -0.05);
      this.part(BOX, 0xe0b020, [0.1, 0.34, 0.56], [0, -0.14, 0], pivot);
      this.inner.add(pivot);
      this.wings.push(pivot);
    }
    this.leg(-0.15, 0.38, 0.05, 0.07, 0xf08a1c, 0);
    this.leg(0.15, 0.38, 0.05, 0.07, 0xf08a1c, Math.PI);
  }

  private buildStone(color: number, radius: number): void {
    const roller = new THREE.Group();
    roller.position.y = radius;
    this.part(ROCK, color, [radius, radius, radius], [0, 0, 0], roller);
    // Lighter chips so the roll is visible.
    this.part(BALL, CREAM, [0.2, 0.2, 0.2], [radius * 0.55, radius * 0.5, 0.2], roller);
    this.part(BALL, 0x8a6240, [0.24, 0.24, 0.24], [-radius * 0.5, -radius * 0.3, radius * 0.5], roller);
    this.part(BALL, CREAM, [0.16, 0.16, 0.16], [0.1, -radius * 0.6, -radius * 0.5], roller);
    this.inner.add(roller);
    this.roller = roller;
    this.rollRadius = radius;
  }

  setOpacity(fade: number): void {
    if (this.ghostMaterial) this.ghostMaterial.opacity = LOOK.ghostOpacity * Math.max(0, fade);
  }

  update(pose: BodyPose, dt: number): void {
    const target = pose.moving ? 1 : 0;
    this.moveAmount += (target - this.moveAmount) * Math.min(1, dt * 12);
    const stride = pose.travelled * LOOK.strideRadPerMetre;

    for (const leg of this.legs) {
      leg.pivot.rotation.x = Math.sin(stride + leg.phase) * LOOK.legSwing * this.moveAmount;
    }
    if (this.tail) this.tail.rotation.y = Math.sin(stride) * 0.4 * this.moveAmount;
    if (this.roller) this.roller.rotation.x = pose.travelled / this.rollRadius;

    const airborne = pose.y > 0.05;
    if (!airborne && this.wasAirborne) this.squash = 1;
    this.wasAirborne = airborne;
    this.squash = Math.max(0, this.squash - dt / LOOK.squashSec);

    // Squash and stretch: tall in the air, flat for a moment on landing.
    let sy = 1;
    if (airborne && !pose.gliding) sy = LOOK.airStretch;
    else if (this.squash > 0) sy = 1 - (1 - LOOK.landSquash) * this.squash;
    const sxz = 1 / Math.sqrt(sy);
    const s = this.inner.scale;
    const k = Math.min(1, dt * 25);
    s.y += (sy - s.y) * k;
    s.x += (sxz - s.x) * k;
    s.z = s.x;

    // Wings flap while gliding; frog legs kick back while in the air.
    for (let i = 0; i < this.wings.length; i++) {
      const side = i === 0 ? -1 : 1;
      const wing = this.wings[i] as THREE.Object3D;
      if (pose.gliding) wing.rotation.z = side * (1.2 + Math.sin(pose.time * 30) * 0.35);
      else if (airborne) wing.rotation.x = 0.9;
      else {
        wing.rotation.z = 0;
        wing.rotation.x = 0;
      }
    }

    const bob = Math.abs(Math.sin(stride)) * LOOK.bob * this.moveAmount;
    const float = this.isGhost ? LOOK.ghostFloat + Math.sin(pose.time * 2 + this.group.id) * 0.1 : 0;
    this.inner.position.y = pose.y + bob + float - pose.dying * 0.2;
    this.inner.position.z = pose.attack * LOOK.lunge;
    this.inner.rotation.z = pose.dying * 1.45;

    if (!this.isGhost) {
      const pulse = pose.invulnerable ? 0.25 + 0.25 * Math.sin(pose.time * 22) : 0;
      for (const m of this.materials.values()) {
        m.emissive.setRGB(pulse + pose.flash * 0.9, pulse + pose.flash * 0.1, pulse + pose.flash * 0.08);
      }
    }
  }

  dispose(): void {
    for (const m of this.materials.values()) m.dispose();
    this.ghostMaterial?.dispose();
    this.group.removeFromParent();
  }
}

/** Strength of the hit flash, 0..1, from the simulation's flash timer. */
export function flashAmount(timer: number): number {
  return Math.min(1, timer / COMBAT.flashSec);
}
