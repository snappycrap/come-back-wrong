import { LEVELS } from '../content/bodies.ts';
import { GHOSTS, LADDER, RUN } from '../content/tuning.ts';
import type { Game } from '../game/game.ts';

/** Position of a life score on the meter, in percent. */
const METER_MAX = 100;

function el(parent: HTMLElement, cls: string, html = ''): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}

/** Only touches the DOM when a value actually changes. */
class Cached {
  private last = '';
  private readonly apply: (v: string) => void;
  constructor(apply: (v: string) => void) {
    this.apply = apply;
  }
  set(v: string): void {
    if (v === this.last) return;
    this.last = v;
    this.apply(v);
  }
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly timer: Cached;
  private readonly bodyName: Cached;
  private readonly hpFill: Cached;
  private readonly hpLabel: Cached;
  private readonly xpFill: Cached;
  private readonly xpLabel: Cached;
  private readonly ghostSlots: HTMLDivElement[] = [];
  private readonly ghostState: Cached;
  private readonly lifeLabel: Cached;
  private readonly lifeHint: Cached;
  private readonly lifeFill: Cached;
  private readonly lifeClass: Cached;
  private readonly marks: Cached;
  private readonly abilityText: Cached;
  private readonly abilityFill: Cached;
  private readonly abilityClass: Cached;
  private readonly letGoFill: Cached;
  private readonly letGoClass: Cached;
  private readonly letGoText: Cached;
  private readonly debug: HTMLDivElement;

