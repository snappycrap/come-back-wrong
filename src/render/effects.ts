import * as THREE from 'three';
import { PALETTE, PROJECTILES, XP } from '../content/tuning.ts';
import { Rng } from '../core/rng.ts';
import type { Game } from '../game/game.ts';
import type { FxEvent } from '../game/types.ts';

// Short-lived visuals (sweeps, rings, tongue, puffs) plus the pooled
// instanced experience orbs and eggs.

const FX = {
  arcSec: 0.2,
  ringSec: 0.4,
  lineSec: 0.14,
  puffSec: 0.55,
  arcPool: 24,
  ringPool: 24,
  linePool: 12,
  puffPool: 400,
  puffGravity: 5,
  height: 0.5,
} as const;

interface Timed {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  total: number;
  radius: number;
}

function flatMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export class Effects {
  readonly group = new THREE.Group();
  private readonly arcs: Timed[] = [];
  private readonly arcGeos = new Map<number, THREE.BufferGeometry>();
  private readonly rings: Timed[] = [];
  private readonly lines: Timed[] = [];
  private readonly puffs: THREE.InstancedMesh;
  private readonly puffData = new Float32Array(FX.puffPool * 8); // x y z vx vy vz life size
  private puffCursor = 0;
  private readonly orbs: THREE.InstancedMesh;
  private readonly eggs: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  /** Visual-only randomness; never touches the simulation's generator. */
  private readonly rng = new Rng(12345);

  constructor() {
    for (let i = 0; i < FX.arcPool; i++) {
      const material = flatMaterial(PALETTE.shock);
      const mesh = new THREE.Mesh(undefined, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.arcs.push({ mesh, material, life: 0, total: 1, radius: 1 });
    }
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < FX.ringPool; i++) {
      const material = flatMaterial(PALETTE.shock);
      const mesh = new THREE.Mesh(ringGeo, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, material, life: 0, total: 1, radius: 1 });
    }
    const lineGeo = new THREE.BoxGeometry(0.1, 0.1, 1);
    lineGeo.translate(0, 0, 0.5);
    for (let i = 0; i < FX.linePool; i++) {
      const material = flatMaterial(PALETTE.hit);
      const mesh = new THREE.Mesh(lineGeo, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.lines.push({ mesh, material, life: 0, total: 1, radius: 1 });
    }

    this.puffs = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      FX.puffPool,
    );
    this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs.frustumCulled = false;
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < FX.puffPool; i++) {
      this.puffs.setMatrixAt(i, this.dummy.matrix);
      this.puffs.setColorAt(i, this.color.setHex(0xffffff));
    }
    this.group.add(this.puffs);

    this.orbs = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: PALETTE.orb }),
      XP.orbCapacity,
    );
    this.orbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.orbs.frustumCulled = false;
    this.orbs.count = 0;
    this.group.add(this.orbs);

    this.eggs = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.24, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.egg, flatShading: true }),
      PROJECTILES.eggCapacity,
    );
    this.eggs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.eggs.frustumCulled = false;
    this.eggs.count = 0;
    this.group.add(this.eggs);
  }

  private arcGeometry(arcDeg: number): THREE.BufferGeometry {
    let geo = this.arcGeos.get(arcDeg);
    if (!geo) {
      const arc = (arcDeg * Math.PI) / 180;
      // After laying the ring flat, angle -90 degrees points along +Z (forward).
      geo = new THREE.RingGeometry(0.35, 1, 16, 1, -Math.PI / 2 - arc / 2, arc);
      geo.rotateX(-Math.PI / 2);
      this.arcGeos.set(arcDeg, geo);
    }
    return geo;
  }

  private free(pool: Timed[]): Timed {
    let best = pool[0] as Timed;
    for (const t of pool) {
      if (t.life <= 0) return t;
      if (t.life < best.life) best = t;
    }
    return best;
  }

  private puff(x: number, z: number, color: number, count: number, speed: number, size: number): void {
    const d = this.puffData;
    for (let k = 0; k < count; k++) {
      const i = this.puffCursor;
      this.puffCursor = (this.puffCursor + 1) % FX.puffPool;
      const a = this.rng.range(0, Math.PI * 2);
      const v = this.rng.range(0.4, 1) * speed;
      const o = i * 8;
      d[o] = x;
      d[o + 1] = this.rng.range(0.4, 1.3);
      d[o + 2] = z;
      d[o + 3] = Math.sin(a) * v;
      d[o + 4] = this.rng.range(1, 3);
      d[o + 5] = Math.cos(a) * v;
      d[o + 6] = FX.puffSec * this.rng.range(0.7, 1);
      d[o + 7] = size * this.rng.range(0.7, 1.3);
      this.puffs.setColorAt(i, this.color.setHex(color));
    }
    if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;
  }

  private spawn(ev: FxEvent): void {
    switch (ev.kind) {
      case 'arc': {
        const t = this.free(this.arcs);
        t.mesh.geometry = this.arcGeometry(ev.arcDeg);
        t.mesh.position.set(ev.x, FX.height, ev.z);
        t.mesh.rotation.y = ev.dir;
        t.radius = ev.range;
        t.material.color.setHex(ev.ghost ? PALETTE.ghost : PALETTE.shock);
        t.life = t.total = FX.arcSec;
        t.mesh.visible = true;
        break;
      }
      case 'ring': {
        const t = this.free(this.rings);
        t.mesh.position.set(ev.x, 0.12, ev.z);
        t.radius = ev.radius;
        const color =
          ev.tone === 'blast' ? PALETTE.blast : ev.tone === 'ghost' ? PALETTE.ghost : PALETTE.shock;
        t.material.color.setHex(color);
        t.life = t.total = ev.tone === 'shock' ? FX.ringSec * 1.5 : FX.ringSec;
        t.mesh.visible = true;
        break;
      }
      case 'line': {
        const t = this.free(this.lines);
        const dx = ev.x2 - ev.x1;
        const dz = ev.z2 - ev.z1;
        t.mesh.position.set(ev.x1, 0.7, ev.z1);
        t.mesh.rotation.y = Math.atan2(dx, dz);
        t.radius = Math.hypot(dx, dz);
        t.material.color.setHex(ev.ghost ? PALETTE.ghost : PALETTE.hit);
        t.life = t.total = FX.lineSec;
        t.mesh.visible = true;
        break;
      }
      case 'puff': {
        if (ev.tone === 'enemy') this.puff(ev.x, ev.z, PALETTE.paper, ev.count, 3, 1);
        else if (ev.tone === 'elite') this.puff(ev.x, ev.z, PALETTE.elite, ev.count, 5, 1.6);
        else if (ev.tone === 'egg') this.puff(ev.x, ev.z, PALETTE.blast, ev.count, 5, 1.2);
        else if (ev.tone === 'soul') this.puff(ev.x, ev.z, PALETTE.ghost, ev.count, 5, 1.3);
        else if (ev.tone === 'hit') this.puff(ev.x, ev.z, PALETTE.hit, ev.count, 3, 0.7);
        else this.puff(ev.x, ev.z, PALETTE.shock, ev.count, 2, 0.6);
        break;
      }
    }
  }

  update(g: Game, alpha: number, dt: number, time: number): void {
    for (const ev of g.fx) this.spawn(ev);
    g.fx.length = 0;

    for (const t of this.arcs) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const f = Math.max(0, t.life / t.total);
      const s = t.radius * (0.75 + 0.25 * (1 - f));
      t.mesh.scale.set(s, 1, s);
      t.material.opacity = 0.75 * f;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const t of this.rings) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const f = Math.max(0, t.life / t.total);
      const s = t.radius * (1 - f * f * 0.85);
      t.mesh.scale.set(s, 1, s);
      t.material.opacity = 0.85 * f;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const t of this.lines) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const f = Math.max(0, t.life / t.total);
      t.mesh.scale.set(1, 1, t.radius);
      t.material.opacity = f;
      if (t.life <= 0) t.mesh.visible = false;
    }

    // Puffs: fly out, fall, shrink.
    const d = this.puffData;
    const dummy = this.dummy;
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < FX.puffPool; i++) {
      const o = i * 8;
      const life = d[o + 6] as number;
      if (life <= 0) continue;
      const left = life - dt;
      d[o + 6] = left;
      d[o] = (d[o] as number) + (d[o + 3] as number) * dt;
      d[o + 1] = Math.max(0.1, (d[o + 1] as number) + (d[o + 4] as number) * dt);
      d[o + 2] = (d[o + 2] as number) + (d[o + 5] as number) * dt;
      d[o + 4] = (d[o + 4] as number) - FX.puffGravity * dt;
      const s = left > 0 ? (d[o + 7] as number) * Math.min(1, (left / FX.puffSec) * 1.6) : 0;
      dummy.position.set(d[o] as number, d[o + 1] as number, d[o + 2] as number);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      this.puffs.setMatrixAt(i, dummy.matrix);
    }
    this.puffs.instanceMatrix.needsUpdate = true;

    const orbs = g.orbs;
    for (let i = 0; i < orbs.count; i++) {
      const x = (orbs.px[i] as number) + ((orbs.x[i] as number) - (orbs.px[i] as number)) * alpha;
      const z = (orbs.pz[i] as number) + ((orbs.z[i] as number) - (orbs.pz[i] as number)) * alpha;
      const s = 1 + Math.min(1.2, ((orbs.value[i] as number) - 1) * 0.12);
      dummy.position.set(x, 0.45 + Math.sin(time * 3 + i) * 0.1, z);
      dummy.rotation.set(0, time * 2 + i, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      this.orbs.setMatrixAt(i, dummy.matrix);
    }
    this.orbs.count = orbs.count;
    this.orbs.instanceMatrix.needsUpdate = true;

    let n = 0;
    dummy.rotation.set(0, 0, 0);
    for (const egg of g.eggs) {
      if (!egg.active) continue;
      // Eggs swell and wobble faster as the fuse runs out.
      const f = 1 - egg.fuse / egg.fuseSec;
      const pulse = 1 + f * 0.35 + Math.sin(f * f * 40) * 0.08;
      dummy.position.set(egg.x, 0.28, egg.z);
      dummy.scale.set(pulse, pulse * 1.3, pulse);
      dummy.updateMatrix();
      this.eggs.setMatrixAt(n++, dummy.matrix);
    }
    this.eggs.count = n;
    this.eggs.instanceMatrix.needsUpdate = true;
  }
}
