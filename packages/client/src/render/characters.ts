import { makeRamp, rgba, WORLD, darken } from './palette';

/**
 * Skeletal, parametric runner art. Poses are computed from joint angles rather
 * than hand-drawn per frame, so the run cycle is a smooth function of phase and
 * new poses are cheap to add.
 *
 * These functions take only a CanvasRenderingContext2D - no Phaser - so the art
 * can be previewed and iterated on in a bare HTML canvas harness.
 *
 * Coordinate space: origin is the point between the feet on the ground,
 * +x is forward (the direction of travel), +y is down.
 */

export type RunnerPose = 'run' | 'jump' | 'fall' | 'duck' | 'stumble';

export const RUNNER = {
  /** Logical texture size and where the feet sit inside it. */
  width: 64,
  height: 98,
  footX: 32,
  footY: 92,
} as const;

interface Vec {
  x: number;
  y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Project a limb segment: angle 0 points straight down, positive swings forward. */
function joint(from: Vec, angleDeg: number, len: number): Vec {
  const a = rad(angleDeg);
  return { x: from.x + Math.sin(a) * len, y: from.y + Math.cos(a) * len };
}

const THIGH = 19;
const SHIN = 19;
const UPPER_ARM = 15;
const FOREARM = 14;

interface Skeleton {
  hip: Vec;
  shoulder: Vec;
  head: Vec;
  headTilt: number;
  legs: { hip: Vec; knee: Vec; foot: Vec; footAngle: number }[]; // [back, front]
  arms: { shoulder: Vec; elbow: Vec; hand: Vec }[]; // [back, front]
  squash: number;
}

function buildLeg(hip: Vec, thighDeg: number, kneeFlexDeg: number) {
  const knee = joint(hip, thighDeg, THIGH);
  const shinDeg = thighDeg - kneeFlexDeg;
  const foot = joint(knee, shinDeg, SHIN);
  return { hip, knee, foot, footAngle: shinDeg };
}

function buildArm(shoulder: Vec, upperDeg: number, elbowFlexDeg: number) {
  const elbow = joint(shoulder, upperDeg, UPPER_ARM);
  const hand = joint(elbow, upperDeg + elbowFlexDeg, FOREARM);
  return { shoulder, elbow, hand };
}

function buildSkeleton(pose: RunnerPose, phase: number): Skeleton {
  const a = phase * Math.PI * 2;

  if (pose === 'duck') {
    const hip: Vec = { x: -4, y: -21 };
    const shoulder: Vec = { x: 10, y: -36 };
    return {
      hip,
      shoulder,
      head: { x: 19, y: -44 },
      headTilt: 18,
      squash: 1,
      legs: [buildLeg(hip, 6, 128), buildLeg({ x: hip.x + 4, y: hip.y }, 32, 136)],
      arms: [buildArm(shoulder, -54, -30), buildArm(shoulder, -34, -46)],
    };
  }

  if (pose === 'jump') {
    const hip: Vec = { x: -1, y: -44 };
    const shoulder: Vec = { x: 3, y: -68 };
    return {
      hip,
      shoulder,
      head: { x: 6, y: -83 },
      headTilt: -7,
      squash: 1.05,
      legs: [buildLeg(hip, -30, 38), buildLeg(hip, 44, 92)],
      arms: [buildArm(shoulder, -138, 30), buildArm(shoulder, -112, 40)],
    };
  }

  if (pose === 'fall') {
    const hip: Vec = { x: -1, y: -40 };
    const shoulder: Vec = { x: 2, y: -65 };
    return {
      hip,
      shoulder,
      head: { x: 5, y: -80 },
      headTilt: 5,
      squash: 0.96,
      legs: [buildLeg(hip, -20, 20), buildLeg(hip, 30, 34)],
      arms: [buildArm(shoulder, -96, 26), buildArm(shoulder, -64, 34)],
    };
  }

  if (pose === 'stumble') {
    const hip: Vec = { x: -5, y: -36 };
    const shoulder: Vec = { x: -8, y: -60 };
    return {
      hip,
      shoulder,
      head: { x: -6, y: -76 },
      headTilt: -24,
      squash: 1,
      legs: [buildLeg(hip, 54, 26), buildLeg(hip, -38, 62)],
      arms: [buildArm(shoulder, -158, -34), buildArm(shoulder, -128, 44)],
    };
  }

  // Running cycle.
  // Hips ride higher during the flight phase, which is what sells a run
  // rather than a crouch-shuffle.
  const bob = -2.5 * (0.5 + 0.5 * Math.cos(2 * a));
  const hip: Vec = { x: 0, y: -38 + bob };
  const shoulder: Vec = { x: 4, y: -63 + bob };

  const thighFront = 52 * Math.sin(a);
  const thighBack = 52 * Math.sin(a + Math.PI);
  // Knee is near-straight at push-off and deeply folded on the swing-through.
  const flex = (ang: number) => 6 + 66 * (0.5 + 0.5 * Math.cos(ang - 1.0));

  const armFront = -46 * Math.sin(a + Math.PI);
  const armBack = -46 * Math.sin(a);

  return {
    hip,
    shoulder,
    head: { x: shoulder.x + 3, y: shoulder.y - 14 },
    headTilt: 7,
    squash: 1,
    legs: [buildLeg(hip, thighBack, flex(a + Math.PI)), buildLeg(hip, thighFront, flex(a))],
    arms: [buildArm(shoulder, armBack, 64), buildArm(shoulder, armFront, 58)],
  };
}

function strokeChain(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

/** Outline pass then fill pass - what gives limbs a readable silhouette. */
function limb(ctx: CanvasRenderingContext2D, pts: Vec[], width: number, fill: string, outline: string) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 5;
  strokeChain(ctx, pts);
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  strokeChain(ctx, pts);
}

function drawShoe(ctx: CanvasRenderingContext2D, foot: Vec, angleDeg: number, outline: string) {
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.rotate(rad(angleDeg * 0.35));
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(11, -6, 13, 1);
  ctx.quadraticCurveTo(13, 5, 6, 5);
  ctx.lineTo(-5, 5);
  ctx.quadraticCurveTo(-9, 5, -9, 0);
  ctx.closePath();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.fillStyle = '#f3f4f8';
  ctx.fill();

  // sole
  ctx.beginPath();
  ctx.moveTo(-8, 2.5);
  ctx.lineTo(12.5, 2.2);
  ctx.quadraticCurveTo(13, 5, 6, 5);
  ctx.lineTo(-5, 5);
  ctx.quadraticCurveTo(-8.6, 5, -8, 2.5);
  ctx.closePath();
  ctx.fillStyle = '#3b3f52';
  ctx.fill();
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, s: Skeleton, ramp: ReturnType<typeof makeRamp>) {
  const { hip, shoulder } = s;
  ctx.save();
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(shoulder.x - 11, shoulder.y + 1);
  ctx.quadraticCurveTo(shoulder.x + 12, shoulder.y - 2, shoulder.x + 11, shoulder.y + 9);
  ctx.quadraticCurveTo(hip.x + 12, hip.y - 6, hip.x + 9, hip.y + 5);
  ctx.quadraticCurveTo(hip.x, hip.y + 9, hip.x - 9, hip.y + 4);
  ctx.quadraticCurveTo(shoulder.x - 14, hip.y - 8, shoulder.x - 11, shoulder.y + 1);
  ctx.closePath();

  ctx.strokeStyle = ramp.outline;
  ctx.lineWidth = 5;
  ctx.stroke();

  const grad = ctx.createLinearGradient(shoulder.x - 12, shoulder.y, hip.x + 12, hip.y + 6);
  grad.addColorStop(0, ramp.light);
  grad.addColorStop(0.55, ramp.base);
  grad.addColorStop(1, ramp.dark);
  ctx.fillStyle = grad;
  ctx.fill();

  // chest accent stripe reads as a jersey and breaks up the flat mass
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(ramp.highlight, 0.85);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 12, shoulder.y + 10);
  ctx.lineTo(hip.x + 13, hip.y - 3);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, s: Skeleton, ramp: ReturnType<typeof makeRamp>) {
  const { head, headTilt } = s;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(rad(headTilt));

  // helmet
  ctx.beginPath();
  ctx.arc(0, 0, 12.8, 0, Math.PI * 2);
  ctx.strokeStyle = ramp.outline;
  ctx.lineWidth = 5;
  ctx.stroke();
  const grad = ctx.createLinearGradient(-10, -12, 8, 12);
  grad.addColorStop(0, ramp.highlight);
  grad.addColorStop(0.5, ramp.base);
  grad.addColorStop(1, ramp.dark);
  ctx.fillStyle = grad;
  ctx.fill();

  // visor
  ctx.beginPath();
  ctx.moveTo(1, -5.5);
  ctx.quadraticCurveTo(14, -5, 12.5, 4);
  ctx.quadraticCurveTo(6, 7.5, 1, 4.5);
  ctx.closePath();
  ctx.fillStyle = '#20263f';
  ctx.fill();
  ctx.strokeStyle = ramp.outline;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // visor specular - the single strongest "this is a 3D object" cue
  ctx.beginPath();
  ctx.moveTo(3.5, -3.2);
  ctx.quadraticCurveTo(9.5, -3, 9.5, -0.6);
  ctx.quadraticCurveTo(6, -1.6, 3.5, -1.2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  // helmet crest
  ctx.beginPath();
  ctx.moveTo(-9.5, -8.5);
  ctx.quadraticCurveTo(0, -16, 8, -9);
  ctx.strokeStyle = rgba(ramp.highlight, 0.9);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();
}

export interface RunnerOptions {
  color: string;
  pose: RunnerPose;
  /** 0..1 position in the run cycle; ignored by static poses. */
  phase?: number;
}

/** Draws a runner with its feet at the current origin, facing +x. */
export function drawRunner(ctx: CanvasRenderingContext2D, opts: RunnerOptions) {
  const ramp = makeRamp(opts.color);
  const s = buildSkeleton(opts.pose, opts.phase ?? 0);
  const backRamp = { ...ramp, base: ramp.dark, light: ramp.base };

  ctx.save();
  if (s.squash !== 1) ctx.scale(1 / s.squash, s.squash);

  // back limbs first, in the shadow shade, for depth separation
  limb(ctx, [s.arms[0].shoulder, s.arms[0].elbow, s.arms[0].hand], 7, backRamp.base, ramp.outline);
  limb(ctx, [s.legs[0].hip, s.legs[0].knee, s.legs[0].foot], 9, backRamp.base, ramp.outline);
  drawShoe(ctx, s.legs[0].foot, s.legs[0].footAngle, ramp.outline);

  drawTorso(ctx, s, ramp);

  limb(ctx, [s.legs[1].hip, s.legs[1].knee, s.legs[1].foot], 9.5, ramp.base, ramp.outline);
  drawShoe(ctx, s.legs[1].foot, s.legs[1].footAngle, ramp.outline);

  drawHead(ctx, s, ramp);

  limb(ctx, [s.arms[1].shoulder, s.arms[1].elbow, s.arms[1].hand], 7.5, ramp.light, ramp.outline);
  // glove
  ctx.beginPath();
  ctx.arc(s.arms[1].hand.x, s.arms[1].hand.y, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = '#f3f4f8';
  ctx.strokeStyle = ramp.outline;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();

  ctx.restore();
}

export type HatId = 'top_hat' | 'crown';

/** Hats draw relative to the head center of a standing runner. */
export function drawHat(ctx: CanvasRenderingContext2D, hat: HatId) {
  ctx.save();
  ctx.lineJoin = 'round';
  if (hat === 'top_hat') {
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.quadraticCurveTo(0, 5, 17, 0);
    ctx.quadraticCurveTo(0, -5, -17, 0);
    ctx.closePath();
    ctx.fillStyle = '#20263f';
    ctx.strokeStyle = WORLD.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-9, -20, 18, 21, 3);
    ctx.fillStyle = '#2b3252';
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = '#c8384f';
    ctx.fillRect(-9, -6, 18, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-7, -19, 4, 18);
  } else {
    ctx.beginPath();
    ctx.moveTo(-15, 2);
    ctx.lineTo(-15, -10);
    ctx.lineTo(-7, -3);
    ctx.lineTo(0, -15);
    ctx.lineTo(7, -3);
    ctx.lineTo(15, -10);
    ctx.lineTo(15, 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -15, 0, 2);
    grad.addColorStop(0, '#ffe9a3');
    grad.addColorStop(1, '#e0a416');
    ctx.fillStyle = grad;
    ctx.strokeStyle = darken('#e0a416', 0.5);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -3, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#e0455f';
    ctx.fill();
  }
  ctx.restore();
}

/** Soft contact shadow drawn under a runner; scale/alpha convey height. */
export function drawShadow(ctx: CanvasRenderingContext2D, radius: number) {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, 'rgba(15,12,35,0.5)');
  grad.addColorStop(1, 'rgba(15,12,35,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
}
