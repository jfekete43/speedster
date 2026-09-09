import { WORLD, darken, lighten, rgba } from './palette';

/**
 * Background and ground art. Parallax layers are drawn as seamless tiles: every
 * silhouette is built from sine terms whose frequency is a whole number of
 * cycles across the tile width, so the value at x=0 always equals the value at
 * x=width and the repeat is invisible.
 */

export const SKY = { width: 16, height: 620 };
export const CLOUDS = { width: 900, height: 300 };
export const MOUNTAINS = { width: 900, height: 260 };
export const HILLS = { width: 760, height: 220 };
export const TREES = { width: 620, height: 180 };
export const GROUND = { width: 256, height: 150 };

interface Term {
  freq: number;
  amp: number;
  phase: number;
}

/** Rolling silhouette; seamless because every freq is an integer. */
const WRAP_GUARD = 3;

function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, baseY: number, terms: Term[]) {
  const bottom = h - WRAP_GUARD;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= w; x += 2) {
    let y = baseY;
    for (const t of terms) y -= t.amp * Math.sin((x / w) * Math.PI * 2 * t.freq + t.phase);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Peaked silhouette for mountains - abs(sin) gives ridgelines instead of rolls. */
function peaks(ctx: CanvasRenderingContext2D, w: number, h: number, baseY: number, terms: Term[]) {
  const bottom = h - WRAP_GUARD;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= w; x += 2) {
    let y = baseY;
    for (const t of terms) y -= t.amp * Math.abs(Math.sin((x / w) * Math.PI * t.freq + t.phase));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Deterministic RNG so scenery detail is stable across reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Vertical sky gradient; stretched horizontally in-game. */
export function drawSky(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = SKY;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, WORLD.skyTop);
  g.addColorStop(0.42, WORLD.skyMid);
  g.addColorStop(0.78, WORLD.skyLow);
  g.addColorStop(1, WORLD.skyHaze);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Sun with a soft bloom, drawn once and pinned to the camera. */
export function drawSun(ctx: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.translate(r, r);
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, r);
  glow.addColorStop(0, 'rgba(255,246,209,0.95)');
  glow.addColorStop(0.18, 'rgba(255,232,160,0.55)');
  glow.addColorStop(0.55, 'rgba(255,214,140,0.16)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawClouds(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = CLOUDS;
  const rand = rng(90210);
  const puff = (cx: number, cy: number, scale: number, alpha: number) => {
    const draw = (x: number) => {
      const g = ctx.createLinearGradient(x, cy - 26 * scale, x, cy + 16 * scale);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, `rgba(214,232,255,${alpha * 0.55})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      const blob = (bx: number, by: number, rx: number, ry: number) => {
        ctx.moveTo(bx + rx, by);
        ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      };
      blob(x, cy, 52 * scale, 22 * scale);
      blob(x - 34 * scale, cy + 6 * scale, 30 * scale, 15 * scale);
      blob(x + 30 * scale, cy + 7 * scale, 34 * scale, 16 * scale);
      blob(x + 6 * scale, cy - 14 * scale, 30 * scale, 18 * scale);
      ctx.fill();
    };
    draw(cx);
    // wrap so clouds crossing the seam still tile cleanly
    if (cx < 90) draw(cx + w);
    if (cx > w - 90) draw(cx - w);
  };

  for (let i = 0; i < 6; i++) {
    puff(rand() * w, 40 + rand() * (h - 120), 0.6 + rand() * 0.7, 0.5 + rand() * 0.3);
  }
}

export function drawMountains(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = MOUNTAINS;
  // Distant range: hazier and lower contrast (atmospheric perspective).
  ctx.fillStyle = rgba(WORLD.mountainFar, 0.75);
  peaks(ctx, w, h, h - 40, [
    { freq: 3, amp: 120, phase: 0.4 },
    { freq: 7, amp: 34, phase: 1.2 },
  ]);

  ctx.fillStyle = WORLD.mountainNear;
  peaks(ctx, w, h, h - 18, [
    { freq: 4, amp: 92, phase: 2.1 },
    { freq: 9, amp: 26, phase: 0.3 },
  ]);

  // snow caps: clip to the near ridge, then wash a band across everything
  // above the snow line so only the peaks catch it
  ctx.save();
  const ridgeY = (x: number) =>
    h - 18 - 92 * Math.abs(Math.sin((x / w) * Math.PI * 4 + 2.1)) - 26 * Math.abs(Math.sin((x / w) * Math.PI * 9 + 0.3));
  ctx.beginPath();
  ctx.moveTo(0, h - WRAP_GUARD);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, ridgeY(x));
  ctx.lineTo(w, h - WRAP_GUARD);
  ctx.closePath();
  ctx.clip();
  const snow = ctx.createLinearGradient(0, h - 210, 0, h - 120);
  snow.addColorStop(0, 'rgba(245,250,255,0.95)');
  snow.addColorStop(1, 'rgba(245,250,255,0)');
  ctx.fillStyle = snow;
  ctx.fillRect(0, h - 210, w, 95);
  ctx.restore();
}

export function drawHills(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = HILLS;
  ctx.fillStyle = WORLD.hillFar;
  ridge(ctx, w, h, h - 66, [
    { freq: 2, amp: 46, phase: 0.6 },
    { freq: 5, amp: 16, phase: 2.0 },
  ]);
  ctx.fillStyle = WORLD.hillNear;
  ridge(ctx, w, h, h - 30, [
    { freq: 3, amp: 40, phase: 2.6 },
    { freq: 6, amp: 14, phase: 0.9 },
  ]);
}

export function drawTrees(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = TREES;
  const rand = rng(4242);
  const tree = (x: number, scale: number) => {
    const draw = (px: number) => {
      const baseY = h - 6 - WRAP_GUARD;
      ctx.strokeStyle = darken(WORLD.bush, 0.35);
      ctx.lineWidth = 6 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, baseY);
      ctx.lineTo(px, baseY - 34 * scale);
      ctx.stroke();

      const g = ctx.createLinearGradient(px - 30 * scale, baseY - 100 * scale, px + 26 * scale, baseY - 20 * scale);
      g.addColorStop(0, lighten(WORLD.bush, 0.22));
      g.addColorStop(1, darken(WORLD.bush, 0.2));
      ctx.fillStyle = g;
      ctx.beginPath();
      const blob = (bx: number, by: number, rx: number, ry: number) => {
        ctx.moveTo(bx + rx, by);
        ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      };
      blob(px, baseY - 56 * scale, 30 * scale, 34 * scale);
      blob(px - 22 * scale, baseY - 40 * scale, 20 * scale, 22 * scale);
      blob(px + 22 * scale, baseY - 44 * scale, 22 * scale, 24 * scale);
      ctx.fill();
    };
    draw(x);
    if (x < 60) draw(x + w);
    if (x > w - 60) draw(x - w);
  };

  for (let i = 0; i < 7; i++) tree(rand() * w, 0.75 + rand() * 0.5);
}

/** Athletics-track running surface; tiles horizontally. Soil is drawn as its
 * own layer underneath, so this tile is track all the way down - otherwise the
 * runners end up standing on the dirt baked into the bottom of the tile. */
export function drawGround(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = GROUND;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b8573a');
  g.addColorStop(0.45, '#a94e33');
  g.addColorStop(1, '#8f4029');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // lane lines run with the direction of travel, so they tile trivially
  const lanes = [0.16, 0.4, 0.64, 0.88];
  for (const t of lanes) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, Math.round(h * t), w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, Math.round(h * t) + 3, w, 2);
  }

  // speckle for texture
  const rand = rng(777);
  for (let i = 0; i < 120; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(x, y, 2, 2);
  }
}
