/**
 * Dev-only art contact sheet. Not part of the production bundle (Vite only
 * builds index.html), it exists so character/prop art can be iterated on
 * visually without launching a whole race.
 */
import { drawRunner, drawHat, drawShadow, RUNNER, type RunnerPose } from './characters';
import { WORLD } from './palette';

const SS = 3; // supersample factor, matching how textures are baked in-game

function sheet(title: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const root = document.getElementById('root')!;
  const heading = document.createElement('h2');
  heading.textContent = title;
  root.appendChild(heading);
  const canvas = document.createElement('canvas');
  canvas.width = w * SS;
  canvas.height = h * SS;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SS, SS);
  draw(ctx);
}

const COLORS = ['#4fd1c5', '#f56565', '#ecc94b', '#9f7aea', '#63b3ed', '#f687b3', '#68d391', '#f6ad55'];

function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, WORLD.skyMid);
  g.addColorStop(1, WORLD.skyHaze);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Run cycle
sheet('run cycle (8 frames)', RUNNER.width * 8, RUNNER.height + 10, (ctx) => {
  backdrop(ctx, RUNNER.width * 8, RUNNER.height + 10);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(i * RUNNER.width + RUNNER.footX, RUNNER.footY);
    drawShadow(ctx, 20);
    drawRunner(ctx, { color: '#4fd1c5', pose: 'run', phase: i / 8 });
    ctx.restore();
  }
});

// Poses
const poses: RunnerPose[] = ['run', 'jump', 'fall', 'duck', 'stumble'];
sheet('poses', RUNNER.width * poses.length, RUNNER.height + 10, (ctx) => {
  backdrop(ctx, RUNNER.width * poses.length, RUNNER.height + 10);
  poses.forEach((pose, i) => {
    ctx.save();
    ctx.translate(i * RUNNER.width + RUNNER.footX, RUNNER.footY);
    drawShadow(ctx, 20);
    drawRunner(ctx, { color: '#f6ad55', pose, phase: 0.12 });
    ctx.restore();
  });
});

// Every player color
sheet('player colors', RUNNER.width * COLORS.length, RUNNER.height + 10, (ctx) => {
  backdrop(ctx, RUNNER.width * COLORS.length, RUNNER.height + 10);
  COLORS.forEach((color, i) => {
    ctx.save();
    ctx.translate(i * RUNNER.width + RUNNER.footX, RUNNER.footY);
    drawShadow(ctx, 20);
    drawRunner(ctx, { color, pose: 'run', phase: 0.1 });
    ctx.restore();
  });
});

// Hats
sheet('hats', RUNNER.width * 2, RUNNER.height + 10, (ctx) => {
  backdrop(ctx, RUNNER.width * 2, RUNNER.height + 10);
  (['top_hat', 'crown'] as const).forEach((hat, i) => {
    ctx.save();
    ctx.translate(i * RUNNER.width + RUNNER.footX, RUNNER.footY);
    drawShadow(ctx, 20);
    drawRunner(ctx, { color: '#63b3ed', pose: 'run', phase: 0.1 });
    ctx.translate(8, -68);
    drawHat(ctx, hat);
    ctx.restore();
  });
});

// ---------------------------------------------------------------------------
// Composed scene mockup - the real test of whether the art reads as one piece.
// ---------------------------------------------------------------------------
import { drawHurdle, drawBarrage, drawThrownOrb, drawPickup, drawGate, HURDLE, BARRAGE, ORB, PICKUP, GATE } from './props';
import {
  drawSky,
  drawSun,
  drawClouds,
  drawMountains,
  drawHills,
  drawTrees,
  drawGround,
  CLOUDS,
  MOUNTAINS,
  HILLS,
  TREES,
  GROUND,
} from './environment';

function tileRow(
  ctx: CanvasRenderingContext2D,
  draw: (c: CanvasRenderingContext2D) => void,
  tileW: number,
  tileH: number,
  y: number,
  totalW: number,
  offset = 0
) {
  const buf = document.createElement('canvas');
  buf.width = tileW;
  buf.height = tileH;
  draw(buf.getContext('2d')!);
  for (let x = -offset % tileW; x < totalW; x += tileW) ctx.drawImage(buf, x, y);
}

const SCENE_W = 1180;
const SCENE_H = 620;
const GROUND_Y = 470;

sheet('scene mockup', SCENE_W, SCENE_H, (ctx) => {
  // sky
  const skyBuf = document.createElement('canvas');
  skyBuf.width = 16;
  skyBuf.height = 620;
  drawSky(skyBuf.getContext('2d')!);
  ctx.drawImage(skyBuf, 0, 0, 16, 620, 0, 0, SCENE_W, SCENE_H);

  // sun
  const sunBuf = document.createElement('canvas');
  sunBuf.width = 320;
  sunBuf.height = 320;
  drawSun(sunBuf.getContext('2d')!, 320);
  ctx.drawImage(sunBuf, SCENE_W - 380, 20);

  tileRow(ctx, drawClouds, CLOUDS.width, CLOUDS.height, 20, SCENE_W, 120);
  tileRow(ctx, drawMountains, MOUNTAINS.width, MOUNTAINS.height, GROUND_Y - MOUNTAINS.height + 24, SCENE_W, 60);
  tileRow(ctx, drawHills, HILLS.width, HILLS.height, GROUND_Y - HILLS.height + 18, SCENE_W, 200);
  tileRow(ctx, drawTrees, TREES.width, TREES.height, GROUND_Y - TREES.height + 10, SCENE_W, 340);
  tileRow(ctx, drawGround, GROUND.width, GROUND.height, GROUND_Y, SCENE_W, 40);

  // gate in the distance
  ctx.save();
  ctx.translate(880 - GATE.width / 2, GROUND_Y + 8 - GATE.height);
  drawGate(ctx, 'checkpoint');
  ctx.restore();

  // props on the ground line
  ctx.save();
  ctx.translate(300 - HURDLE.width / 2, GROUND_Y + 6 - HURDLE.height);
  drawHurdle(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(560 - BARRAGE.width / 2, GROUND_Y + 6 - BARRAGE.height);
  drawBarrage(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(700 - ORB.size / 2, GROUND_Y - 130);
  drawThrownOrb(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(420 - PICKUP.size / 2, GROUND_Y - 96);
  drawPickup(ctx, 'speed');
  ctx.restore();

  ctx.save();
  ctx.translate(1010 - PICKUP.size / 2, GROUND_Y - 96);
  drawPickup(ctx, 'shield');
  ctx.restore();

  // racers
  const racers: { x: number; color: string; pose: RunnerPose; phase: number; lift: number }[] = [
    { x: 150, color: '#4fd1c5', pose: 'run', phase: 0.1, lift: 0 },
    { x: 215, color: '#f56565', pose: 'run', phase: 0.55, lift: 0 },
    { x: 330, color: '#ecc94b', pose: 'jump', phase: 0, lift: 74 },
    { x: 640, color: '#63b3ed', pose: 'duck', phase: 0, lift: 0 },
    { x: 470, color: '#9f7aea', pose: 'run', phase: 0.8, lift: 0 },
  ];
  for (const r of racers) {
    ctx.save();
    ctx.translate(r.x, GROUND_Y + 6);
    drawShadow(ctx, 22 - r.lift * 0.12);
    ctx.translate(0, -r.lift);
    drawRunner(ctx, { color: r.color, pose: r.pose, phase: r.phase });
    ctx.restore();
  }
});
