/**
 * Uniform grid over a square world centred on the origin. Rebuilt from
 * scratch with a counting sort, so it allocates nothing per frame.
 */
export class SpatialHash {
  private readonly cell: number;
  private readonly dim: number;
  private readonly half: number;
  private readonly start: Int32Array;
  private readonly cursor: Int32Array;
  private readonly items: Int32Array;
  private readonly cellOf: Int32Array;

  constructor(worldSize: number, cellSize: number, capacity: number) {
    this.cell = cellSize;
    this.dim = Math.ceil(worldSize / cellSize);
    this.half = worldSize / 2;
    this.start = new Int32Array(this.dim * this.dim + 1);
    this.cursor = new Int32Array(this.dim * this.dim);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  private axis(v: number): number {
    const c = Math.floor((v + this.half) / this.cell);
    return c < 0 ? 0 : c >= this.dim ? this.dim - 1 : c;
  }

  build(count: number, xs: ArrayLike<number>, zs: ArrayLike<number>): void {
    const { start, cursor, items, cellOf, dim } = this;
    start.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.axis(zs[i] as number) * dim + this.axis(xs[i] as number);
      cellOf[i] = c;
      start[c + 1] = (start[c + 1] as number) + 1;
    }
    for (let c = 0; c < dim * dim; c++) {
      start[c + 1] = (start[c + 1] as number) + (start[c] as number);
      cursor[c] = start[c] as number;
    }
    for (let i = 0; i < count; i++) {
      const c = cellOf[i] as number;
      items[cursor[c] as number] = i;
      cursor[c] = (cursor[c] as number) + 1;
    }
  }

  /**
   * Writes the indices of everything in cells touched by the circle into
   * `out` and returns how many. Callers still check the exact distance.
   */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    const { start, items, dim } = this;
    const x0 = this.axis(x - radius);
    const x1 = this.axis(x + radius);
    const z0 = this.axis(z - radius);
    const z1 = this.axis(z + radius);
    let n = 0;
    for (let cz = z0; cz <= z1; cz++) {
      const row = cz * dim;
      const from = start[row + x0] as number;
      const to = start[row + x1 + 1] as number;
      for (let k = from; k < to && n < out.length; k++) {
        out[n++] = items[k] as number;
      }
    }
    return n;
  }
}
