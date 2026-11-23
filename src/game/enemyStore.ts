/** Pooled enemies stored as flat arrays. Live enemies are indices 0..count-1. */
export class EnemyStore {
  count = 0;
  readonly capacity: number;
  readonly x: Float32Array;
  readonly z: Float32Array;
  /** Position at the previous step, for render interpolation. */
  readonly px: Float32Array;
  readonly pz: Float32Array;
  readonly hp: Float32Array;
  readonly touchCd: Float32Array;
  readonly flash: Float32Array;
  /** Knockback velocity. */
  readonly kx: Float32Array;
  readonly kz: Float32Array;
  readonly facing: Float32Array;
  /** Walk-cycle phase, for the renderer. */
  readonly phase: Float32Array;
  readonly type: Uint8Array;
  readonly dead: Uint8Array;
  /** Id of the last multi-step attack that hit this enemy. */
  readonly stamp: Int32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    const f = () => new Float32Array(capacity);
    this.x = f();
    this.z = f();
    this.px = f();
    this.pz = f();
    this.hp = f();
    this.touchCd = f();
    this.flash = f();
    this.kx = f();
    this.kz = f();
    this.facing = f();
    this.phase = f();
    this.type = new Uint8Array(capacity);
    this.dead = new Uint8Array(capacity);
    this.stamp = new Int32Array(capacity);
  }

  add(type: number, x: number, z: number, hp: number, phase: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.x[i] = x;
    this.z[i] = z;
    this.px[i] = x;
    this.pz[i] = z;
    this.hp[i] = hp;
    this.touchCd[i] = 0;
    this.flash[i] = 0;
    this.kx[i] = 0;
    this.kz[i] = 0;
    this.facing[i] = 0;
    this.phase[i] = phase;
    this.type[i] = type;
    this.dead[i] = 0;
    this.stamp[i] = 0;
    return i;
  }

  /** Removes dead enemies by moving the last live one into each gap. */
  compact(): void {
    let i = 0;
    while (i < this.count) {
      if (!this.dead[i]) {
        i++;
        continue;
      }
      const last = --this.count;
      if (i !== last) {
        this.x[i] = this.x[last] as number;
        this.z[i] = this.z[last] as number;
        this.px[i] = this.px[last] as number;
        this.pz[i] = this.pz[last] as number;
        this.hp[i] = this.hp[last] as number;
        this.touchCd[i] = this.touchCd[last] as number;
        this.flash[i] = this.flash[last] as number;
        this.kx[i] = this.kx[last] as number;
        this.kz[i] = this.kz[last] as number;
        this.facing[i] = this.facing[last] as number;
        this.phase[i] = this.phase[last] as number;
        this.type[i] = this.type[last] as number;
        this.dead[i] = this.dead[last] as number;
        this.stamp[i] = this.stamp[last] as number;
      }
    }
  }
}
