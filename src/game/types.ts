/** What the player (or the autoplay bot) wants this step, in world space. */
export interface Input {
  moveX: number;
  moveZ: number;
  ability: boolean;
  letGo: boolean;
}

export const NO_INPUT: Input = { moveX: 0, moveZ: 0, ability: false, letGo: false };

/** One-shot visual events. The simulation emits them; the renderer draws them. */
export type FxEvent =
  | { kind: 'arc'; x: number; z: number; dir: number; range: number; arcDeg: number; ghost: boolean }
  | { kind: 'ring'; x: number; z: number; radius: number; tone: 'shock' | 'blast' | 'land' | 'ghost' }
  | { kind: 'line'; x1: number; z1: number; x2: number; z2: number; ghost: boolean }
  | { kind: 'puff'; x: number; z: number; tone: 'enemy' | 'elite' | 'egg' | 'soul' | 'hit' | 'bite'; count: number };

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  kind: 'rock' | 'tree';
  /** 0..1, used only to vary the look. */
  variant: number;
}
