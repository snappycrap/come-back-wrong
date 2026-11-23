// Rule checks that run the simulation directly, without a browser.
import { expect, test } from '@playwright/test';
import { bodyById } from '../src/content/bodies.ts';
import { GHOSTS, LADDER, RUN, SPAWN } from '../src/content/tuning.ts';
import { Game } from '../src/game/game.ts';
import type { Input } from '../src/game/types.ts';

const idle: Input = { moveX: 0, moveZ: 0, ability: false, letGo: false };
const hold: Input = { ...idle, letGo: true };

function newGame(seed: number, bodyId?: string): Game {
  const g = new Game(seed);
  g.emitFx = false;
  if (bodyId) {
    const p = g.player;
    p.body = bodyById(bodyId);
    p.maxHp = p.body.maxHealth;
    p.hp = p.maxHp;
  }
  return g;
}

function run(g: Game, input: Input, steps: number): void {
  for (let i = 0; i < steps && !g.result; i++) {
    if (g.choices) g.chooseUpgrade(0);
    g.step(input);
  }
}

test('letting go needs a full hold, and a short life goes down a level', () => {
  const g = newGame(5);
  g.player.invuln = 999;
  run(g, hold, 59);
  expect(g.rebirth).toBeNull();
  run(g, hold, 3);
  expect(g.rebirth?.verdict).toBe('down');
  run(g, idle, 30);
  expect(g.stats.rebirths).toBe(1);
  expect(g.rank).toBe(1);
  expect(g.player.hp).toBe(g.player.maxHp);
  expect(g.ghosts.length).toBe(1);
});

test('life score decides the next level', () => {
  let g = newGame(6);
  const first = g.player.body;
  g.player.lifeTime = LADDER.stayScore + 10;
  g.player.hp = 0;
  run(g, idle, 1);
  expect(g.rebirth?.verdict).toBe('stay');
  expect(g.rebirth?.to).not.toBe(first);

  g = newGame(7);
  g.player.lifeTime = LADDER.upScore - 2 * LADDER.elitePoints + 1;
  g.player.lifeElites = 2;
  g.player.hp = 0;
  run(g, idle, 1);
  expect(g.rebirth?.verdict).toBe('up');
  expect(g.rebirth?.to.level).toBe('noble');
});

test('the Last-chance level: no letting go, death ends the run, surviving promotes', () => {
  let g = newGame(9, 'stone');
  g.player.invuln = 999;
  run(g, hold, 200);
  expect(g.rebirth).toBeNull();
  g.player.hp = 0;
  run(g, idle, 2);
  expect(g.result?.won).toBe(false);

  g = newGame(10, 'stone');
  g.player.invuln = 999;
  run(g, idle, LADDER.lastChancePromoteSec * 60 + 2);
  expect(g.rebirth?.promoted).toBe(true);
  expect(g.rebirth?.to.level).toBe('humble');
});

test('ghosts are capped and the horde ramps up to a win at the end', () => {
  const g = newGame(13);
  g.player.invuln = 99999;
  for (let i = 0; i < GHOSTS.max + 3; i++) g.debugAddGhost();
  g.step(idle);
  expect(g.enemies.count).toBe(SPAWN.startAlive);
  run(g, idle, 60 * (RUN.durationSec - 1));
  expect(g.ghosts.length).toBe(GHOSTS.max);
  expect(g.enemies.count).toBeGreaterThan(SPAWN.endAlive - 10);
  run(g, idle, 200);
  expect(g.result?.won).toBe(true);
});

test('the same seed gives the same run', () => {
  const move: Input = { moveX: 1, moveZ: 0.3, ability: true, letGo: false };
  const a = newGame(3);
  const b = newGame(3);
  run(a, move, 3000);
  run(b, move, 3000);
  expect(a.stats.kills).toBe(b.stats.kills);
  expect(a.player.x).toBe(b.player.x);
  expect(a.player.hp).toBe(b.player.hp);
});
