import { XP } from '../content/tuning.ts';
import { damageRadius } from './combat.ts';
import type { Game } from './game.ts';

export function spawnOrb(g: Game, x: number, z: number, value: number): void {
  const o = g.orbs;
  if (o.count >= XP.orbCapacity) {
    // Pool is full: fold the value into an existing orb rather than lose it.
    const k = g.rng.int(o.count);
    o.value[k] = (o.value[k] as number) + value;
    return;
  }
  const i = o.count++;
  o.x[i] = x;
  o.z[i] = z;
  o.px[i] = x;
  o.pz[i] = z;
  o.value[i] = value;
}

export function updateOrbs(g: Game, dt: number): void {
  const o = g.orbs;
  const p = g.player;
  if (g.rebirth) return;
  const reach = XP.pickupRadius * g.soul.pickupRadius;
  for (let i = o.count - 1; i >= 0; i--) {
    const dx = p.x - (o.x[i] as number);
    const dz = p.z - (o.z[i] as number);
    const d = Math.hypot(dx, dz);
    if (d > reach) continue;
    const move = XP.magnetSpeed * dt;
    if (d <= XP.collectRadius + move) {
      g.xp += o.value[i] as number;
      const last = --o.count;
      o.x[i] = o.x[last] as number;
      o.z[i] = o.z[last] as number;
      o.px[i] = o.px[last] as number;
      o.pz[i] = o.pz[last] as number;
      o.value[i] = o.value[last] as number;
      continue;
    }
    o.x[i] = (o.x[i] as number) + (dx / d) * move;
    o.z[i] = (o.z[i] as number) + (dz / d) * move;
  }
}

export function spawnEgg(
  g: Game,
  x: number,
  z: number,
  fuseSec: number,
  radius: number,
  damage: number,
  knockback: number,
  ghost: boolean,
): void {
  for (const egg of g.eggs) {
    if (egg.active) continue;
    egg.active = true;
    egg.x = x;
    egg.z = z;
    egg.fuse = fuseSec;
    egg.fuseSec = fuseSec;
    egg.radius = radius;
    egg.damage = damage;
    egg.knockback = knockback;
    egg.ghost = ghost;
    return;
  }
}

export function updateEggs(g: Game, dt: number): void {
  for (const egg of g.eggs) {
    if (!egg.active) continue;
    egg.fuse -= dt;
    if (egg.fuse > 0) continue;
    egg.active = false;
    damageRadius(g, egg.x, egg.z, egg.radius, egg.damage, egg.knockback, 0);
    g.emit({ kind: 'ring', x: egg.x, z: egg.z, radius: egg.radius, tone: egg.ghost ? 'ghost' : 'blast' });
    g.emit({ kind: 'puff', x: egg.x, z: egg.z, tone: 'egg', count: 7 });
  }
}
