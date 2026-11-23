import * as THREE from 'three';
import { CAMERA, SIM } from './content/tuning.ts';
import { botChoice, botInput } from './game/autoplay.ts';
import { Game } from './game/game.ts';
import type { Input } from './game/types.ts';
import { View } from './render/view.ts';
import { Hud } from './ui/hud.ts';
import { Screens } from './ui/screens.ts';
import { Wheel } from './ui/wheel.ts';

type Mode = 'start' | 'playing' | 'paused' | 'results';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const speed = Math.min(16, Math.max(0.1, Number(params.get('speed') ?? '1') || 1));
const autoplay = params.get('autoplay') === '1';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const view = new View(canvas);
const hud = new Hud(ui);
const wheel = new Wheel(ui);
const screens = new Screens(ui);

function newSeed(): number {
  return seedParam !== null ? Number(seedParam) || 0 : Math.floor(Math.random() * 1e9);
}

let game = new Game(newSeed());
let mode: Mode = 'start';
let yaw = 0;
let back: number = CAMERA.back;
let accumulator = 0;
let softUnlock = false;
/** When the pause state last changed, to ignore a doubled Esc signal. */
let pauseChangedAt = -Infinity;
const PAUSE_DEBOUNCE_MS = 250;
const keys = new Set<string>();
const input: Input = { moveX: 0, moveZ: 0, ability: false, letGo: false };

view.reset(game);
screens.showStart(true);

function releasePointer(): void {
  if (document.pointerLockElement !== canvas) return;
  softUnlock = true;
  document.exitPointerLock();
}

function lockPointer(): void {
  if (autoplay || document.pointerLockElement === canvas) return;
  try {
    const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // Pointer lock is unavailable; the game still plays without mouse turning.
  }
}

function startRun(): void {
  game = new Game(newSeed());
  view.reset(game);
  accumulator = 0;
  yaw = 0;
  mode = 'playing';
  screens.showStart(false);
  screens.showResults(null);
  screens.showPause(false);
  hud.show(true);
  lockPointer();
}

function setPaused(paused: boolean): void {
  // Esc can arrive twice (once as "mouse released", once as a key press).
  if (performance.now() - pauseChangedAt < PAUSE_DEBOUNCE_MS) return;
  if ((paused && mode === 'playing') || (!paused && mode === 'paused')) pauseChangedAt = performance.now();
  if (paused && mode === 'playing') {
    mode = 'paused';
    screens.showPause(true);
    keys.clear();
    releasePointer();
  } else if (!paused && mode === 'paused') {
    mode = 'playing';
    screens.showPause(false);
    lockPointer();
  }
}

function choose(index: number): void {
  if (!game.choices || index < 0 || index >= game.choices.length) return;
  game.chooseUpgrade(index);
  screens.showChoices(null);
  lockPointer();
}

screens.onStart = startRun;
screens.onResume = () => setPaused(false);
screens.onChoose = choose;

