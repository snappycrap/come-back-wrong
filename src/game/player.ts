import type { AbilityDef, AreaHit } from '../content/bodies.ts';
import { COMBAT, LADDER, MOTION } from '../content/tuning.ts';
import { resolveStatic, resolved } from './collide.ts';
import { damageRadius, performAttack } from './combat.ts';
import type { Game } from './game.ts';
import type { Input } from './types.ts';

function startDash(
  g: Game,
  dx: number,
  dz: number,
  distance: number,
  durationSec: number,
  height: number,
  untouchable: boolean,
  land: AreaHit | null,
  path: AreaHit | null,
  restSec: number,
): void {
  const p = g.player;
  p.dash = {
    dx,
    dz,
    speed: distance / durationSec,
    durationSec,
    t: 0,
    height,
    untouchable,
    land,
    path,
    restSec,
    id: ++g.dashSerial,
  };
  p.facing = Math.atan2(dx, dz);
}

function useAbility(g: Game, ability: AbilityDef, dirX: number, dirZ: number): void {
  const p = g.player;
  switch (ability.kind) {
    case 'none':
      return;
    case 'dash':
      startDash(
        g,
        dirX,
        dirZ,
        ability.distance,
        ability.durationSec,
        ability.height,
        ability.untouchable,
        ability.land,
        ability.path,
        0,
      );
      break;
    case 'sprint':
      p.sprintT = ability.durationSec;
      break;
    case 'glide':
      p.glideT = ability.durationSec;
      break;
  }
  p.abilityCd = ability.cooldownSec;
}

export function hurtPlayer(g: Game, amount: number): void {
  const p = g.player;
  p.hp -= amount * p.body.damageTaken;
  p.hitGrace = COMBAT.hitGraceSec;
  p.flash = COMBAT.flashSec;
  g.emit({ kind: 'puff', x: p.x, z: p.z, tone: 'hit', count: 2 });
}

export function updatePlayer(g: Game, input: Input, dt: number): void {
  const p = g.player;
  const body = p.body;
  const soul = g.soul;

  p.lifeTime += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hitGrace = Math.max(0, p.hitGrace - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.abilityCd = Math.max(0, p.abilityCd - dt);
  p.sprintT = Math.max(0, p.sprintT - dt);
  p.hopRest = Math.max(0, p.hopRest - dt);
  if (soul.regen > 0) p.hp = Math.min(p.maxHp, p.hp + soul.regen * dt);

  // Wanted direction, never longer than 1.
  let mx = input.moveX;
  let mz = input.moveZ;
  const mag = Math.hypot(mx, mz);
  const wants = mag > MOTION.deadzone;
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }
  const dirX = wants ? mx / Math.min(mag, 1) : Math.sin(p.facing);
  const dirZ = wants ? mz / Math.min(mag, 1) : Math.cos(p.facing);

  if (input.ability && p.abilityCd <= 0 && !p.dash && p.glideT <= 0) {
    useAbility(g, body.ability, dirX, dirZ);
  }

  const startX = p.x;
  const startZ = p.z;
  p.moving = false;

  if (p.dash) {
    const d = p.dash;
    d.t += dt;
    p.x += d.dx * d.speed * dt;
    p.z += d.dz * d.speed * dt;
    const f = Math.min(1, d.t / d.durationSec);
    p.y = d.height * 4 * f * (1 - f);
    p.moving = true;
    if (d.path) damageRadius(g, p.x, p.z, d.path.radius, d.path.damage * soul.damage, d.path.knockback, d.id);
    if (d.t >= d.durationSec) {
      p.y = 0;
      p.hopRest = d.restSec;
      if (d.land) {
        damageRadius(g, p.x, p.z, d.land.radius, d.land.damage * soul.damage, d.land.knockback, 0);
        g.emit({ kind: 'ring', x: p.x, z: p.z, radius: d.land.radius, tone: 'land' });
      }
      p.dash = null;
    }
  } else if (body.move.kind === 'run') {
    if (wants) {
      const sprint = p.sprintT > 0 && body.ability.kind === 'sprint' ? 1 + body.ability.speedBonus : 1;
      const speed = body.move.speed * soul.moveSpeed * sprint;
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      p.facing = Math.atan2(mx, mz);
      p.moving = true;
    }
  } else if (wants && p.hopRest <= 0) {
    // Hop bodies commit to a direction for the whole hop.
    const m = body.move;
    startDash(
      g,
      dirX,
      dirZ,
      m.distance,
      m.durationSec / soul.moveSpeed,
      m.height,
      false,
      null,
      null,
      m.restSec / soul.moveSpeed,
    );
  }

  if (p.glideT > 0 && body.ability.kind === 'glide') {
    const a = body.ability;
    const elapsed = a.durationSec - p.glideT;
    const ease = Math.min(1, elapsed / MOTION.glideEaseSec, p.glideT / MOTION.glideEaseSec);
    p.y = a.height * ease;
    p.glideT = Math.max(0, p.glideT - dt);
    if (p.glideT <= 0) p.y = 0;
  }

  resolveStatic(g, p.x, p.z, body.radius, g.scratch);
  p.x = resolved.x;
  p.z = resolved.z;
  p.travelled += Math.hypot(p.x - startX, p.z - startZ);
  p.untouchable = (p.dash !== null && p.dash.untouchable) || p.glideT > 0 || p.y > COMBAT.airborneHeight;

  if (body.attack.kind !== 'none') {
    p.attackTimer -= dt * soul.attackSpeed;
    if (p.attackTimer <= 0) {
      const aim = performAttack(g, body.attack, p.x, p.z, p.facing, soul.damage, false);
      if (!Number.isNaN(aim)) {
        p.attackTimer = body.attack.intervalSec;
        p.attackPulse = 1;
      }
    }
  }

  if (input.letGo && g.canLetGo) {
    p.letGoT += dt;
    if (p.letGoT >= LADDER.letGoHoldSec) {
      p.letGoT = 0;
      g.beginRebirth(false);
    }
  } else {
    p.letGoT = 0;
  }
}
