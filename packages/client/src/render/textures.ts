import Phaser from 'phaser';
import { drawRunner, drawHat, RUNNER, type RunnerPose, type HatId } from './characters';
import {
  BARRAGE,
  GATE,
  HURDLE,
  ORB,
  PICKUP,
  drawBarrage,
  drawGate,
  drawHurdle,
  drawPickup,
  drawThrownOrb,
} from './props';
import {
  CLOUDS,
  GROUND,
  HILLS,
  MOUNTAINS,
  SKY,
  TREES,
  drawClouds,
  drawGround,
  drawHills,
  drawMountains,
  drawSky,
  drawSun,
  drawTrees,
} from './environment';

/**
 * Bakes the Canvas2D art into Phaser textures.
 *
 * Everything is drawn at SUPERSAMPLE times its logical size and then displayed
 * scaled back down, which is what keeps the curves and outlines crisp instead
 * of aliased. Sprites therefore need `setScale(1 / SUPERSAMPLE)` (or the
 * SPRITE_SCALE helper) to end up at their authored size.
 */
export const SUPERSAMPLE = 3;
export const SPRITE_SCALE = 1 / SUPERSAMPLE;

export const RUNNER_FRAMES = {
  run: ['run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7'],
  jump: 'jump',
  fall: 'fall',
  duck: 'duck',
  stumble: 'stumble',
} as const;

export const TEX = {
  sky: 'sky',
  sun: 'sun',
  clouds: 'clouds',
  mountains: 'mountains',
  hills: 'hills',
  trees: 'trees',
  ground: 'ground',
  soil: 'soil',
  hurdle: 'obstacle-hurdle',
  barrage: 'obstacle-barrage',
  orb: 'obstacle-orb',
  pickupSpeed: 'pickup-speed',
  pickupShield: 'pickup-shield',
  gateCheckpoint: 'gate-checkpoint',
  gateFinish: 'gate-finish',
  hatTop: 'hat-top_hat',
  hatCrown: 'hat-crown',
  shadow: 'fx-shadow',
  dust: 'fx-dust',
  spark: 'fx-spark',
  confetti: 'fx-confetti',
} as const;

export const SIZES = {
  runner: RUNNER,
  hurdle: HURDLE,
  barrage: BARRAGE,
  orb: ORB,
  pickup: PICKUP,
  gate: GATE,
  sky: SKY,
  clouds: CLOUDS,
  mountains: MOUNTAINS,
  hills: HILLS,
  trees: TREES,
  ground: GROUND,
} as const;

/** Bakes at 1:1 - for soft FX sprites that are scaled at runtime anyway. */
function bakeRaw(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

function bake(
  scene: Phaser.Scene,
  key: string,
  logicalW: number,
  logicalH: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) return scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  const tex = scene.textures.createCanvas(key, logicalW * SUPERSAMPLE, logicalH * SUPERSAMPLE);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return tex;
}

