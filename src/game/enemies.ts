import { ENEMIES } from '../content/enemies.ts';
import type { EnemyDef } from '../content/enemies.ts';
import { ARENA, COMBAT, RUN, SPAWN } from '../content/tuning.ts';
import { resolveStatic, resolved } from './collide.ts';
import { enemyDef, hurtEnemy } from './combat.ts';
import type { Game } from './game.ts';
import { hurtPlayer } from './player.ts';

const HORDE = ENEMIES.map((def, index) => ({ def, index })).filter((x) => x.def.spawn.kind === 'horde');
const HORDE_WEIGHT = HORDE.reduce((sum, x) => sum + (x.def.spawn.kind === 'horde' ? x.def.spawn.weight : 0), 0);
const MAX_RADIUS = Math.max(...ENEMIES.map((e) => e.radius));
const RING_TRIES = 8;

/** A point in the spawn ring around the player, inside the arena if possible. */
function ringPoint(g: Game, out: { x: number; z: number }): void {
  const p = g.player;
  const half = ARENA.size / 2 - MAX_RADIUS;
  let x = 0;
  let z = 0;
  for (let t = 0; t < RING_TRIES; t++) {
    const a = g.rng.range(0, Math.PI * 2);
    const r = g.rng.range(SPAWN.ringMin, SPAWN.ringMax);
    x = p.x + Math.sin(a) * r;
    z = p.z + Math.cos(a) * r;
    if (Math.abs(x) <= half && Math.abs(z) <= half) break;
  }
  out.x = Math.max(-half, Math.min(half, x));
  out.z = Math.max(-half, Math.min(half, z));
}

const point = { x: 0, z: 0 };

function spawn(g: Game, typeIndex: number): void {
  const def = ENEMIES[typeIndex] as EnemyDef;
  ringPoint(g, point);
  g.enemies.add(typeIndex, point.x, point.z, def.health, g.rng.range(0, Math.PI * 2));
}

function pickHorde(g: Game): number {
  let roll = g.rng.next() * HORDE_WEIGHT;
  for (const h of HORDE) {
    if (h.def.spawn.kind !== 'horde') continue;
    roll -= h.def.spawn.weight;
    if (roll <= 0) return h.index;
  }
  return (HORDE[0] as { index: number }).index;
}

export function updateSpawning(g: Game, dt: number): void {
  const progress = Math.min(1, g.time / RUN.durationSec);
  const target = SPAWN.startAlive + (SPAWN.endAlive - SPAWN.startAlive) * progress;
  g.spawnBudget = Math.min(g.spawnBudget + SPAWN.maxPerSecond * dt, SPAWN.startAlive);
  while (g.spawnBudget >= 1 && g.enemies.count < target && g.enemies.count < SPAWN.capacity) {
    spawn(g, pickHorde(g));
    g.spawnBudget -= 1;
  }
  for (let t = 0; t < ENEMIES.length; t++) {
    const rule = (ENEMIES[t] as EnemyDef).spawn;
    if (rule.kind !== 'timed') continue;
    g.timedSpawn[t] = (g.timedSpawn[t] as number) + dt;
    if ((g.timedSpawn[t] as number) >= rule.everySec) {
      g.timedSpawn[t] = (g.timedSpawn[t] as number) - rule.everySec;
      spawn(g, t);
    }
  }
}

export function updateEnemies(g: Game, dt: number): void {
  const e = g.enemies;
  const p = g.player;
  const decay = Math.exp(-COMBAT.knockbackDecay * dt);
  const playerOnGround = p.y <= COMBAT.airborneHeight;
  const canBeHit = !g.rebirth && p.invuln <= 0 && !p.untouchable;

  for (let i = 0; i < e.count; i++) {
    if (e.dead[i]) continue;
    const def = enemyDef(g, i);
    let x = e.x[i] as number;
    let z = e.z[i] as number;
    let dx = p.x - x;
    let dz = p.z - z;
    let d = Math.hypot(dx, dz);

    if (d > SPAWN.leashDistance) {
      ringPoint(g, point);
      e.x[i] = point.x;
      e.z[i] = point.z;
      e.px[i] = point.x;
      e.pz[i] = point.z;
      e.kx[i] = 0;
      e.kz[i] = 0;
      continue;
    }

    // Walk toward the player unless being knocked back.
    const kx = e.kx[i] as number;
    const kz = e.kz[i] as number;
    const stunned = kx * kx + kz * kz > COMBAT.stunSpeed * COMBAT.stunSpeed;
    if (!stunned && d > 1e-3) {
      x += (dx / d) * def.speed * dt;
      z += (dz / d) * def.speed * dt;
      e.facing[i] = Math.atan2(dx, dz);
      e.phase[i] = (e.phase[i] as number) + def.speed * dt;
    }
    x += kx * dt;
    z += kz * dt;
    e.kx[i] = kx * decay;
    e.kz[i] = kz * decay;

    // Keep the horde from stacking into one spot.
    const n = g.enemyGrid.query(x, z, def.radius + MAX_RADIUS, g.scratch2);
    for (let k = 0; k < n; k++) {
      const j = g.scratch2[k] as number;
      if (j === i || e.dead[j]) continue;
      const ox = x - (e.x[j] as number);
      const oz = z - (e.z[j] as number);
      const min = def.radius + enemyDef(g, j).radius;
      const o2 = ox * ox + oz * oz;
      if (o2 >= min * min || o2 < 1e-8) continue;
      const o = Math.sqrt(o2);
      const push = (min - o) * COMBAT.separation;
      x += (ox / o) * push;
      z += (oz / o) * push;
    }

    resolveStatic(g, x, z, def.radius, g.scratch2);
    x = resolved.x;
    z = resolved.z;

    // Contact with the player.
    e.touchCd[i] = Math.max(0, (e.touchCd[i] as number) - dt);
    e.flash[i] = Math.max(0, (e.flash[i] as number) - dt);
    if (playerOnGround) {
      dx = p.x - x;
      dz = p.z - z;
      d = Math.hypot(dx, dz);
      const min = p.body.radius + def.radius;
      if (d < min) {
        if (d > 1e-4) {
          x = p.x - (dx / d) * min;
          z = p.z - (dz / d) * min;
        }
        if (canBeHit && p.hitGrace <= 0 && (e.touchCd[i] as number) <= 0) {
          e.touchCd[i] = COMBAT.touchIntervalSec;
          hurtPlayer(g, def.touchDamage);
          if (p.body.thorns > 0) {
            e.x[i] = x;
            e.z[i] = z;
            hurtEnemy(g, i, p.body.thorns, p.x, p.z, 0);
          }
        }
      }
    }
    e.x[i] = x;
    e.z[i] = z;
  }
}
