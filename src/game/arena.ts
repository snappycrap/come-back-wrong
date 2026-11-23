import { ARENA } from '../content/tuning.ts';
import { Rng } from '../core/rng.ts';
import type { Obstacle } from './types.ts';

/** The meadow's rocks and trees. Same layout every run. */
export function generateObstacles(): Obstacle[] {
  const rng = new Rng(ARENA.layoutSeed);
  const half = ARENA.size / 2 - ARENA.edgeMargin;
  const out: Obstacle[] = [];
  let guard = 0;
  while (out.length < ARENA.obstacleCount && guard++ < 5000) {
    const x = rng.range(-half, half);
    const z = rng.range(-half, half);
    const tree = rng.next() < ARENA.treeShare;
    const [rMin, rMax] = tree ? ARENA.treeRadius : ARENA.rockRadius;
    const radius = rng.range(rMin, rMax);
    const variant = rng.next();
    if (Math.hypot(x, z) < ARENA.clearRadius + radius) continue;
    let clash = false;
    for (const o of out) {
      if (Math.hypot(o.x - x, o.z - z) < o.radius + radius + ARENA.obstacleGap) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    out.push({ x, z, radius, kind: tree ? 'tree' : 'rock', variant });
  }
  return out;
}