function bakeSoil(ctx: CanvasRenderingContext2D) {
  const w = 256;
  const h = 120;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6b4a35');
  g.addColorStop(1, '#38251a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, 5);
  let s = 1337;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  for (let i = 0; i < 40; i++) {
    const x = rand() * w;
    const y = 10 + rand() * (h - 20);
    const r = 1.5 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bakeShadow(ctx: CanvasRenderingContext2D) {
  const r = 32;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(12,9,28,0.55)');
  g.addColorStop(0.6, 'rgba(12,9,28,0.22)');
  g.addColorStop(1, 'rgba(12,9,28,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(r, r, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function bakeDust(ctx: CanvasRenderingContext2D) {
  const r = 16;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,246,232,0.9)');
  g.addColorStop(0.5, 'rgba(226,205,182,0.45)');
  g.addColorStop(1, 'rgba(214,192,168,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
}

function bakeSpark(ctx: CanvasRenderingContext2D) {
  const r = 10;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,236,160,0.9)');
  g.addColorStop(1, 'rgba(255,196,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
}

function bakeConfetti(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 8, 12);
}

/** Static world/prop/FX textures. Idempotent. */
export function ensureStaticTextures(scene: Phaser.Scene) {
  bake(scene, TEX.sky, SKY.width, SKY.height, drawSky);
  bake(scene, TEX.sun, 340, 340, (c) => drawSun(c, 340));
  bake(scene, TEX.clouds, CLOUDS.width, CLOUDS.height, drawClouds);
  bake(scene, TEX.mountains, MOUNTAINS.width, MOUNTAINS.height, drawMountains);
  bake(scene, TEX.hills, HILLS.width, HILLS.height, drawHills);
  bake(scene, TEX.trees, TREES.width, TREES.height, drawTrees);
  bake(scene, TEX.ground, GROUND.width, GROUND.height, drawGround);
  bake(scene, TEX.soil, 256, 120, bakeSoil);

  bake(scene, TEX.hurdle, HURDLE.width, HURDLE.height, drawHurdle);
  bake(scene, TEX.barrage, BARRAGE.width, BARRAGE.height, drawBarrage);
  bake(scene, TEX.orb, ORB.size, ORB.size, drawThrownOrb);
  bake(scene, TEX.pickupSpeed, PICKUP.size, PICKUP.size, (c) => drawPickup(c, 'speed'));
  bake(scene, TEX.pickupShield, PICKUP.size, PICKUP.size, (c) => drawPickup(c, 'shield'));
  bake(scene, TEX.gateCheckpoint, GATE.width, GATE.height, (c) => drawGate(c, 'checkpoint'));
  bake(scene, TEX.gateFinish, GATE.width, GATE.height, (c) => drawGate(c, 'finish'));

  bake(scene, TEX.hatTop, 46, 30, (c) => {
    c.translate(23, 26);
    drawHat(c, 'top_hat');
  });
  bake(scene, TEX.hatCrown, 46, 30, (c) => {
    c.translate(23, 26);
    drawHat(c, 'crown');
  });

  bakeRaw(scene, TEX.shadow, 64, 64, bakeShadow);
  bakeRaw(scene, TEX.dust, 32, 32, bakeDust);
  bakeRaw(scene, TEX.spark, 20, 20, bakeSpark);
  bakeRaw(scene, TEX.confetti, 8, 12, bakeConfetti);
}

export function hatTextureFor(hat: string | undefined): string | null {
  if (hat === 'top_hat') return TEX.hatTop;
  if (hat === 'crown') return TEX.hatCrown;
  return null;
}

const POSE_ORDER: { name: string; pose: RunnerPose; phase: number }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ name: `run${i}`, pose: 'run' as RunnerPose, phase: i / 8 })),
  { name: 'jump', pose: 'jump', phase: 0 },
  { name: 'fall', pose: 'fall', phase: 0 },
  { name: 'duck', pose: 'duck', phase: 0 },
  { name: 'stumble', pose: 'stumble', phase: 0 },
];

const runnerKeyFor = (color: string) => `runner:${color}`;

/**
 * Bakes one horizontal strip of every pose for a given player color. Colors are
 * baked on demand (there are only ever a handful in a race) so each character
 * gets real shading in its own hue rather than a flat tint over a white sprite.
 */
export function ensureRunnerTexture(scene: Phaser.Scene, color: string): string {
  const key = runnerKeyFor(color);
  if (scene.textures.exists(key)) return key;

  const fw = RUNNER.width;
  const fh = RUNNER.height;
  const tex = scene.textures.createCanvas(key, fw * POSE_ORDER.length * SUPERSAMPLE, fh * SUPERSAMPLE);
  if (!tex) return key;

  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  POSE_ORDER.forEach((entry, i) => {
    ctx.save();
    ctx.translate(i * fw + RUNNER.footX, RUNNER.footY);
    drawRunner(ctx, { color, pose: entry.pose, phase: entry.phase });
    ctx.restore();
  });
  ctx.restore();

  POSE_ORDER.forEach((entry, i) => {
    tex.add(entry.name, 0, i * fw * SUPERSAMPLE, 0, fw * SUPERSAMPLE, fh * SUPERSAMPLE);
  });
  tex.refresh();
  return key;
}

export type { RunnerPose, HatId };
