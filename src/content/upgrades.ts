// Soul upgrades: they belong to the soul, so they survive every death in a run.

export interface SoulStats {
  /** Multiplier on all damage dealt by the player and ghosts. */
  damage: number;
  /** Multiplier on how fast attacks repeat. */
  attackSpeed: number;
  moveSpeed: number;
  pickupRadius: number;
  /** Added to every body's maximum health. */
  maxHealthBonus: number;
  /** Health regained per second. */
  regen: number;
  /** Extra multiplier on ghost damage. */
  ghostDamage: number;
  /** Multiplier on the rebirth shockwave radius. */
  shockwaveRadius: number;
}

export const BASE_SOUL: SoulStats = {
  damage: 1,
  attackSpeed: 1,
  moveSpeed: 1,
  pickupRadius: 1,
  maxHealthBonus: 0,
  regen: 0,
  ghostDamage: 1,
  shockwaveRadius: 1,
};

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  stat: keyof SoulStats;
  /** Added to the stat each time the upgrade is taken. */
  add: number;
  /** Health restored on the spot when taken. */
  heal: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'damage', name: 'Sharper', text: '+20% damage', stat: 'damage', add: 0.2, heal: 0 },
  { id: 'haste', name: 'Quicker', text: '+15% attack speed', stat: 'attackSpeed', add: 0.15, heal: 0 },
  { id: 'speed', name: 'Lighter', text: '+10% move speed', stat: 'moveSpeed', add: 0.1, heal: 0 },
  { id: 'pickup', name: 'Wider reach', text: '+25% pickup radius', stat: 'pickupRadius', add: 0.25, heal: 0 },
  { id: 'health', name: 'Sturdier', text: '+20 max health, heal 20', stat: 'maxHealthBonus', add: 20, heal: 20 },
  { id: 'regen', name: 'Mending', text: 'Regenerate 1 health per second', stat: 'regen', add: 1, heal: 0 },
  { id: 'ghosts', name: 'Louder ghosts', text: '+25% ghost damage', stat: 'ghostDamage', add: 0.25, heal: 0 },
  { id: 'shock', name: 'Bigger return', text: '+50% rebirth shockwave radius', stat: 'shockwaveRadius', add: 0.5, heal: 0 },
];
