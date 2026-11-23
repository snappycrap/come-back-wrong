import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMIES } from '../content/enemies.ts';
import type { EnemyDef } from '../content/enemies.ts';
import { COMBAT, PALETTE, SPAWN } from '../content/tuning.ts';
import type { Game } from '../game/game.ts';

// The clerks: pale boxes with dark hair and ties. Each enemy type is one
// InstancedMesh (a single merged, vertex-coloured shape); legs and blob
// shadows are shared InstancedMeshes, so the whole horde is 6 draw calls.

interface Piece {
  size: [number, number, number];
  pos: [number, number, number];
  color: number;
  tiltX?: number;
}

interface Look {
  pieces: Piece[];
  hipY: number;
  hipX: number;
  legScale: number;
  /** Walk-cycle radians per metre walked. */
  stride: number;
}

const P = PALETTE;

const LOOKS: Record<EnemyDef['look'], Look> = {
  clerk: {
    pieces: [
      { size: [0.7, 0.75, 0.4], pos: [0, 1.0, 0], color: P.paper },
      { size: [0.42, 0.42, 0.42], pos: [0, 1.6, 0], color: P.paper },
      { size: [0.46, 0.1, 0.46], pos: [0, 1.85, 0], color: P.tie },
      { size: [0.12, 0.5, 0.05], pos: [0, 1.05, 0.21], color: P.tie },
      { size: [0.14, 0.62, 0.18], pos: [-0.43, 0.98, 0], color: P.paperShade },
      { size: [0.14, 0.62, 0.18], pos: [0.43, 0.98, 0], color: P.paperShade },
    ],
    hipY: 0.63,
    hipX: 0.17,
    legScale: 1,
    stride: 2.6,
  },
  courier: {
    pieces: [
      { size: [0.5, 0.68, 0.34], pos: [0, 0.98, 0.08], color: P.paper, tiltX: 0.35 },
      { size: [0.36, 0.36, 0.36], pos: [0, 1.5, 0.28], color: P.paper },
      { size: [0.4, 0.1, 0.5], pos: [0, 1.72, 0.32], color: P.satchel },
      { size: [0.42, 0.42, 0.2], pos: [0, 1.02, -0.26], color: P.satchel },
      { size: [0.1, 0.4, 0.05], pos: [0, 1.0, 0.3], color: P.tie, tiltX: 0.35 },
    ],
    hipY: 0.63,
    hipX: 0.13,
    legScale: 0.85,
    stride: 2.2,
  },
  auditor: {
    pieces: [
      { size: [1.4, 1.5, 0.85], pos: [0, 2.0, 0], color: P.paper },
      { size: [0.78, 0.78, 0.78], pos: [0, 3.15, 0], color: P.paper },
      { size: [0.84, 0.16, 0.84], pos: [0, 3.6, 0], color: P.tie },
      { size: [0.86, 0.18, 0.86], pos: [0, 3.2, 0], color: P.elite },
      { size: [0.26, 1.0, 0.08], pos: [0, 2.1, 0.44], color: P.elite },
      { size: [0.5, 0.2, 0.9], pos: [-0.8, 2.8, 0], color: P.elite },
      { size: [0.5, 0.2, 0.9], pos: [0.8, 2.8, 0], color: P.elite },
      { size: [0.3, 1.2, 0.36], pos: [-0.85, 2.0, 0], color: P.paperShade },
      { size: [0.3, 1.2, 0.36], pos: [0.85, 2.0, 0], color: P.paperShade },
    ],
    hipY: 1.26,
    hipX: 0.36,
    legScale: 2,
    stride: 1.3,
  },
};

const LEG_SIZE: [number, number, number] = [0.2, 0.63, 0.22];
const LEG_SWING = 0.65;
const WALK_BOB = 0.06;
const SHADOW_Y = 0.03;

function buildGeometry(pieces: Piece[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  for (const piece of pieces) {
    const geo = new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2]).toNonIndexed();
    if (piece.tiltX) geo.rotateX(piece.tiltX);
    geo.translate(piece.pos[0], piece.pos[1], piece.pos[2]);
    color.setHex(piece.color);
    const count = geo.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geo);
  }
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Could not build enemy geometry');
  return merged;
}

export class EnemyRenderer {
  readonly group = new THREE.Group();
  private readonly bodies: THREE.InstancedMesh[] = [];
  private readonly looks: Look[] = [];
  private readonly legs: THREE.InstancedMesh;
  private readonly shadows: THREE.InstancedMesh;
  private readonly counts: number[] = [];
  private readonly white = new THREE.Color(1, 1, 1);
  private readonly tint = new THREE.Color();

  constructor() {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const def of ENEMIES) {
      const look = LOOKS[def.look];
      const mesh = new THREE.InstancedMesh(buildGeometry(look.pieces), material, SPAWN.capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < SPAWN.capacity; i++) mesh.setColorAt(i, this.white);
      mesh.count = 0;
      this.bodies.push(mesh);
      this.looks.push(look);
      this.counts.push(0);
      this.group.add(mesh);
    }

