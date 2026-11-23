import { BODIES } from '../content/bodies.ts';
import type { UpgradeDef } from '../content/upgrades.ts';
import type { RunResult } from '../game/game.ts';

function screen(parent: HTMLElement): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'screen hidden';
  parent.appendChild(d);
  return d;
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Start, pause, upgrade choice and results. */
export class Screens {
  private readonly start: HTMLDivElement;
  private readonly pause: HTMLDivElement;
  private readonly levelUp: HTMLDivElement;
  private readonly results: HTMLDivElement;
  private shownChoices: UpgradeDef[] | null = null;
  onStart: () => void = () => {};
  onResume: () => void = () => {};
  onChoose: (index: number) => void = () => {};

  constructor(parent: HTMLElement) {
    this.start = screen(parent);
    this.start.innerHTML = `
      <h1>Come Back Wrong</h1>
      <p>Survive five minutes. Every death brings you back as something else.</p>
      <div class="keys">
        <b>W A S D</b><span>Move</span>
        <b>Mouse</b><span>Turn the camera</span>
        <b>Wheel</b><span>Zoom</span>
        <b>Space</b><span>Body ability</span>
        <b>Hold E</b><span>Let go (die on purpose)</span>
        <b>Esc</b><span>Pause</span>
      </div>
      <button class="button" data-act="start">Begin</button>`;
    this.pause = screen(parent);
    this.pause.innerHTML = `<h2>Paused</h2><button class="button" data-act="resume">Resume</button>`;
    this.levelUp = screen(parent);
    this.results = screen(parent);

    parent.addEventListener('click', (ev) => {
      const target = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!target) return;
      const act = target.dataset.act;
      if (act === 'start') this.onStart();
      else if (act === 'resume') this.onResume();
      else if (act === 'choose') this.onChoose(Number(target.dataset.index));
    });
  }

  showStart(on: boolean): void {
    this.start.classList.toggle('hidden', !on);
  }

  showPause(on: boolean): void {
    this.pause.classList.toggle('hidden', !on);
  }

  showChoices(choices: UpgradeDef[] | null): void {
    if (choices === this.shownChoices) return;
    this.shownChoices = choices;
    if (!choices) {
      this.levelUp.classList.add('hidden');
      return;
    }
    const cards = choices
      .map(
        (c, i) => `
        <button class="card" data-act="choose" data-index="${i}">
          <div class="num">${i + 1}</div>
          <div class="name">${c.name}</div>
          <div class="text">${c.text}</div>
        </button>`,
      )
      .join('');
    this.levelUp.innerHTML = `<h2>Soul upgrade</h2><p>Click a card or press 1, 2 or 3</p><br /><div class="cards">${cards}</div>`;
    this.levelUp.classList.remove('hidden');
  }

  showResults(r: RunResult | null): void {
    if (!r) {
      this.results.classList.add('hidden');
      return;
    }
    const lives = r.lives
      .map((l) => {
        const body = BODIES.find((b) => b.name === l.body);
        const color = body ? '#' + body.color.toString(16).padStart(6, '0') : '#fff';
        return `<li><span class="dot" style="background:${color}"></span>${l.body} <small>(${l.level})</small> · ${Math.round(l.seconds)} s</li>`;
      })
      .join('');
    this.results.innerHTML = `
      <h2>${r.won ? 'You made it to 5:00' : 'Run over'}</h2>
      <div class="stats">
        <div><b>${clock(r.time)}</b>time</div>
        <div><b>${r.kills}</b>kills</div>
        <div><b>${r.lives.length}</b>bodies lived</div>
      </div>
      <ol class="lives">${lives}</ol>
      <button class="button" data-act="start">Play again</button>`;
    this.results.classList.remove('hidden');
  }
}
