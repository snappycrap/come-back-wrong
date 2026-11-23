import { BODIES, LEVELS, bodiesOnRank, levelRank } from '../content/bodies.ts';
import type { AreaHit, BodyDef } from '../content/bodies.ts';
import { ENEMIES } from '../content/enemies.ts';
import { ARENA, GHOSTS, LADDER, PROJECTILES, REBIRTH, RUN, SIM, SPAWN, XP } from '../content/tuning.ts';
import { BASE_SOUL, UPGRADES } from '../content/upgrades.ts';
import type { SoulStats, UpgradeDef } from '../content/upgrades.ts';
import { Rng } from '../core/rng.ts';
import { SpatialHash } from '../core/spatialHash.ts';
import { generateObstacles } from './arena.ts';
import { damageRadius } from './combat.ts';
import { updateEnemies, updateSpawning } from './enemies.ts';
import { EnemyStore } from './enemyStore.ts';
import { updateGhosts } from './ghosts.ts';
import { updateEggs, updateOrbs } from './pickups.ts';
import { updatePlayer } from './player.ts';
import type { FxEvent, Input, Obstacle } from './types.ts';

export interface Dash {
  dx: number;
  dz: number;
  speed: number;
  durationSec: number;
  t: number;
  height: number;
  untouchable: boolean;
  land: AreaHit | null;
  path: AreaHit | null;
  /** Pause after landing (frog hops). */
  restSec: number;
  /** Unique per dash, so a charge hits each enemy once. */
  id: number;
}

export interface Player {
  x: number;
  z: number;
  px: number;
  pz: number;
  /** Height above the ground. */
  y: number;
  py: number;
  /** Heading in radians; 0 looks along +Z. */
  facing: number;
  body: BodyDef;
  hp: number;
  maxHp: number;
  lifeTime: number;
  lifeElites: number;
  attackTimer: number;
  abilityCd: number;
  invuln: number;
  hitGrace: number;
  flash: number;
  dash: Dash | null;
  sprintT: number;
  glideT: number;
  hopRest: number;
  letGoT: number;
  moving: boolean;
  untouchable: boolean;
  /** Set to 1 when an attack fires; the renderer lets it decay. */
  attackPulse: number;
  /** Total ground covered, for leg swing and the Stone's roll. */
  travelled: number;
}

export interface Ghost {
  id: number;
  body: BodyDef;
  x: number;
  z: number;
  px: number;
  pz: number;
  facing: number;
  attackTimer: number;
  /** 1 = fully present; counts down to 0 once `fading`. */
  fade: number;
  fading: boolean;
}

export interface Egg {
  active: boolean;
  x: number;
  z: number;
  fuse: number;
  fuseSec: number;
  radius: number;
  damage: number;
  knockback: number;
  ghost: boolean;
}

export class OrbStore {
  count = 0;
  readonly x = new Float32Array(XP.orbCapacity);
  readonly z = new Float32Array(XP.orbCapacity);
  readonly px = new Float32Array(XP.orbCapacity);
  readonly pz = new Float32Array(XP.orbCapacity);
  readonly value = new Float32Array(XP.orbCapacity);
}

export type Verdict = 'up' | 'stay' | 'down';

export interface RebirthState {
  /** Real seconds left of the slow-motion wheel spin. */
  timer: number;
  from: BodyDef;
  to: BodyDef;
  score: number;
  verdict: Verdict;
  toRank: number;
  promoted: boolean;
}

export interface LifeRecord {
  body: string;
  level: string;
  seconds: number;
  score: number;
}

export interface RunResult {
  won: boolean;
  time: number;
  kills: number;
  lives: LifeRecord[];
}

export class Game {
  readonly seed: number;
  readonly rng: Rng;
  readonly dt = 1 / SIM.stepHz;
  time = 0;

  readonly soul: SoulStats = { ...BASE_SOUL };
  level = 1;
  xp = 0;

  readonly player: Player;
  readonly enemies = new EnemyStore(SPAWN.capacity);
  readonly enemyGrid = new SpatialHash(ARENA.size + 16, 3, SPAWN.capacity);
  readonly obstacles: Obstacle[] = generateObstacles();
  readonly obstacleGrid: SpatialHash;
  readonly orbs = new OrbStore();
  readonly eggs: Egg[] = [];
  ghosts: Ghost[] = [];
  /** Visual events since the renderer last drained them. */
  fx: FxEvent[] = [];
  /** Set false to drop visual events (headless runs). */
  emitFx = true;

  rebirth: RebirthState | null = null;
  choices: UpgradeDef[] | null = null;
  result: RunResult | null = null;

  readonly stats = { kills: 0, rebirths: 0, levelUps: 0, lives: [] as LifeRecord[] };