    const legGeo = new THREE.BoxGeometry(LEG_SIZE[0], LEG_SIZE[1], LEG_SIZE[2]);
    legGeo.translate(0, -LEG_SIZE[1] / 2, 0);
    this.legs = new THREE.InstancedMesh(
      legGeo,
      new THREE.MeshLambertMaterial({ color: PALETTE.tie, flatShading: true }),
      SPAWN.capacity * 2,
    );
    this.legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.legs.frustumCulled = false;
    this.legs.count = 0;
    this.group.add(this.legs);

    const blob = new THREE.CircleGeometry(1, 10);
    blob.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(
      blob,
      new THREE.MeshBasicMaterial({ color: PALETTE.shadow, transparent: true, opacity: 0.25, depthWrite: false }),
      SPAWN.capacity,
    );
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.group.add(this.shadows);
  }

  update(g: Game, alpha: number): void {
    const e = g.enemies;
    const legArr = this.legs.instanceMatrix.array as Float32Array;
    const shArr = this.shadows.instanceMatrix.array as Float32Array;
    this.counts.fill(0);

    for (let i = 0; i < e.count; i++) {
      const type = e.type[i] as number;
      const def = ENEMIES[type] as EnemyDef;
      const look = this.looks[type] as Look;
      const mesh = this.bodies[type] as THREE.InstancedMesh;
      const slot = this.counts[type] as number;
      this.counts[type] = slot + 1;

      const x = (e.px[i] as number) + ((e.x[i] as number) - (e.px[i] as number)) * alpha;
      const z = (e.pz[i] as number) + ((e.z[i] as number) - (e.pz[i] as number)) * alpha;
      const facing = e.facing[i] as number;
      const c = Math.cos(facing);
      const s = Math.sin(facing);
      const phase = (e.phase[i] as number) * look.stride;
      const bob = Math.abs(Math.sin(phase)) * WALK_BOB * look.legScale;

      // Body: rotation about Y plus translation, written straight into the buffer.
      const arr = mesh.instanceMatrix.array as Float32Array;
      let o = slot * 16;
      arr[o] = c;
      arr[o + 1] = 0;
      arr[o + 2] = -s;
      arr[o + 3] = 0;
      arr[o + 4] = 0;
      arr[o + 5] = 1;
      arr[o + 6] = 0;
      arr[o + 7] = 0;
      arr[o + 8] = s;
      arr[o + 9] = 0;
      arr[o + 10] = c;
      arr[o + 11] = 0;
      arr[o + 12] = x;
      arr[o + 13] = bob;
      arr[o + 14] = z;
      arr[o + 15] = 1;

      const flash = Math.min(1, (e.flash[i] as number) / COMBAT.flashSec);
      const colors = mesh.instanceColor;
      if (colors) {
        const ca = colors.array as Float32Array;
        this.tint.setHex(PALETTE.hit);
        ca[slot * 3] = 1 + (this.tint.r - 1) * flash;
        ca[slot * 3 + 1] = 1 + (this.tint.g - 1) * flash;
        ca[slot * 3 + 2] = 1 + (this.tint.b - 1) * flash;
      }

      // Two legs swinging from the hips: M = T * Ry(facing) * Rx(swing) * S.
      for (let side = 0; side < 2; side++) {
        const swing = Math.sin(phase + side * Math.PI) * LEG_SWING;
        const cx = Math.cos(swing);
        const sx = Math.sin(swing);
        const off = (side === 0 ? -1 : 1) * look.hipX;
        const k = look.legScale;
        o = (i * 2 + side) * 16;
        legArr[o] = c * k;
        legArr[o + 1] = 0;
        legArr[o + 2] = -s * k;
        legArr[o + 3] = 0;
        legArr[o + 4] = s * sx * k;
        legArr[o + 5] = cx * k;
        legArr[o + 6] = c * sx * k;
        legArr[o + 7] = 0;
        legArr[o + 8] = s * cx * k;
        legArr[o + 9] = -sx * k;
        legArr[o + 10] = c * cx * k;
        legArr[o + 11] = 0;
        legArr[o + 12] = x + c * off;
        legArr[o + 13] = look.hipY + bob;
        legArr[o + 14] = z - s * off;
        legArr[o + 15] = 1;
      }

      o = i * 16;
      const r = def.radius * 1.15;
      shArr[o] = r;
      shArr[o + 1] = 0;
      shArr[o + 2] = 0;
      shArr[o + 3] = 0;
      shArr[o + 4] = 0;
      shArr[o + 5] = 1;
      shArr[o + 6] = 0;
      shArr[o + 7] = 0;
      shArr[o + 8] = 0;
      shArr[o + 9] = 0;
      shArr[o + 10] = r;
      shArr[o + 11] = 0;
      shArr[o + 12] = x;
      shArr[o + 13] = SHADOW_Y;
      shArr[o + 14] = z;
      shArr[o + 15] = 1;
    }

    for (let t = 0; t < this.bodies.length; t++) {
      const mesh = this.bodies[t] as THREE.InstancedMesh;
      mesh.count = this.counts[t] as number;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.legs.count = e.count * 2;
    this.legs.instanceMatrix.needsUpdate = true;
    this.shadows.count = e.count;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
}