  constructor(parent: HTMLElement) {
    const root = el(parent, 'hud hidden');
    this.root = root;

    const centre = el(root, 'top-centre');
    const timer = el(centre, 'timer', '0:00');
    const name = el(centre, 'body-name');
    this.timer = new Cached((v) => (timer.textContent = v));
    this.bodyName = new Cached((v) => (name.innerHTML = v));

    const left = el(root, 'top-left');
    const hp = el(left, 'bar health', '<div class="fill"></div><div class="label"></div>');
    const xp = el(left, 'bar xp', '<div class="fill"></div><div class="label"></div>');
    const hpFill = hp.children[0] as HTMLElement;
    const hpLabel = hp.children[1] as HTMLElement;
    const xpFill = xp.children[0] as HTMLElement;
    const xpLabel = xp.children[1] as HTMLElement;
    this.hpFill = new Cached((v) => (hpFill.style.width = v));
    this.hpLabel = new Cached((v) => (hpLabel.textContent = v));
    this.xpFill = new Cached((v) => (xpFill.style.width = v));
    this.xpLabel = new Cached((v) => (xpLabel.textContent = v));

    const right = el(root, 'top-right');
    el(right, 'ghost-title', 'Ghosts');
    const ghosts = el(right, 'ghosts');
    for (let i = 0; i < GHOSTS.max; i++) this.ghostSlots.push(el(ghosts, 'ghost-slot'));
    this.ghostState = new Cached((v) => {
      const parts = v.split('|');
      this.ghostSlots.forEach((slot, i) => {
        const part = parts[i] ?? '';
        slot.className = 'ghost-slot' + (part ? ' filled' : '') + (part.endsWith('~') ? ' fading' : '');
        slot.textContent = part.replace('~', '');
        slot.title = part;
      });
    });

    const bottom = el(root, 'bottom');
    const head = el(bottom, 'life-head', '<span></span><span></span>');
    const lifeLabel = head.children[0] as HTMLElement;
    const lifeHint = head.children[1] as HTMLElement;
    const life = el(bottom, 'life', '<div class="fill"></div>');
    const lifeFill = life.children[0] as HTMLElement;
    this.lifeLabel = new Cached((v) => (lifeLabel.textContent = v));
    this.lifeHint = new Cached((v) => (lifeHint.textContent = v));
    this.lifeFill = new Cached((v) => (lifeFill.style.width = v));
    this.lifeClass = new Cached((v) => (lifeFill.className = 'fill ' + v));
    this.marks = new Cached((v) => {
      life.querySelectorAll('.mark').forEach((m) => m.remove());
      for (const part of v.split('|')) {
        const [at, text] = part.split(':');
        const mark = el(life, 'mark', `<span>${text}</span>`);
        mark.style.left = `${at}%`;
      }
    });

    const chips = el(bottom, 'chips');
    const ability = el(chips, 'chip', '<div class="fill"></div><span></span>');
    const abilityFill = ability.children[0] as HTMLElement;
    const abilityText = ability.children[1] as HTMLElement;
    this.abilityText = new Cached((v) => (abilityText.innerHTML = v));
    this.abilityFill = new Cached((v) => (abilityFill.style.width = v));
    this.abilityClass = new Cached((v) => (ability.className = 'chip ' + v));
    const letGo = el(chips, 'chip letgo', '<div class="fill"></div><span></span>');
    const letGoFill = letGo.children[0] as HTMLElement;
    const letGoText = letGo.children[1] as HTMLElement;
    this.letGoFill = new Cached((v) => (letGoFill.style.width = v));
    this.letGoClass = new Cached((v) => (letGo.className = 'chip letgo ' + v));
    this.letGoText = new Cached((v) => (letGoText.innerHTML = v));

    this.debug = el(root, 'debug hidden');
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  toggleDebug(): void {
    this.debug.classList.toggle('hidden');
  }

  setDebug(text: string): void {
    if (!this.debug.classList.contains('hidden')) this.debug.textContent = text;
  }

  update(g: Game): void {
    const p = g.player;
    const left = Math.max(0, RUN.durationSec - g.time);
    const shown = Math.ceil(left);
    this.timer.set(`${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`);

    const level = LEVELS[g.rank];
    this.bodyName.set(`<span class="level">${level ? level.name : ''} ·</span> ${p.body.name}`);

    const hp = Math.max(0, p.hp);
    this.hpFill.set(`${((hp / p.maxHp) * 100).toFixed(1)}%`);
    this.hpLabel.set(`${Math.ceil(hp)} / ${Math.round(p.maxHp)}`);
    this.xpFill.set(`${Math.min(100, (g.xp / g.xpNeeded) * 100).toFixed(1)}%`);
    this.xpLabel.set(`Soul level ${g.level}`);

    this.ghostState.set(g.ghosts.map((gh) => gh.body.name.slice(0, 2) + (gh.fading ? '~' : '')).join('|'));

    // Life-score meter. On the Last-chance level it shows the 45 s to survive.
    if (g.rank === 0) {
      const t = Math.min(p.lifeTime, LADDER.lastChancePromoteSec);
      this.lifeLabel.set(`Last chance: ${Math.floor(t)} s`);
      this.lifeHint.set('Dying here ends the run');
      this.lifeFill.set(`${((t / METER_MAX) * 100).toFixed(1)}%`);
      this.lifeClass.set('stay');
      this.marks.set(`${LADDER.lastChancePromoteSec}:▲ survive ${LADDER.lastChancePromoteSec} s`);
    } else {
      const score = g.lifeScore;
      const top = g.rank === LEVELS.length - 1;
      const band = score >= LADDER.upScore ? 'up' : score >= LADDER.stayScore ? 'stay' : 'down';
      this.lifeLabel.set(`Life score ${Math.floor(score)}`);
      this.lifeHint.set(
        band === 'up'
          ? top
            ? 'Next death: stay Noble'
            : 'Next death: go up'
          : band === 'stay'
            ? 'Next death: stay'
            : 'Next death: go down',
      );
      this.lifeFill.set(`${Math.min(100, (score / METER_MAX) * 100).toFixed(1)}%`);
      this.lifeClass.set(band);
      this.marks.set(`${LADDER.stayScore}:${LADDER.stayScore} stay|${LADDER.upScore}:${LADDER.upScore} ▲ up`);
    }

    const ability = p.body.ability;
    if (ability.kind === 'none') {
      this.abilityText.set('No ability');
      this.abilityFill.set('0%');
      this.abilityClass.set('off');
    } else {
      const ready = p.abilityCd <= 0;
      this.abilityText.set(`<kbd>Space</kbd>${ability.name}`);
      this.abilityFill.set(ready ? '0%' : `${((1 - p.abilityCd / ability.cooldownSec) * 100).toFixed(0)}%`);
      this.abilityClass.set(ready ? 'ready' : '');
    }

    if (g.rank === 0) {
      this.letGoText.set('Cannot let go');
      this.letGoFill.set('0%');
      this.letGoClass.set('off');
    } else {
      this.letGoText.set('<kbd>Hold E</kbd>Let go');
      this.letGoFill.set(`${Math.min(100, (p.letGoT / LADDER.letGoHoldSec) * 100).toFixed(0)}%`);
      this.letGoClass.set('');
    }
  }
}
