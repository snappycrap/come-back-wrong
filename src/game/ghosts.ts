import { GHOSTS } from '../content/tuning.ts';
import { performAttack } from './combat.ts';
import type { Game } from './game.ts';

export function updateGhosts(g: Game, dt: number): void {
  const p = g.player;
  const list = g.ghosts;
  const orbit = g.time * GHOSTS.orbitSpeed;
  let removed = false;

  for (let k = 0; k < list.length; k++) {
    const gh = list[k];
    if (!gh) continue;
    if (gh.fading) {
      gh.fade -= dt / GHOSTS.fadeSec;
      if (gh.fade <= 0) removed = true;
    }

    // Drift toward this ghost's slot on a slow circle around the player.
    const a = orbit + (k * Math.PI * 2) / GHOSTS.max;
    const tx = p.x + Math.sin(a) * GHOSTS.followRadius;
    const tz = p.z + Math.cos(a) * GHOSTS.followRadius;
    const dx = tx - gh.x;
    const dz = tz - gh.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3) {
      const speed = Math.min(d * GHOSTS.followGain, GHOSTS.maxSpeed);
      gh.x += (dx / d) * speed * dt;
      gh.z += (dz / d) * speed * dt;
      if (speed > 1) gh.facing = Math.atan2(dx, dz);
    }

    if (gh.fading || gh.body.attack.kind === 'none') continue;
    gh.attackTimer -= dt * g.soul.attackSpeed;
    if (gh.attackTimer <= 0) {
      const scale = g.soul.damage * GHOSTS.damageShare * g.soul.ghostDamage;
      const aim = performAttack(g, gh.body.attack, gh.x, gh.z, gh.facing, scale, true);
      if (!Number.isNaN(aim)) {
        gh.attackTimer = gh.body.attack.intervalSec;
        gh.facing = aim;
      }
    }
  }

  if (removed) g.ghosts = list.filter((gh) => gh.fade > 0);
}
