import type { AttackDef } from '../content/bodies.ts';
import { ENEMIES } from '../content/enemies.ts';
import type { EnemyDef } from '../content/enemies.ts';
import { ARENA, COMBAT } from '../content/tuning.ts';
import type { Game } from './game.ts';
import { spawnEgg, spawnOrb } from './pickups.ts';

const MAX_ENEMY_RADIUS = Math.max(...ENEMIES.map((e) => e.radius));
const DEG = Math.PI / 180;

export function enemyDef(g: Game, i: number): EnemyDef {
  return ENEMIES[g.enemies.type[i] as number] as EnemyDef;
}

/** Damage one enemy and push it away from (fromX, fromZ). */
export function hurtEnemy(g: Game, i: number, damage: number, fromX: number, fromZ: number, knockback: number): void {
  const e = g.enemies;
  if (e.dead[i]) return;
  const def = enemyDef(g, i);
  e.hp[i] = (e.hp[i] as number) - damage;
  e.flash[i] = COMBAT.flashSec;
  if (knockback > 0) {
    let dx = (e.x[i] as number) - fromX;
    let dz = (e.z[i] as number) - fromZ;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      dx /= d;
      dz /= d;
    } else {
      dx = 1;
      dz = 0;
    }
    // With exponential decay, distance covered = start speed / decay.
    const v = knockback * (1 - def.knockbackResist) * COMBAT.knockbackDecay;
    e.kx[i] = (e.kx[i] as number) + dx * v;
    e.kz[i] = (e.kz[i] as number) + dz * v;
  }
  if ((e.hp[i] as number) <= 0) {
    e.dead[i] = 1;
    g.stats.kills++;
    if (def.elite && !g.rebirth) g.player.lifeElites++;
    spawnOrb(g, e.x[i] as number, e.z[i] as number, def.experience);
    g.emit({
      kind: 'puff',
      x: e.x[i] as number,
      z: e.z[i] as number,
      tone: def.elite ? 'elite' : 'enemy',
      count: def.elite ? 14 : 5,
    });
  }
}

/** Index of the closest living enemy whose edge is within `range`, or -1. */
export function nearestEnemy(g: Game, x: number, z: number, range: number): number {
  const e = g.enemies;
  const n = g.enemyGrid.query(x, z, range + MAX_ENEMY_RADIUS, g.scratch);
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < n; k++) {
    const i = g.scratch[k] as number;
    if (e.dead[i]) continue;
    const d = Math.hypot((e.x[i] as number) - x, (e.z[i] as number) - z) - enemyDef(g, i).radius;
    if (d <= range && d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Damage every enemy within `radius`. If `stamp` is non-zero, each enemy is
 * only hit once per stamp (used by moves that sweep over several steps).
 */
export function damageRadius(
  g: Game,
  x: number,
  z: number,
  radius: number,
  damage: number,
  knockback: number,
  stamp: number,
): number {
  const e = g.enemies;
  const n = g.enemyGrid.query(x, z, radius + MAX_ENEMY_RADIUS, g.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const i = g.scratch[k] as number;
    if (e.dead[i]) continue;
    if (stamp !== 0 && e.stamp[i] === stamp) continue;
    const reach = radius + enemyDef(g, i).radius;
    const dx = (e.x[i] as number) - x;
    const dz = (e.z[i] as number) - z;
    if (dx * dx + dz * dz > reach * reach) continue;
    if (stamp !== 0) e.stamp[i] = stamp;
    hurtEnemy(g, i, damage, x, z, knockback);
    hits++;
  }
  return hits;
}

/**
 * Fire one auto-attack from (x, z). Returns the direction it was aimed in,
 * or NaN if there was nothing to attack (the attack stays ready).
 */
export function performAttack(
  g: Game,
  atk: AttackDef,
  x: number,
  z: number,
  facing: number,
  damageScale: number,
  ghost: boolean,
): number {
  const e = g.enemies;
  switch (atk.kind) {
    case 'none':
      return NaN;

    case 'arc': {
      const target = nearestEnemy(g, x, z, atk.range);
      if (target < 0) return NaN;
      const aim = Math.atan2((e.x[target] as number) - x, (e.z[target] as number) - z);
      const half = (atk.arcDeg / 2) * DEG;
      const n = g.enemyGrid.query(x, z, atk.range + MAX_ENEMY_RADIUS, g.scratch);
      for (let k = 0; k < n; k++) {
        const i = g.scratch[k] as number;
        if (e.dead[i]) continue;
        const dx = (e.x[i] as number) - x;
        const dz = (e.z[i] as number) - z;
        const radius = enemyDef(g, i).radius;
        const d = Math.hypot(dx, dz);
        if (d - radius > atk.range) continue;
        if (d > radius) {
          let diff = Math.atan2(dx, dz) - aim;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          // Widen the arc by the enemy's own angular size.
          if (Math.abs(diff) > half + Math.asin(Math.min(1, radius / d))) continue;
        }
        hurtEnemy(g, i, atk.damage * damageScale, x, z, atk.knockback);
      }
      g.emit({ kind: 'arc', x, z, dir: aim, range: atk.range, arcDeg: atk.arcDeg, ghost });
      return aim;
    }

    case 'nearest': {
      const target = nearestEnemy(g, x, z, atk.range);
      if (target < 0) return NaN;
      const tx = e.x[target] as number;
      const tz = e.z[target] as number;
      hurtEnemy(g, target, atk.damage * damageScale, x, z, atk.knockback);
      if (atk.look === 'tongue') g.emit({ kind: 'line', x1: x, z1: z, x2: tx, z2: tz, ghost });
      else g.emit({ kind: 'puff', x: tx, z: tz, tone: 'bite', count: 3 });
      return Math.atan2(tx - x, tz - z);
    }

    case 'egg': {
      const half = ARENA.size / 2;
      const ex = Math.max(-half, Math.min(half, x - Math.sin(facing) * atk.dropBehind));
      const ez = Math.max(-half, Math.min(half, z - Math.cos(facing) * atk.dropBehind));
      spawnEgg(g, ex, ez, atk.fuseSec, atk.radius, atk.damage * damageScale, atk.knockback, ghost);
      return facing;
    }
  }
}
