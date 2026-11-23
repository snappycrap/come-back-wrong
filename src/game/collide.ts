import { ARENA } from '../content/tuning.ts';
import type { Game } from './game.ts';
import type { Obstacle } from './types.ts';

const MAX_OBSTACLE_RADIUS = Math.max(...ARENA.rockRadius, ...ARENA.treeRadius);

/** Result of the last `resolveStatic` call (reused to avoid allocation). */
export const resolved = { x: 0, z: 0 };

/** Push a circle out of obstacles and keep it inside the arena. */
export function resolveStatic(g: Game, x: number, z: number, radius: number, scratch: Int32Array): void {
  const n = g.obstacleGrid.query(x, z, radius + MAX_OBSTACLE_RADIUS, scratch);
  for (let k = 0; k < n; k++) {
    const o = g.obstacles[scratch[k] as number] as Obstacle;
    const dx = x - o.x;
    const dz = z - o.z;
    const min = radius + o.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    if (d > 1e-4) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    } else {
      x = o.x + min;
    }
  }
  const half = ARENA.size / 2 - radius;
  resolved.x = x < -half ? -half : x > half ? half : x;
  resolved.z = z < -half ? -half : z > half ? half : z;
}
