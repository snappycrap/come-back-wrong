// The bodies a soul can be reborn into. Placeholders: rename, retune or swap
// freely. `model` picks the look from src/render/bodyModels.ts.

export type LevelId = 'last' | 'humble' | 'common' | 'noble';

export interface LevelDef {
  id: LevelId;
  name: string;
}

/** The ladder, lowest first. A body's rank is its level's index in this list. */
export const LEVELS: readonly LevelDef[] = [
  { id: 'last', name: 'Last chance' },
  { id: 'humble', name: 'Humble' },
  { id: 'common', name: 'Common' },
  { id: 'noble', name: 'Noble' },
];

export interface AreaHit {
  radius: number;
  damage: number;
  /** Metres the enemies are pushed. */
  knockback: number;
}

export type MoveDef =
  | { kind: 'run'; speed: number }
  | { kind: 'hop'; distance: number; durationSec: number; restSec: number; height: number };

export type AttackDef =
  | { kind: 'arc'; intervalSec: number; range: number; arcDeg: number; damage: number; knockback: number }
  | { kind: 'nearest'; intervalSec: number; range: number; damage: number; knockback: number; look: 'bite' | 'tongue' }
  | { kind: 'egg'; intervalSec: number; fuseSec: number; radius: number; damage: number; dropBehind: number }
  | { kind: 'none' };

export type AbilityDef =
  | {
      kind: 'dash';
      name: string;
      distance: number;
      durationSec: number;
      height: number;
      cooldownSec: number;
      /** Enemies cannot touch the player during the move. */
      untouchable: boolean;
      /** Damage where the move ends. */
      land: AreaHit | null;
      /** Damage to everything passed through. */
      path: AreaHit | null;
    }
  | { kind: 'sprint'; name: string; speedBonus: number; durationSec: number; cooldownSec: number }
  | { kind: 'glide'; name: string; durationSec: number; height: number; cooldownSec: number }
  | { kind: 'none' };

export interface BodyDef {
  id: string;
  name: string;
  level: LevelId;
  model: 'stag' | 'ram' | 'wolf' | 'frog' | 'hen' | 'stone';
  /** Main colour, also used for the wheel and HUD. */
  color: number;
  maxHealth: number;
  radius: number;
  move: MoveDef;
  attack: AttackDef;
  ability: AbilityDef;
  /** 1 = normal. The Stone takes 0.3 (70% less). */
  damageTaken: number;
  /** Damage dealt back to any enemy that touches this body. */
  thorns: number;
}

export const BODIES: readonly BodyDef[] = [
  {
    id: 'stag',
    name: 'Stag',
    level: 'noble',
    model: 'stag',
    color: 0xd9812e,
    maxHealth: 120,
    radius: 0.7,
    move: { kind: 'run', speed: 9 },
    attack: { kind: 'arc', intervalSec: 0.8, range: 3, arcDeg: 120, damage: 14, knockback: 1 },
    ability: {
      kind: 'dash',
      name: 'Leap',
      distance: 8,
      durationSec: 0.5,
      height: 2.6,
      cooldownSec: 4,
      untouchable: true,
      land: { radius: 3.2, damage: 20, knockback: 3 },
      path: null,
    },
    damageTaken: 1,
    thorns: 0,
  },
  {
    id: 'ram',
    name: 'Ram',
    level: 'common',
    model: 'ram',
    color: 0xf0c060,
    maxHealth: 110,
    radius: 0.7,
    move: { kind: 'run', speed: 7 },
    attack: { kind: 'arc', intervalSec: 1.0, range: 2, arcDeg: 100, damage: 16, knockback: 4 },
    ability: {
      kind: 'dash',
      name: 'Charge',
      distance: 10,
      durationSec: 0.45,
      height: 0,
      cooldownSec: 5,
      untouchable: true,
      land: null,
      path: { radius: 1.7, damage: 18, knockback: 5 },
    },
    damageTaken: 1,
    thorns: 0,
  },
  {
    id: 'wolf',
    name: 'Wolf',
    level: 'common',
    model: 'wolf',
    color: 0xc8452b,
    maxHealth: 90,
    radius: 0.6,
    move: { kind: 'run', speed: 8.5 },
    attack: { kind: 'nearest', intervalSec: 0.5, range: 2.5, damage: 10, knockback: 0.5, look: 'bite' },
    ability: { kind: 'sprint', name: 'Sprint', speedBonus: 0.6, durationSec: 2, cooldownSec: 6 },
    damageTaken: 1,
    thorns: 0,
  },
  {
    id: 'frog',
    name: 'Frog',
    level: 'humble',
    model: 'frog',
    color: 0xf08a1c,
    maxHealth: 75,
    radius: 0.6,
    move: { kind: 'hop', distance: 3, durationSec: 0.34, restSec: 0.12, height: 0.9 },
    attack: { kind: 'nearest', intervalSec: 1.2, range: 6, damage: 12, knockback: 0, look: 'tongue' },
    ability: {
      kind: 'dash',
      name: 'Big jump',
      distance: 9,
      durationSec: 0.6,
      height: 3.4,
      cooldownSec: 4,
      untouchable: true,
      land: { radius: 3.5, damage: 10, knockback: 4 },
      path: null,
    },
    damageTaken: 1,
    thorns: 0,
  },
  {
    id: 'hen',
    name: 'Hen',
    level: 'humble',
    model: 'hen',
    color: 0xf6d23c,
    maxHealth: 75,
    radius: 0.55,
    move: { kind: 'run', speed: 6 },
    attack: { kind: 'egg', intervalSec: 1.5, fuseSec: 1, radius: 2.5, damage: 15, dropBehind: 0.9 },
    ability: { kind: 'glide', name: 'Glide', durationSec: 1.5, height: 2.4, cooldownSec: 6 },
    damageTaken: 1,
    thorns: 0,
  },
  {
    id: 'stone',
    name: 'Stone',
    level: 'last',
    model: 'stone',
    color: 0xb9895a,
    maxHealth: 100,
    radius: 0.7,
    move: { kind: 'run', speed: 1.5 },
    attack: { kind: 'none' },
    ability: { kind: 'none' },
    damageTaken: 0.3,
    thorns: 10,
  },
];

export function levelRank(level: LevelId): number {
  return LEVELS.findIndex((l) => l.id === level);
}

export function bodiesOnRank(rank: number): BodyDef[] {
  const level = LEVELS[rank];
  return level ? BODIES.filter((b) => b.level === level.id) : [];
}

export function bodyById(id: string): BodyDef {
  const body = BODIES.find((b) => b.id === id);
  if (!body) throw new Error(`Unknown body: ${id}`);
  return body;
}
