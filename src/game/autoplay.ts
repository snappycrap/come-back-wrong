import { ENEMIES } from '../content/enemies.ts';
import type { EnemyDef } from '../content/enemies.ts';
import { ARENA, BOT, LADDER } from '../content/tuning.ts';
import type { Game } from './game.ts';
import type { Input, Obstacle } from './types.ts';

const buffer = new Int32Array(1024);

/**
 * A simple bot: backs away from the horde while circling, drifts toward
 * experience, uses its ability when crowded, and lets go once a life has
 * earned a promotion. Deterministic for a given game state.
 */
export function botInput(g: Game): Input {
  const p = g.player;
  const e = g.enemies;
  let fx = 0;
  let fz = 0;
  let close = 0;

  const n = g.enemyGrid.query(p.x, p.z, BOT.threatRange, buffer);
  for (let k = 0; k < n; k++) {
    const i = buffer[k] as number;
    if (e.dead[i]) continue;
    const dx = p.x - (e.x[i] as number);
    const dz = p.z - (e.z[i] as number);
    const d = Math.max(0.3, Math.hypot(dx, dz));
    if (d > BOT.threatRange) continue;
    const w = ((ENEMIES[e.type[i] as number] as EnemyDef).elite ? BOT.eliteWeight : 1) / (d * d);
    fx += (dx / d) * w;
    fz += (dz / d) * w;
    if (d < BOT.dangerRange) close++;
  }

  // How crowded the bot is, 0..1. It fights when calm and backs off when crowded.
  const crowd = Math.min(1, close / BOT.dangerCount);
  let mx = 0;
  let mz = 0;
  const flee = Math.hypot(fx, fz);
  if (flee > 1e-4) {
    fx /= flee;
    fz /= flee;
    // Away from the crowd, plus a steady sideways drift.
    mx += (fx - fz * BOT.circle) * crowd * 1.5;
    mz += (fz + fx * BOT.circle) * crowd * 1.5;
  }

  // Walk up to the nearest enemy until it is within reach.
  const atk = p.body.attack;
  const reach = atk.kind === 'arc' || atk.kind === 'nearest' ? atk.range * BOT.engageShare : BOT.engageMin;
  if (atk.kind !== 'none') {
    let near = -1;
    let nearD = Infinity;
    for (let i = 0; i < e.count; i++) {
      if (e.dead[i]) continue;
      const d = Math.hypot((e.x[i] as number) - p.x, (e.z[i] as number) - p.z);
      if (d < nearD) {
        nearD = d;
        near = i;
      }
    }
    if (near >= 0 && nearD > reach) {
      mx += (((e.x[near] as number) - p.x) / nearD) * (1 - crowd);
      mz += (((e.z[near] as number) - p.z) / nearD) * (1 - crowd);
    }
  }

  // Nearest experience orb.
  const o = g.orbs;
  let best = -1;
  let bestD: number = BOT.orbRange;
  for (let i = 0; i < o.count; i++) {
    const d = Math.hypot((o.x[i] as number) - p.x, (o.z[i] as number) - p.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0 && bestD > 1e-3) {
    const pull = BOT.orbPull * (1 - crowd * 0.5);
    mx += (((o.x[best] as number) - p.x) / bestD) * pull;
    mz += (((o.z[best] as number) - p.z) / bestD) * pull;
  }

  // Stay away from the fence.
  const fromCentre = Math.hypot(p.x, p.z);
  if (fromCentre > BOT.edgeStart) {
    const w = Math.min(2, (fromCentre - BOT.edgeStart) / BOT.edgeRange) * 2;
    mx -= (p.x / fromCentre) * w;
    mz -= (p.z / fromCentre) * w;
  }
  const edge = ARENA.size / 2 - BOT.obstacleRange;
  if (Math.abs(p.x) > edge) mx -= Math.sign(p.x) * 2;
  if (Math.abs(p.z) > edge) mz -= Math.sign(p.z) * 2;

  // Slide around rocks and trees.
  for (const ob of g.obstacles as Obstacle[]) {
    const dx = p.x - ob.x;
    const dz = p.z - ob.z;
    const d = Math.hypot(dx, dz) - ob.radius;
    if (d < BOT.obstacleRange && d > -ob.radius) {
      const w = 1 - Math.max(0, d) / BOT.obstacleRange;
      const len = Math.hypot(dx, dz) || 1;
      mx += (dx / len) * w;
      mz += (dz / len) * w;
    }
  }

  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }

  return {
    moveX: mx,
    moveZ: mz,
    ability: close >= BOT.dangerCount,
    letGo: g.canLetGo && g.rank < 3 && g.lifeScore >= LADDER.upScore,
  };
}

/** The bot's upgrade choice: always the first card. */
export function botChoice(): number {
  return 0;
}
