// The clerks of the afterlife. `look` picks the shape from
// src/render/enemyRender.ts.

export type SpawnRule =
  /** Part of the horde that ramps up over the run; weight is its share. */
  | { kind: 'horde'; weight: number }
  /** One arrives on a timer, on top of the horde. */
  | { kind: 'timed'; everySec: number };

export interface EnemyDef {
  id: string;
  name: string;
  look: 'clerk' | 'courier' | 'auditor';
  health: number;
  speed: number;
  touchDamage: number;
  radius: number;
  /** Counts toward the life score when killed. */
  elite: boolean;
  /** 0 = pushed the full distance, 1 = cannot be pushed. */
  knockbackResist: number;
  experience: number;
  spawn: SpawnRule;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'clerk',
    name: 'Clerk',
    look: 'clerk',
    health: 10,
    speed: 3,
    touchDamage: 5,
    radius: 0.5,
    elite: false,
    knockbackResist: 0,
    experience: 1,
    spawn: { kind: 'horde', weight: 0.75 },
  },
  {
    id: 'courier',
    name: 'Courier',
    look: 'courier',
    health: 6,
    speed: 6.5,
    touchDamage: 4,
    radius: 0.42,
    elite: false,
    knockbackResist: 0,
    experience: 1,
    spawn: { kind: 'horde', weight: 0.25 },
  },
  {
    id: 'auditor',
    name: 'Auditor',
    look: 'auditor',
    health: 150,
    speed: 2.5,
    touchDamage: 15,
    radius: 1.0,
    elite: true,
    knockbackResist: 0.7,
    experience: 10,
    spawn: { kind: 'timed', everySec: 45 },
  },
];
