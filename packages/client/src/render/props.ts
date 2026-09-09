import { WORLD, darken, lighten, rgba } from './palette';

/**
 * Obstacle and pickup art. Same contract as characters.ts: plain Canvas2D, no
 * Phaser, origin documented per function so the texture baker can place them.
 */

export const HURDLE = { width: 56, height: 108 };
export const BARRAGE = { width: 84, height: 152 };
export const ORB = { size: 62 };
export const PICKUP = { size: 56 };
export const GATE = { width: 128, height: 216 };

/** Hurdle: origin at bottom-center, sitting on the ground. */
export function drawHurdle(ctx: CanvasRenderingContext2D) {
  const w = HURDLE.width;
  const h = HURDLE.height;
  ctx.save();
  ctx.translate(w / 2, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const metal = '#b9c2d6';
  const metalDark = '#6c7794';

  // splayed legs
  ctx.strokeStyle = darken(metalDark, 0.45);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-4, -h + 14);
  ctx.moveTo(16, 0);
  ctx.lineTo(4, -h + 14);
  ctx.stroke();
  ctx.strokeStyle = metalDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-4, -h + 14);
  ctx.moveTo(16, 0);
  ctx.lineTo(4, -h + 14);
  ctx.stroke();

  // feet
  ctx.fillStyle = darken(metalDark, 0.3);
  ctx.beginPath();
  ctx.roundRect(-24, -6, 20, 7, 3);
  ctx.roundRect(4, -6, 20, 7, 3);
  ctx.fill();

  // cross bar with hazard stripes
  const barY = -h + 8;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, barY, w - 4, 16, 5);
  ctx.strokeStyle = WORLD.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, barY, 0, barY + 16);
  grad.addColorStop(0, lighten(WORLD.trackLine, 0.35));
  grad.addColorStop(1, darken(WORLD.trackLine, 0.22));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = rgba('#c8384f', 0.95);
  for (let x = -w / 2 - 16; x < w / 2 + 16; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, barY + 17);
    ctx.lineTo(x + 9, barY + 17);
    ctx.lineTo(x + 18, barY - 1);
    ctx.lineTo(x + 9, barY - 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // lower rail
  ctx.strokeStyle = metal;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, -26);
  ctx.lineTo(w / 2 - 8, -26);
  ctx.stroke();

  ctx.restore();
}