  spawnBudget: number = SPAWN.startAlive;
  readonly timedSpawn: number[] = ENEMIES.map(() => 0);
  dashSerial = 0;
  private ghostSerial = 0;
  readonly scratch = new Int32Array(SPAWN.capacity);
  readonly scratch2 = new Int32Array(SPAWN.capacity);

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.obstacleGrid = new SpatialHash(ARENA.size + 16, 8, this.obstacles.length);
    this.obstacleGrid.build(
      this.obstacles.length,
      this.obstacles.map((o) => o.x),
      this.obstacles.map((o) => o.z),
    );
    for (let i = 0; i < PROJECTILES.eggCapacity; i++) {
      this.eggs.push({ active: false, x: 0, z: 0, fuse: 0, fuseSec: 1, radius: 0, damage: 0, knockback: 0, ghost: false });
    }
    const start = this.rng.pick(BODIES.filter((b) => b.level === RUN.startLevel));
    this.player = {
      x: 0,
      z: 0,
      px: 0,
      pz: 0,
      y: 0,
      py: 0,
      facing: 0,
      body: start,
      hp: start.maxHealth,
      maxHp: start.maxHealth,
      lifeTime: 0,
      lifeElites: 0,
      attackTimer: 0,
      abilityCd: 0,
      invuln: 0,
      hitGrace: 0,
      flash: 0,
      dash: null,
      sprintT: 0,
      glideT: 0,
      hopRest: 0,
      letGoT: 0,
      moving: false,
      untouchable: false,
      attackPulse: 0,
      travelled: 0,
    };
  }

  /** How fast game time runs relative to real time. */
  get timeScale(): number {
    return this.rebirth ? REBIRTH.slowScale : 1;
  }

  /** True while the simulation is waiting (upgrade choice or run over). */
  get halted(): boolean {
    return this.choices !== null || this.result !== null;
  }

  get rank(): number {
    return levelRank(this.player.body.level);
  }

  get lifeScore(): number {
    return this.player.lifeTime + LADDER.elitePoints * this.player.lifeElites;
  }

  get xpNeeded(): number {
    return XP.base + XP.perLevel * (this.level - 1);
  }

  get canLetGo(): boolean {
    return this.rank > 0 && !this.rebirth && !this.result;
  }

  emit(e: FxEvent): void {
    if (this.emitFx && this.fx.length < 512) this.fx.push(e);
  }

  /** Advance the simulation by one fixed step. */
  step(input: Input): void {
    if (this.halted) return;
    const dt = this.dt;
    const p = this.player;
    const e = this.enemies;

    p.px = p.x;
    p.pz = p.z;
    p.py = p.y;
    e.px.set(e.x.subarray(0, e.count));
    e.pz.set(e.z.subarray(0, e.count));
    this.orbs.px.set(this.orbs.x.subarray(0, this.orbs.count));
    this.orbs.pz.set(this.orbs.z.subarray(0, this.orbs.count));
    for (const g of this.ghosts) {
      g.px = g.x;
      g.pz = g.z;
    }

    this.time += dt;
    updateSpawning(this, dt);
    this.enemyGrid.build(e.count, e.x, e.z);

    if (this.rebirth) {
      this.rebirth.timer -= dt / REBIRTH.slowScale;
      if (this.rebirth.timer <= 0) this.completeRebirth();
    } else {
      updatePlayer(this, input, dt);
    }
    updateGhosts(this, dt);
    updateEggs(this, dt);
    updateEnemies(this, dt);
    updateOrbs(this, dt);
    e.compact();

    if (this.result) return;
    if (!this.rebirth) {
      if (p.hp <= 0) {
        this.beginRebirth(false);
      } else if (this.rank === 0 && p.lifeTime >= LADDER.lastChancePromoteSec) {
        this.beginRebirth(true);
      }
    }
    if (this.result) return;
    if (this.time >= RUN.durationSec) {
      this.finish(true);
      return;
    }
    if (this.xp >= this.xpNeeded) this.offerUpgrades();
  }

  /** Called on death, on "Let go", and on the Last-chance promotion. */
  beginRebirth(promoted: boolean): void {
    if (this.rebirth || this.result) return;
    const p = this.player;
    const rank = this.rank;
    const score = this.lifeScore;
    if (!promoted && rank === 0) {
      this.recordLife();
      this.emit({ kind: 'puff', x: p.x, z: p.z, tone: 'soul', count: 16 });
      this.finish(false);
      return;
    }
    const top = LEVELS.length - 1;
    let toRank = rank;
    if (promoted || score >= LADDER.upScore) toRank = Math.min(rank + 1, top);
    else if (score < LADDER.stayScore) toRank = rank - 1;
    const verdict: Verdict = toRank > rank ? 'up' : toRank < rank ? 'down' : 'stay';

    const onLevel = bodiesOnRank(toRank);
    const others = onLevel.filter((b) => b !== p.body);
    const to = this.rng.pick(others.length > 0 ? others : onLevel);

    this.recordLife();
    this.rebirth = { timer: REBIRTH.slowSec, from: p.body, to, score, verdict, toRank, promoted };
    p.hp = Math.max(p.hp, 0);
    p.dash = null;
    p.y = 0;
    p.sprintT = 0;
    p.glideT = 0;
    p.letGoT = 0;
    p.moving = false;
    p.untouchable = true;
    this.emit({ kind: 'puff', x: p.x, z: p.z, tone: 'soul', count: 10 });
  }

  private completeRebirth(): void {
    const r = this.rebirth;
    if (!r) return;
    const p = this.player;
    this.rebirth = null;
    this.stats.rebirths++;

    this.addGhost(r.from);

    p.body = r.to;
    p.maxHp = r.to.maxHealth + this.soul.maxHealthBonus;
    p.hp = p.maxHp;
    p.lifeTime = 0;
    p.lifeElites = 0;
    p.attackTimer = 0;
    p.abilityCd = 0;
    p.invuln = REBIRTH.invulnerableSec;
    p.hitGrace = 0;
    p.hopRest = 0;
    p.untouchable = false;

    const radius = REBIRTH.shockRadius * this.soul.shockwaveRadius;
    damageRadius(this, p.x, p.z, radius, REBIRTH.shockDamage, REBIRTH.shockKnockback, 0);
    this.emit({ kind: 'ring', x: p.x, z: p.z, radius, tone: 'shock' });
    this.emit({ kind: 'puff', x: p.x, z: p.z, tone: 'soul', count: 14 });
  }

  addGhost(body: BodyDef): void {
    const p = this.player;
    this.ghosts.push({
      id: ++this.ghostSerial,
      body,
      x: p.x,
      z: p.z,
      px: p.x,
      pz: p.z,
      facing: p.facing,
      attackTimer: 0,
      fade: 1,
      fading: false,
    });
    let present = 0;
    for (const g of this.ghosts) if (!g.fading) present++;
    for (const g of this.ghosts) {
      if (present <= GHOSTS.max) break;
      if (!g.fading) {
        g.fading = true;
        present--;
      }
    }
  }

  private recordLife(): void {
    const p = this.player;
    const level = LEVELS[this.rank];
    this.stats.lives.push({
      body: p.body.name,
      level: level ? level.name : '',
      seconds: p.lifeTime,
      score: this.lifeScore,
    });
  }

  private finish(won: boolean): void {
    if (won) this.recordLife();
    this.rebirth = null;
    this.result = { won, time: Math.min(this.time, RUN.durationSec), kills: this.stats.kills, lives: this.stats.lives };
  }

  private offerUpgrades(): void {
    this.xp -= this.xpNeeded;
    this.level++;
    this.stats.levelUps++;
    const pool = UPGRADES.slice();
    const picks: UpgradeDef[] = [];
    while (picks.length < XP.choices && pool.length > 0) {
      picks.push(pool.splice(this.rng.int(pool.length), 1)[0] as UpgradeDef);
    }
    this.choices = picks;
  }

  chooseUpgrade(index: number): void {
    if (!this.choices) return;
    const up = this.choices[index];
    if (!up) return;
    this.choices = null;
    this.soul[up.stat] += up.add;
    const p = this.player;
    p.maxHp = p.body.maxHealth + this.soul.maxHealthBonus;
    p.hp = Math.min(p.maxHp, p.hp + up.heal);
  }

  // ---- Debug tools ------------------------------------------------------

  debugKill(): void {
    if (!this.rebirth && !this.halted) this.player.hp = 0;
  }

  debugLevelUp(): void {
    if (!this.halted) this.xp = Math.max(this.xp, this.xpNeeded);
  }

  debugNextBody(): void {
    if (this.rebirth || this.halted) return;
    const p = this.player;
    const next = BODIES[(BODIES.indexOf(p.body) + 1) % BODIES.length] as BodyDef;
    p.body = next;
    p.maxHp = next.maxHealth + this.soul.maxHealthBonus;
    p.hp = p.maxHp;
    p.dash = null;
    p.y = 0;
    p.sprintT = 0;
    p.glideT = 0;
    p.abilityCd = 0;
    p.attackTimer = 0;
    p.lifeTime = 0;
    p.lifeElites = 0;
  }

  debugAddGhost(): void {
    if (!this.halted) this.addGhost(this.player.body);
  }
}
