import * as THREE from 'three';
import { ARENA, PALETTE } from '../content/tuning.ts';
import { Rng } from '../core/rng.ts';
import type { Obstacle } from '../game/types.ts';

const TUFTS = 700;
const PATCHES = 160;

function setInstance(mesh: THREE.InstancedMesh, i: number, dummy: THREE.Object3D): void {
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

/** Static scenery: meadow, fence, rocks and trees with their blob shadows. */
export function buildArena(obstacles: readonly Obstacle[]): THREE.Group {
  const root = new THREE.Group();
  const rng = new Rng(ARENA.layoutSeed + 1);
  const half = ARENA.size / 2;
  const dummy = new THREE.Object3D();
  const lambert = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });

  const outside = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.size * 4, ARENA.size * 4), lambert(PALETTE.outside));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.05;
  root.add(outside);

  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.size, ARENA.size), lambert(PALETTE.meadow));
  meadow.rotation.x = -Math.PI / 2;
  root.add(meadow);

  // Darker patches and grass tufts give the eye something to judge speed by.
  const patchGeo = new THREE.CircleGeometry(1, 7);
  patchGeo.rotateX(-Math.PI / 2);
  const patches = new THREE.InstancedMesh(patchGeo, new THREE.MeshLambertMaterial({ color: PALETTE.meadowDark }), PATCHES);
  for (let i = 0; i < PATCHES; i++) {
    dummy.position.set(rng.range(-half, half), 0.01, rng.range(-half, half));
    dummy.rotation.set(0, rng.range(0, Math.PI), 0);
    const s = rng.range(1, 3);
    dummy.scale.set(s, 1, s * rng.range(0.6, 1));
    setInstance(patches, i, dummy);
  }
  root.add(patches);

  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.42, 4), lambert(PALETTE.tuft), TUFTS);
  for (let i = 0; i < TUFTS; i++) {
    dummy.position.set(rng.range(-half, half), 0.2, rng.range(-half, half));
    dummy.rotation.set(0, rng.range(0, Math.PI), 0);
    const s = rng.range(0.7, 1.5);
    dummy.scale.set(s, s, s);
    setInstance(tufts, i, dummy);
  }
  root.add(tufts);

  // Boundary: a white picket fence all the way round.
  const perSide = Math.round(ARENA.size / ARENA.fencePostSpacing);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), lambert(PALETTE.fence), perSide * 4);
  let n = 0;
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < perSide; k++) {
      const t = -half + k * ARENA.fencePostSpacing;
      if (side === 0) dummy.position.set(t, 0.75, -half);
      else if (side === 1) dummy.position.set(half, 0.75, t);
      else if (side === 2) dummy.position.set(-t, 0.75, half);
      else dummy.position.set(-half, 0.75, -t);
      setInstance(posts, n++, dummy);
    }
  }
  root.add(posts);
  const railGeo = new THREE.BoxGeometry(ARENA.size, 0.16, 0.12);
  const railMat = lambert(PALETTE.fence);
  for (const y of [0.55, 1.1]) {
    for (let side = 0; side < 4; side++) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side === 1 ? half : side === 3 ? -half : 0, y, side === 0 ? -half : side === 2 ? half : 0);
      if (side % 2 === 1) rail.rotation.y = Math.PI / 2;
      root.add(rail);
    }
  }

  // Obstacles.
  const rocks = obstacles.filter((o) => o.kind === 'rock');
  const trees = obstacles.filter((o) => o.kind === 'tree');
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lambert(PALETTE.rock), Math.max(1, rocks.length));
  rockMesh.count = rocks.length;
  rocks.forEach((o, i) => {
    dummy.position.set(o.x, o.radius * 0.45, o.z);
    dummy.rotation.set(o.variant * 3, o.variant * 7, o.variant * 5);
    dummy.scale.set(o.radius * 1.08, o.radius * (0.7 + o.variant * 0.5), o.radius * 1.08);
    setInstance(rockMesh, i, dummy);
  });
  root.add(rockMesh);

  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 1, 1, 6), lambert(PALETTE.trunk), Math.max(1, trees.length));
  const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), lambert(PALETTE.leaves), Math.max(1, trees.length * 2));
  trunkMesh.count = trees.length;
  crownMesh.count = trees.length * 2;
  trees.forEach((o, i) => {
    const h = 5 + o.variant * 3;
    dummy.rotation.set(0, o.variant * 6, 0);
    dummy.position.set(o.x, 1.25, o.z);
    dummy.scale.set(o.radius, 2.5, o.radius);
    setInstance(trunkMesh, i, dummy);
    dummy.position.set(o.x, 2 + h * 0.3, o.z);
    dummy.scale.set(o.radius * 2.4, h * 0.6, o.radius * 2.4);
    setInstance(crownMesh, i * 2, dummy);
    dummy.position.set(o.x, 2 + h * 0.62, o.z);
    dummy.scale.set(o.radius * 1.7, h * 0.5, o.radius * 1.7);
    setInstance(crownMesh, i * 2 + 1, dummy);
  });
  root.add(trunkMesh, crownMesh);

  const blobGeo = new THREE.CircleGeometry(1, 14);
  blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(
    blobGeo,
    new THREE.MeshBasicMaterial({ color: PALETTE.shadow, transparent: true, opacity: 0.28, depthWrite: false }),
    Math.max(1, obstacles.length),
  );
  blobs.count = obstacles.length;
  dummy.rotation.set(0, 0, 0);
  obstacles.forEach((o, i) => {
    const s = o.kind === 'tree' ? o.radius * 2.4 : o.radius * 1.25;
    dummy.position.set(o.x, 0.02, o.z);
    dummy.scale.set(s, 1, s);
    setInstance(blobs, i, dummy);
  });
  root.add(blobs);

  return root;
}
