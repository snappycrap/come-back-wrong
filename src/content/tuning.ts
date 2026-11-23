// Every tunable number that is not specific to one body, enemy or upgrade.
// Systems read from here; they contain no gameplay numbers of their own.

export const SIM = {
  stepHz: 60,
  /** Upper bound on simulation steps per rendered frame (avoids a spiral of death). */
  maxStepsPerFrame: 30,
  /** Longest real frame time that is fed into the simulation, in seconds. */
  maxFrameSec: 0.1,
};

export const RUN = {
  durationSec: 300,
  startLevel: 'common',
} as const;

export const ARENA = {
  size: 160,
  obstacleCount: 30,
  /** The meadow layout is the same every run. */
  layoutSeed: 7,
  /** No obstacles this close to the centre, where a run starts. */
  clearRadius: 12,
  /** Obstacles stay this far inside the boundary. */
  edgeMargin: 8,
  /** Minimum gap between two obstacles. */
  obstacleGap: 6,
  treeShare: 0.5,
  rockRadius: [1.1, 2.2],
  treeRadius: [0.6, 0.9],
  fencePostSpacing: 4,
} as const;

export const CAMERA = {
  back: 9,
  up: 5,
  minBack: 6,
  maxBack: 14,
  zoomStep: 1,
  /** Radians of turn per pixel of mouse movement. */
  mouseSensitivity: 0.0025,
  fovDeg: 55,
  /** The camera looks at a point this high above the player's feet. */
  lookHeight: 1.2,
} as const;

export const SPAWN = {
  ringMin: 25,
  ringMax: 35,
  startAlive: 20,
  endAlive: 300,
  /** How quickly the horde refills toward its target size. */
  maxPerSecond: 40,
  /** Enemies left further behind than this are moved back into the spawn ring. */
  leashDistance: 50,
  capacity: 400,
} as const;

export const COMBAT = {
  /** Seconds before the same enemy can hurt the player again. */
  touchIntervalSec: 1.0,
  /** After any hit the player cannot be hit again for this long. */
  hitGraceSec: 0.5,
  /** Knockback speed decays by this factor per second (higher = shorter slide). */
  knockbackDecay: 8,
  /** Enemies being knocked back faster than this do not walk. */
  stunSpeed: 1.5,
  flashSec: 0.12,
  /** Share of an overlap that enemies resolve against each other per step. */
  separation: 0.5,
  /** Above this height the player cannot be touched. */
  airborneHeight: 0.6,
} as const;

export const LADDER = {
  upScore: 75,
  stayScore: 30,
  elitePoints: 5,
  lastChancePromoteSec: 45,
  letGoHoldSec: 1,
} as const;

export const REBIRTH = {
  slowScale: 0.2,
  /** Real seconds of slow motion while the wheel spins. */
  slowSec: 1.5,
  shockRadius: 10,
  shockDamage: 20,
  shockKnockback: 6,
  invulnerableSec: 2,
} as const;

export const GHOSTS = {
  max: 5,
  damageShare: 0.4,
  /** Ghosts orbit the player at this distance. */
  followRadius: 3.2,
  /** How eagerly a ghost closes the gap to its slot (per second). */
  followGain: 3,
  maxSpeed: 14,
  orbitSpeed: 0.35,
  fadeSec: 1,
} as const;

export const XP = {
  pickupRadius: 3,
  collectRadius: 0.7,
  magnetSpeed: 16,
  /** Experience needed for level n+1 is base + perLevel * n. */
  base: 10,
  perLevel: 18,
  choices: 3,
  orbCapacity: 512,
} as const;

export const PROJECTILES = {
  eggCapacity: 64,
} as const;

export const RENDER = {
  maxPixelRatio: 1.5,
} as const;

export const PALETTE = {
  sky: 0xcfe8f2,
  meadow: 0x74b84c,
  meadowDark: 0x5fa23e,
  outside: 0x4c8a36,
  tuft: 0x8fd060,
  rock: 0x9a9c94,
  trunk: 0x7a5232,
  leaves: 0x3f8f3c,
  fence: 0xf4f1e6,
  paper: 0xf3efe2,
  paperShade: 0xd9d4c3,
  tie: 0x2a2d3a,
  satchel: 0xb9895a,
  elite: 0xd62f2f,
  ghost: 0xbfe6ff,
  ghostGlow: 0x3f7fae,
  orb: 0xffe27a,
  egg: 0xfff6dc,
  blast: 0xffb347,
  shock: 0xffffff,
  hit: 0xff3b30,
  shadow: 0x10200c,
} as const;

export const MOTION = {
  /** Stick/keyboard input below this size counts as standing still. */
  deadzone: 0.15,
  /** Seconds a glide takes to rise and to settle. */
  glideEaseSec: 0.25,
} as const;

/** Autoplay bot (used by ?autoplay=1 and the automated test). */
export const BOT = {
  /** Enemies closer than this push the bot away. */
  threatRange: 6,
  /** Enemies this close count as a crowd. */
  dangerRange: 3,
  /** A crowd this big makes the bot back off fully and use its ability. */
  dangerCount: 5,
  /** The bot closes to this share of its attack range. */
  engageShare: 0.6,
  /** Engage distance for bodies without a ranged or melee reach (eggs). */
  engageMin: 1.5,
  orbRange: 18,
  orbPull: 0.8,
  /** Sideways drift so the bot circles instead of running into a corner. */
  circle: 0.5,
  edgeStart: 50,
  edgeRange: 25,
  obstacleRange: 3,
  eliteWeight: 3,
} as const;
