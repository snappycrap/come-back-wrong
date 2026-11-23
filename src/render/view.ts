import * as THREE from 'three';
import { CAMERA, COMBAT, PALETTE, REBIRTH, RENDER } from '../content/tuning.ts';
import type { BodyDef } from '../content/bodies.ts';
import type { Game } from '../game/game.ts';
import { buildArena } from './arenaRender.ts';
import { BodyVisual } from './bodyModels.ts';
import type { BodyPose } from './bodyModels.ts';
import { Effects } from './effects.ts';
import { EnemyRenderer } from './enemyRender.ts';

function blobShadow(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(1, 16);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: PALETTE.shadow, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  mesh.position.y = 0.04;
  return mesh;
}

interface GhostView {
  visual: BodyVisual;
  shadow: THREE.Mesh;
  pose: BodyPose;
  travelled: number;
}

/** Everything drawn in 3D. Reads the game state; never changes it. */
export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly enemies = new EnemyRenderer();
  private readonly effects = new Effects();
  private readonly dynamic = new THREE.Group();
  private playerVisual: BodyVisual | null = null;
  private playerBody: BodyDef | null = null;
  private readonly playerShadow = blobShadow();
  private readonly ghostViews = new Map<number, GhostView>();
  private arena: THREE.Group | null = null;
  private attackPulse = 0;
  private time = 0;
  private readonly pose: BodyPose = {
    moving: false,
    travelled: 0,
    y: 0,
    time: 0,
    flash: 0,
    invulnerable: false,
    attack: 0,
    dying: 0,
    gliding: false,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 90, 220);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, 1, 0.5, 400);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d2a8, 2.1));
    const sun = new THREE.DirectionalLight(0xfff4dc, 1.5);
    sun.position.set(0.5, 1, 0.35);
    this.scene.add(sun);

    this.dynamic.add(this.enemies.group, this.effects.group, this.playerShadow);
    this.scene.add(this.dynamic);
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Call when a new run starts. */
  reset(g: Game): void {
    if (!this.arena) {
      this.arena = buildArena(g.obstacles);
      this.scene.add(this.arena);
    }
    for (const gv of this.ghostViews.values()) {
      gv.visual.dispose();
      gv.shadow.removeFromParent();
    }
    this.ghostViews.clear();
    this.playerVisual?.dispose();
    this.playerVisual = null;
    this.playerBody = null;
  }

  render(g: Game, alpha: number, dt: number, yaw: number, back: number): void {
    this.time += dt;
    const p = g.player;

    // --- Player ---
    if (this.playerBody !== p.body || !this.playerVisual) {
      this.playerVisual?.dispose();
      this.playerVisual = new BodyVisual(p.body, false);
      this.playerBody = p.body;
      this.dynamic.add(this.playerVisual.group);
    }
    const x = p.px + (p.x - p.px) * alpha;
    const z = p.pz + (p.z - p.pz) * alpha;
    const y = p.py + (p.y - p.py) * alpha;
    if (p.attackPulse > 0) {
      this.attackPulse = 1;
      p.attackPulse = 0;
    }
    this.attackPulse = Math.max(0, this.attackPulse - dt * 7);
    const pose = this.pose;
    pose.moving = p.moving;
    pose.travelled = p.travelled;
    pose.y = y;
    pose.time = this.time;
    pose.flash = Math.min(1, p.flash / COMBAT.flashSec);
    pose.invulnerable = p.invuln > 0;
    pose.attack = this.attackPulse;
    pose.dying = g.rebirth ? 1 - g.rebirth.timer / REBIRTH.slowSec : g.result && !g.result.won ? 1 : 0;
    pose.gliding = p.glideT > 0;
    const pv = this.playerVisual;
    pv.group.position.set(x, 0, z);
    pv.group.rotation.y = p.facing;
    pv.update(pose, dt);
    const lift = 1 / (1 + y * 0.35);
    this.playerShadow.position.set(x, 0.04, z);
    this.playerShadow.scale.setScalar(p.body.radius * 1.3 * lift);

    // --- Ghosts ---
    for (const gv of this.ghostViews.values()) gv.visual.group.visible = false;
    for (const gh of g.ghosts) {
      let gv = this.ghostViews.get(gh.id);
      if (!gv) {
        const visual = new BodyVisual(gh.body, true);
        const shadow = blobShadow();
        (shadow.material as THREE.MeshBasicMaterial).opacity = 0.12;
        this.dynamic.add(visual.group, shadow);
        gv = {
          visual,
          shadow,
          travelled: 0,
          pose: {
            moving: false,
            travelled: 0,
            y: 0,
            time: 0,
            flash: 0,
            invulnerable: false,
            attack: 0,
            dying: 0,
            gliding: false,
          },
        };
        this.ghostViews.set(gh.id, gv);
      }
      const gx = gh.px + (gh.x - gh.px) * alpha;
      const gz = gh.pz + (gh.z - gh.pz) * alpha;
      const step = Math.hypot(gh.x - gh.px, gh.z - gh.pz);
      gv.travelled += step * dt * 60;
      gv.pose.moving = step > 0.01;
      gv.pose.travelled = gv.travelled;
      gv.pose.time = this.time;
      gv.visual.group.visible = true;
      gv.visual.group.position.set(gx, 0, gz);
      gv.visual.group.rotation.y = gh.facing;
      gv.visual.setOpacity(gh.fade);
      gv.visual.update(gv.pose, dt);
      gv.shadow.position.set(gx, 0.04, gz);
      gv.shadow.scale.setScalar(gh.body.radius * 1.2);
    }
    for (const [id, gv] of this.ghostViews) {
      if (gv.visual.group.visible) continue;
      gv.visual.dispose();
      gv.shadow.removeFromParent();
      this.ghostViews.delete(id);
    }

    this.enemies.update(g, alpha);
    this.effects.update(g, alpha, dt, this.time);

    // --- Camera: behind and above, turned by the mouse ---
    const up = back * (CAMERA.up / CAMERA.back);
    this.camera.position.set(x - Math.sin(yaw) * back, up, z - Math.cos(yaw) * back);
    this.camera.lookAt(x, CAMERA.lookHeight, z);

    this.renderer.render(this.scene, this.camera);
  }
}
