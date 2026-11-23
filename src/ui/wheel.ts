import { BODIES, LEVELS, bodiesOnRank } from '../content/bodies.ts';
import type { BodyDef } from '../content/bodies.ts';
import { REBIRTH } from '../content/tuning.ts';
import type { RebirthState } from '../game/game.ts';

const SIZE = 420;
const SPINS = 4;
/** Share of the slow-motion time the wheel spends spinning before it rests. */
const SPIN_SHARE = 0.72;

function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** The rebirth wheel: all bodies on it, only the target level lit. */
export class Wheel {
  private readonly root: HTMLDivElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly verdict: HTMLDivElement;
  private readonly reborn: HTMLDivElement;
  /** Bodies in ladder order, highest level first. */
  private readonly order: BodyDef[];
  private current: RebirthState | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'wheel hidden';
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    this.root.appendChild(canvas);
    this.verdict = document.createElement('div');
    this.verdict.className = 'verdict';
    this.reborn = document.createElement('div');
    this.reborn.className = 'reborn';
    this.root.append(this.verdict, this.reborn);
    parent.appendChild(this.root);
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.order = LEVELS.slice()
      .reverse()
      .flatMap((level) => BODIES.filter((b) => b.level === level.id));
  }

  update(r: RebirthState | null): void {
    if (!r) {
      if (this.current) {
        this.current = null;
        this.root.classList.add('hidden');
      }
      return;
    }
    if (this.current !== r) {
      this.current = r;
      this.root.classList.remove('hidden');
      const level = LEVELS[r.toRank];
      const name = level ? level.name : '';
      const score = Math.floor(r.score);
      this.verdict.textContent = r.promoted
        ? `▲ Survived: up to ${name}`
        : r.verdict === 'up'
          ? `▲ Life score ${score}: up to ${name}`
          : r.verdict === 'down'
            ? `▼ Life score ${score}: down to ${name}`
            : `● Life score ${score}: stay ${name}`;
    }
    const progress = Math.min(1, 1 - r.timer / REBIRTH.slowSec);
    const spin = Math.min(1, progress / SPIN_SHARE);
    this.reborn.textContent = spin >= 1 ? r.to.name : '';
    this.draw(r, spin);
  }

  private draw(r: RebirthState, spin: number): void {
    const ctx = this.ctx;
    const n = this.order.length;
    const seg = (Math.PI * 2) / n;
    const lit = bodiesOnRank(r.toRank);
    const target = this.order.indexOf(r.to);
    const ease = 1 - Math.pow(1 - spin, 3);
    // The pointer is at the top; rest with the chosen segment's middle under it.
    const rest = -Math.PI / 2 - (target + 0.5) * seg;
    const rotation = rest - (1 - ease) * SPINS * Math.PI * 2;
    const c = SIZE / 2;
    const radius = c - 18;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(rotation);
    for (let i = 0; i < n; i++) {
      const body = this.order[i] as BodyDef;
      const on = lit.includes(body);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = on ? css(body.color) : '#59606e';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1d2230';
      ctx.stroke();

      ctx.save();
      ctx.rotate((i + 0.5) * seg);
      ctx.fillStyle = on ? '#1d2230' : '#aab0bc';
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(body.name, radius * 0.62, 0);
      ctx.restore();
    }
    ctx.restore();

    // Hub and pointer.
    ctx.beginPath();
    ctx.arc(c, c, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#f3efe2';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1d2230';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - 16, 2);
    ctx.lineTo(c + 16, 2);
    ctx.lineTo(c, 36);
    ctx.closePath();
    ctx.fillStyle = '#f3efe2';
    ctx.fill();
    ctx.stroke();
  }
}