// ---- Input --------------------------------------------------------------

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' || ev.code === 'F3') ev.preventDefault();
  if (ev.repeat) return;
  keys.add(ev.code);
  switch (ev.code) {
    case 'Escape':
      if (mode === 'playing' && !game.choices) setPaused(true);
      else if (mode === 'paused') setPaused(false);
      break;
    case 'Enter':
      if (mode === 'start' || mode === 'results') startRun();
      break;
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
      if (mode === 'playing') choose(Number(ev.code.slice(5)) - 1);
      break;
    case 'F3':
      hud.toggleDebug();
      break;
    case 'KeyK':
      if (mode === 'playing') game.debugKill();
      break;
    case 'KeyL':
      if (mode === 'playing') game.debugLevelUp();
      break;
    case 'KeyB':
      if (mode === 'playing') game.debugNextBody();
      break;
    case 'KeyG':
      if (mode === 'playing') game.debugAddGhost();
      break;
  }
});
window.addEventListener('keyup', (ev) => keys.delete(ev.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => view.resize());

document.addEventListener('mousemove', (ev) => {
  if (document.pointerLockElement === canvas && mode === 'playing') {
    yaw -= ev.movementX * CAMERA.mouseSensitivity;
  }
});
window.addEventListener(
  'wheel',
  (ev) => {
    back = Math.min(CAMERA.maxBack, Math.max(CAMERA.minBack, back + Math.sign(ev.deltaY) * CAMERA.zoomStep));
  },
  { passive: true },
);
canvas.addEventListener('click', () => {
  if (mode === 'playing' && !game.choices) lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  // The browser releases the mouse on Esc; treat that as "pause".
  if (softUnlock) softUnlock = false;
  else if (mode === 'playing' && !game.choices && !autoplay) setPaused(true);
});

function readInput(): Input {
  const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const right = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  // Camera looks along (sin yaw, cos yaw); its right-hand side is (-cos yaw, sin yaw).
  input.moveX = forward * Math.sin(yaw) - right * Math.cos(yaw);
  input.moveZ = forward * Math.cos(yaw) + right * Math.sin(yaw);
  input.ability = keys.has('Space');
  input.letGo = keys.has('KeyE');
  return input;
}

// ---- Main loop: fixed-step simulation, interpolated rendering --------------

let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
let fps = 0;
let fpsSum = 0;
let fpsSamples = 0;
let lastSteps = 0;
let simMs = 0;
let drawMs = 0;
let shownSimMs = 0;
let shownDrawMs = 0;

function frame(now: number): void {
  const real = Math.min((now - last) / 1000, SIM.maxFrameSec);
  const rawDelta = (now - last) / 1000;
  last = now;

  let visualDt = 0;
  if (mode === 'playing') {
    if (game.choices) {
      if (autoplay) choose(botChoice());
      else releasePointer();
    }
    screens.showChoices(game.choices);
    if (!game.halted) {
      visualDt = real * speed * game.timeScale;
      accumulator += visualDt;
      let steps = 0;
      const simStart = performance.now();
      while (accumulator >= game.dt && steps < SIM.maxStepsPerFrame) {
        game.step(autoplay ? botInput(game) : readInput());
        accumulator -= game.dt;
        steps++;
        if (game.halted) {
          accumulator = 0;
          break;
        }
      }
      if (steps >= SIM.maxStepsPerFrame) accumulator = 0;
      lastSteps = steps;
      simMs += performance.now() - simStart;
    }
    if (game.result) {
      mode = 'results';
      screens.showChoices(null);
      screens.showResults(game.result);
      releasePointer();
    }
  }

  const alpha = mode === 'playing' && !game.halted ? accumulator / game.dt : 1;
  const drawStart = performance.now();
  view.render(game, alpha, visualDt, yaw, back);
  hud.update(game);
  wheel.update(mode === 'playing' || mode === 'paused' ? game.rebirth : null);
  drawMs += performance.now() - drawStart;

  fpsFrames++;
  fpsTime += rawDelta;
  if (fpsTime >= 0.5) {
    fps = fpsFrames / fpsTime;
    if (mode === 'playing') {
      fpsSum += fps;
      fpsSamples++;
    }
    shownSimMs = simMs / fpsFrames;
    shownDrawMs = drawMs / fpsFrames;
    simMs = 0;
    drawMs = 0;
    fpsFrames = 0;
    fpsTime = 0;
    const info = view.renderer.info.render;
    hud.setDebug(
      `fps        ${fps.toFixed(0)}\n` +
        `frame      ${(1000 / Math.max(1, fps)).toFixed(1)} ms\n` +
        `sim steps  ${lastSteps} / frame\n` +
        `game logic ${shownSimMs.toFixed(2)} ms / frame\n` +
        `drawing    ${shownDrawMs.toFixed(2)} ms / frame (this page's share)\n` +
        `enemies    ${game.enemies.count}\n` +
        `orbs       ${game.orbs.count}\n` +
        `ghosts     ${game.ghosts.length}\n` +
        `draw calls ${info.calls}\n` +
        `triangles  ${info.triangles}\n` +
        `pixel ratio ${view.renderer.getPixelRatio().toFixed(2)}\n` +
        `seed       ${game.seed}   speed x${speed}\n` +
        `three.js   r${THREE.REVISION}`,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only hook for the automated test and for debugging in the console.
(window as unknown as { __cbw: unknown }).__cbw = {
  state: () => ({
    mode,
    time: game.time,
    body: game.player.body.name,
    rank: game.rank,
    rebirths: game.stats.rebirths,
    levelUps: game.stats.levelUps,
    kills: game.stats.kills,
    enemies: game.enemies.count,
    ghosts: game.ghosts.length,
    won: game.result ? game.result.won : null,
    fps,
    averageFps: fpsSamples > 0 ? fpsSum / fpsSamples : 0,
    simMs: shownSimMs,
    drawMs: shownDrawMs,
    drawCalls: view.renderer.info.render.calls,
    choosing: game.choices !== null,
    cameraYaw: yaw,
    cameraBack: back,
    pointerLocked: document.pointerLockElement === canvas,
    x: game.player.x,
    z: game.player.z,
  }),
};

if (autoplay) startRun();