/** Spiked barrier: origin at bottom-center. */
export function drawBarrage(ctx: CanvasRenderingContext2D) {
  const w = BARRAGE.width;
  const h = BARRAGE.height;
  ctx.save();
  ctx.translate(w / 2, h);
  ctx.lineJoin = 'round';

  const bodyTop = -h + 38;

  // stone body
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, bodyTop, w - 12, h - 34, 8);
  ctx.strokeStyle = WORLD.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
  const grad = ctx.createLinearGradient(-w / 2, bodyTop, w / 2, 0);
  grad.addColorStop(0, '#8d5a4f');
  grad.addColorStop(0.45, '#6d4038');
  grad.addColorStop(1, '#4a2a26');
  ctx.fillStyle = grad;
  ctx.fill();

  // vertical plank seams + rivets (vertical reads as a barricade; horizontal
  // seams made this look like a chest of drawers)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba('#2b1714', 0.5);
  ctx.lineWidth = 3;
  for (let x = -w / 2 + 20; x < w / 2; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, bodyTop);
    ctx.lineTo(x, 0);
    ctx.stroke();
  }
  // iron bands across the planks
  ctx.fillStyle = rgba('#3b4358', 0.85);
  ctx.fillRect(-w / 2, bodyTop + 16, w, 9);
  ctx.fillRect(-w / 2, -26, w, 9);
  ctx.fillStyle = rgba('#e8d6c0', 0.45);
  for (const y of [bodyTop + 20, -22]) {
    for (let x = -w / 2 + 12; x < w / 2; x += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // top-left light wash
  const lw = ctx.createLinearGradient(-w / 2, bodyTop, 0, bodyTop + 60);
  lw.addColorStop(0, 'rgba(255,255,255,0.22)');
  lw.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lw;
  ctx.fillRect(-w / 2, bodyTop, w, 70);
  ctx.restore();

  // spikes
  const spikes = 4;
  const step = (w - 16) / spikes;
  for (let i = 0; i < spikes; i++) {
    const x = -w / 2 + 8 + step * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(x - step / 2 + 2, bodyTop + 3);
    ctx.lineTo(x, bodyTop - 32);
    ctx.lineTo(x + step / 2 - 2, bodyTop + 3);
    ctx.closePath();
    ctx.strokeStyle = WORLD.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    const sg = ctx.createLinearGradient(x - step / 2, bodyTop, x + step / 2, bodyTop - 32);
    sg.addColorStop(0, '#e9edf7');
    sg.addColorStop(0.5, '#aab4cc');
    sg.addColorStop(1, '#67718d');
    ctx.fillStyle = sg;
    ctx.fill();
  }

  ctx.restore();
}

/** Spiked flail head that spins in mid-air. Origin at center. */
export function drawThrownOrb(ctx: CanvasRenderingContext2D) {
  const s = ORB.size;
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.lineJoin = 'round';

  const r = 15;
  // spikes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-6, -r + 2);
    ctx.lineTo(0, -r - 12);
    ctx.lineTo(6, -r + 2);
    ctx.closePath();
    ctx.strokeStyle = WORLD.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    const sg = ctx.createLinearGradient(0, -r - 12, 0, -r + 2);
    sg.addColorStop(0, '#f0e6ff');
    sg.addColorStop(1, '#7a6296');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();
  }

  // ball
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = WORLD.ink;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  const g = ctx.createRadialGradient(-6, -7, 2, 0, 0, r + 3);
  g.addColorStop(0, '#c9a6f5');
  g.addColorStop(0.55, '#7d4fd1');
  g.addColorStop(1, '#3f2470');
  ctx.fillStyle = g;
  ctx.fill();

  // specular
  ctx.beginPath();
  ctx.ellipse(-5.5, -6.5, 4.6, 3.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  ctx.restore();
}

/** Power-up pickup with a glow halo. Origin at center. */
export function drawPickup(ctx: CanvasRenderingContext2D, kind: 'speed' | 'shield') {
  const s = PICKUP.size;
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.lineJoin = 'round';

  const tint = kind === 'speed' ? '#4ade80' : '#5eb8ff';

  // outer glow
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, s / 2);
  halo.addColorStop(0, rgba(tint, 0.55));
  halo.addColorStop(0.55, rgba(tint, 0.18));
  halo.addColorStop(1, rgba(tint, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
  ctx.fill();

  // capsule body
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.strokeStyle = darken(tint, 0.55);
  ctx.lineWidth = 4;
  ctx.stroke();
  const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17);
  g.addColorStop(0, lighten(tint, 0.55));
  g.addColorStop(0.6, tint);
  g.addColorStop(1, darken(tint, 0.35));
  ctx.fillStyle = g;
  ctx.fill();

  // icon
  ctx.fillStyle = '#fffdf5';
  ctx.strokeStyle = rgba(darken(tint, 0.6), 0.9);
  ctx.lineWidth = 2;
  if (kind === 'speed') {
    ctx.beginPath();
    ctx.moveTo(3, -10);
    ctx.lineTo(-7, 1.5);
    ctx.lineTo(-1, 1.5);
    ctx.lineTo(-3.5, 11);
    ctx.lineTo(7, -1);
    ctx.lineTo(1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, -7);
    ctx.lineTo(9, 1);
    ctx.quadraticCurveTo(9, 8, 0, 12);
    ctx.quadraticCurveTo(-9, 8, -9, 1);
    ctx.lineTo(-9, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // rim highlight
  ctx.beginPath();
  ctx.ellipse(-5, -7, 5, 3.2, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();

  ctx.restore();
}

/** Checkpoint / finish banner. Origin at bottom-center of the whole gate. */
export function drawGate(ctx: CanvasRenderingContext2D, kind: 'checkpoint' | 'finish') {
  const w = GATE.width;
  const h = GATE.height;
  ctx.save();
  ctx.translate(w / 2, h);
  ctx.lineJoin = 'round';

  const postX = w / 2 - 14;
  const postTop = -h + 20;

  // posts
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(sx * postX - 9, postTop, 18, h - 20, 5);
    ctx.strokeStyle = WORLD.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    const pg = ctx.createLinearGradient(sx * postX - 9, 0, sx * postX + 9, 0);
    pg.addColorStop(0, '#e3e8f5');
    pg.addColorStop(0.5, '#aeb8d2');
    pg.addColorStop(1, '#6d7796');
    ctx.fillStyle = pg;
    ctx.fill();
  }

  // banner
  const bh = 54;
  ctx.beginPath();
  ctx.moveTo(-postX - 6, postTop);
  ctx.lineTo(postX + 6, postTop);
  ctx.lineTo(postX + 6, postTop + bh);
  ctx.quadraticCurveTo(0, postTop + bh + 16, -postX - 6, postTop + bh);
  ctx.closePath();
  ctx.strokeStyle = WORLD.ink;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (kind === 'finish') {
    const bg = ctx.createLinearGradient(0, postTop, 0, postTop + bh);
    bg.addColorStop(0, '#fdfdff');
    bg.addColorStop(1, '#d7dcea');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const sq = 15;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < Math.ceil(w / sq) + 2; x++) {
        if ((x + y) % 2 === 0) continue;
        ctx.fillStyle = '#1d2136';
        ctx.fillRect(-w / 2 + x * sq, postTop + y * sq, sq, sq);
      }
    }
    ctx.restore();
  } else {
    const bg = ctx.createLinearGradient(0, postTop, 0, postTop + bh);
    bg.addColorStop(0, '#5aa9f0');
    bg.addColorStop(1, '#2f6bc4');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = -w; x < w; x += 26) ctx.fillRect(x, postTop, 12, bh + 20);
    ctx.restore();
  }

  ctx.restore();
}
