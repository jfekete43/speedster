import Phaser from 'phaser';

/**
 * All game art is generated procedurally here (vector shapes baked to
 * textures once at startup) rather than loaded from image files - this repo
 * has no art pipeline yet. Everything downstream (MainScene) only ever
 * references the texture KEYS below, never draws shapes itself, so swapping
 * this module out for real loaded spritesheets later is a localized change:
 * load real images/atlases in a scene's preload() under these same keys
 * (or point the CHAR_TEXTURES / HAT_TEXTURES / etc. tables at the new keys)
 * and the rest of the rendering code does not need to change.
 */

export const CHAR_TEXTURES = {
  standA: 'char-stand-a',
  standB: 'char-stand-b',
  jump: 'char-jump',
  duck: 'char-duck',
} as const;

export const HAT_TEXTURES: Record<string, string> = {
  top_hat: 'hat-top_hat',
  crown: 'hat-crown',
};

export const OBSTACLE_TEXTURES: Record<'hurdle' | 'barrage' | 'thrown', string> = {
  hurdle: 'obs-hurdle',
  barrage: 'obs-barrage',
  thrown: 'obs-thrown',
};

export const POWERUP_TEXTURES: Record<'speed' | 'shield', string> = {
  speed: 'pow-speed',
  shield: 'pow-shield',
};

export const ENV_TEXTURES = {
  ground: 'env-ground',
  hills: 'env-hills',
  clouds: 'env-clouds',
  gate: 'env-gate',
  finish: 'env-finish',
} as const;

// Character texture canvas size. Bigger than PLAYER_WIDTH/HEIGHT on purpose -
// limbs/head are allowed to extend past the logical hitbox since only the
// server's numeric width/height (from @speedster/shared) drives collision.
const CHAR_W = 56;
const CHAR_H = 76;
const WHITE = 0xffffff; // body parts drawn white so Sprite.setTint() recolors them per player
const INK = 0x1a202c; // facial features stay this fixed dark color regardless of tint

export function ensureGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(CHAR_TEXTURES.standA)) return; // already generated for this scene

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  drawCharacter(g, scene, 'run', 0);
  drawCharacter(g, scene, 'run', 1);
  drawCharacter(g, scene, 'jump', 0);
  drawCharacter(g, scene, 'duck', 0);

  drawTopHat(g, scene);
  drawCrown(g, scene);

  drawHurdle(g, scene);
  drawBarrage(g, scene);
  drawThrownOrb(g, scene);

  drawSpeedIcon(g, scene);
  drawShieldIcon(g, scene);

  drawGroundTile(g, scene);
  drawHillsTile(g, scene);
  drawCloudsTile(g, scene);
  drawGatePole(g, scene);
  drawFinishPole(g, scene);

  g.destroy();
}

function drawCharacter(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene, pose: 'run' | 'jump' | 'duck', frame: number) {
  g.clear();
  const cx = CHAR_W / 2;

  if (pose === 'duck') {
    // Low, wide crouched silhouette - deliberately a different shape, not a
    // squashed copy of the stand pose, so it reads as a genuine dodge pose.
    const torsoW = 34;
    const torsoH = 26;
    const torsoY = CHAR_H - torsoH - 6;
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(cx - torsoW / 2, torsoY, torsoW, torsoH, 12);
    // legs, bent, tucked under the low torso
    g.fillRoundedRect(cx - 16, CHAR_H - 12, 12, 12, 4);
    g.fillRoundedRect(cx + 4, CHAR_H - 12, 12, 12, 4);
    // head, lowered
    g.fillCircle(cx + 4, torsoY - 8, 13);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 12, torsoY - 10, 3.2);
    g.fillStyle(INK, 1);
    g.fillCircle(cx + 13, torsoY - 10, 1.6);
    // arms tucked forward, low
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(cx + 10, torsoY + 6, 16, 8, 4);
    g.generateTexture(CHAR_TEXTURES.duck, CHAR_W, CHAR_H);
    return;
  }

  const legSpread = pose === 'jump' ? 0 : frame === 0 ? 6 : -6;
  const torsoW = 26;
  const torsoH = 34;
  const torsoY = pose === 'jump' ? 20 : 16;
  const headCy = torsoY - 6;

  g.fillStyle(WHITE, 1);

  if (pose === 'jump') {
    // Torso first, then bent knees drawn ON TOP of it and spread wide enough
    // to clear its silhouette - a tucked-up jump pose reads as limbs in
    // front of the body, not legs hidden behind a torso that's wider than
    // the gap between them.
    g.fillRoundedRect(cx - torsoW / 2, torsoY, torsoW, torsoH, 12);
    g.fillRoundedRect(cx - 24, torsoY + torsoH - 10, 14, 20, 6);
    g.fillRoundedRect(cx + 10, torsoY + torsoH - 10, 14, 20, 6);
    g.fillRoundedRect(cx - 24, torsoY - 6, 10, 22, 5); // arms raised
    g.fillRoundedRect(cx + 14, torsoY - 6, 10, 22, 5);
  } else {
    // Running stride: back leg first, torso over it, front leg + arms on top.
    g.fillRoundedRect(cx - 10 + legSpread, torsoY + torsoH - 4, 11, CHAR_H - (torsoY + torsoH - 4) - 2, 5);
    g.fillRoundedRect(cx - 1 - legSpread, torsoY + torsoH - 4, 11, CHAR_H - (torsoY + torsoH - 4) - 2, 5);
    g.fillRoundedRect(cx - torsoW / 2, torsoY, torsoW, torsoH, 12);
    const armSwing = frame === 0 ? -legSpread : legSpread;
    g.fillRoundedRect(cx - 20 + armSwing * 0.6, torsoY + 4, 9, 20, 4);
    g.fillRoundedRect(cx + 11 - armSwing * 0.6, torsoY + 4, 9, 20, 4);
  }

  // head
  g.fillCircle(cx + 3, headCy, 14);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx + 10, headCy - 2, 3.4);
  g.fillStyle(INK, 1);
  g.fillCircle(cx + 11, headCy - 2, 1.8);

  const key = pose === 'jump' ? CHAR_TEXTURES.jump : frame === 0 ? CHAR_TEXTURES.standA : CHAR_TEXTURES.standB;
  g.generateTexture(key, CHAR_W, CHAR_H);
}

function drawTopHat(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  g.fillStyle(0x1a202c, 1);
  g.fillRoundedRect(2, 14, 36, 6, 2); // brim
  g.fillRoundedRect(9, 0, 22, 16, 2); // crown
  g.fillStyle(0x9b2c2c, 1);
  g.fillRect(9, 11, 22, 4); // band
  g.generateTexture(HAT_TEXTURES.top_hat, 40, 22);
}

function drawCrown(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  g.fillStyle(0xf6e05e, 1);
  g.fillPoints(
    [
      { x: 2, y: 20 },
      { x: 2, y: 10 },
      { x: 10, y: 16 },
      { x: 20, y: 2 },
      { x: 30, y: 16 },
      { x: 38, y: 10 },
      { x: 38, y: 20 },
    ],
    true,
    true
  );
  g.fillStyle(0xc53030, 1);
  g.fillCircle(20, 8, 2.4);
  g.generateTexture(HAT_TEXTURES.crown, 40, 22);
}

function drawHurdle(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 40;
  const h = 100; // clearance (90) + 10, matching track.ts's hurdle sizing
  g.fillStyle(0x4a5568, 1);
  g.fillRoundedRect(2, 0, 8, h, 2); // left post
  g.fillRoundedRect(w - 10, 0, 8, h, 2); // right post
  g.fillStyle(0xecc94b, 1);
  g.fillRoundedRect(0, 6, w, 10, 3); // top bar
  g.fillStyle(0xecc94b, 0.9);
  g.fillRoundedRect(0, h - 14, w, 8, 3); // lower slat
  g.generateTexture(OBSTACLE_TEXTURES.hurdle, w, h);
}

function drawBarrage(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 70;
  const h = 140; // clearance (130) + 10
  g.fillStyle(0x742a2a, 1);
  g.fillRoundedRect(0, 20, w, h - 20, 4); // wall base
  g.fillStyle(0xf56565, 1);
  const spikeCount = 5;
  const spikeW = w / spikeCount;
  for (let i = 0; i < spikeCount; i++) {
    const sx = i * spikeW;
    g.fillTriangle(sx, 20, sx + spikeW / 2, 0, sx + spikeW, 20);
  }
  g.generateTexture(OBSTACLE_TEXTURES.barrage, w, h);
}

function drawThrownOrb(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const size = 46;
  const cx = size / 2;
  g.fillStyle(0x553c9a, 1);
  g.fillCircle(cx, cx, 15);
  g.fillStyle(0x9f7aea, 1);
  // spikes around the orb - reads as "thrown weapon", also motion cue for the spin tween
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * 14;
    const y1 = cx + Math.sin(angle) * 14;
    const x2 = cx + Math.cos(angle) * 23;
    const y2 = cx + Math.sin(angle) * 23;
    const perp = angle + Math.PI / 2;
    const bx = cx + Math.cos(angle) * 10 + Math.cos(perp) * 4;
    const by = cx + Math.sin(angle) * 10 + Math.sin(perp) * 4;
    g.fillTriangle(bx, by, x1, y1, x2, y2);
  }
  g.generateTexture(OBSTACLE_TEXTURES.thrown, size, size);
}

function drawSpeedIcon(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  g.fillStyle(0x68d391, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0xf0fff4, 1);
  g.fillPoints(
    [
      { x: 18, y: 4 },
      { x: 9, y: 18 },
      { x: 15, y: 18 },
      { x: 13, y: 28 },
      { x: 23, y: 13 },
      { x: 17, y: 13 },
    ],
    true,
    true
  );
  g.generateTexture(POWERUP_TEXTURES.speed, 32, 32);
}

function drawShieldIcon(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  g.fillStyle(0x63b3ed, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0xebf8ff, 1);
  g.fillPoints(
    [
      { x: 16, y: 5 },
      { x: 25, y: 9 },
      { x: 25, y: 16 },
      { x: 16, y: 27 },
      { x: 7, y: 16 },
      { x: 7, y: 9 },
    ],
    true,
    true
  );
  g.fillStyle(0x63b3ed, 1);
  g.fillPoints(
    [
      { x: 16, y: 10 },
      { x: 21, y: 13 },
      { x: 21, y: 17 },
      { x: 16, y: 22 },
      { x: 11, y: 17 },
      { x: 11, y: 13 },
    ],
    true,
    true
  );
  g.generateTexture(POWERUP_TEXTURES.shield, 32, 32);
}

function drawGroundTile(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 64;
  const h = 60;
  g.fillStyle(0x2d3748, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0x1a202c, 1);
  g.fillRect(0, 0, w, 6); // top edge shadow line
  g.fillStyle(0x4a5568, 1);
  g.fillRoundedRect(14, 24, 28, 6, 3); // lane dash marking
  g.generateTexture(ENV_TEXTURES.ground, w, h);
}

function drawHillsTile(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 480;
  const h = 160;
  g.fillStyle(0x1c3a3a, 1);
  g.fillEllipse(80, h + 40, 260, 160);
  g.fillEllipse(280, h + 60, 320, 180);
  g.fillEllipse(460, h + 30, 240, 150);
  g.generateTexture(ENV_TEXTURES.hills, w, h);
}

function drawCloudsTile(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 600;
  const h = 260;
  g.fillStyle(0xffffff, 0.5);
  const puff = (cx: number, cy: number, s: number) => {
    g.fillEllipse(cx, cy, 70 * s, 34 * s);
    g.fillEllipse(cx - 30 * s, cy + 6 * s, 46 * s, 26 * s);
    g.fillEllipse(cx + 34 * s, cy + 8 * s, 50 * s, 24 * s);
  };
  puff(110, 70, 1);
  puff(430, 130, 0.7);
  g.generateTexture(ENV_TEXTURES.clouds, w, h);
}

function drawGatePole(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 26;
  const h = 320;
  g.fillStyle(0x2b6cb0, 1);
  g.fillRoundedRect(w / 2 - 5, 0, 10, h, 4);
  g.fillStyle(0x4299e1, 1);
  g.fillTriangle(w / 2 + 5, 10, w / 2 + 5, 44, w / 2 + 34, 27);
  g.generateTexture(ENV_TEXTURES.gate, w, h);
}

function drawFinishPole(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  g.clear();
  const w = 26;
  const h = 320;
  g.fillStyle(0x2d3748, 1);
  g.fillRoundedRect(w / 2 - 5, 0, 10, h, 4);
  const squares = 5;
  const sq = 44 / squares;
  for (let row = 0; row < squares; row++) {
    for (let col = 0; col < 2; col++) {
      const even = (row + col) % 2 === 0;
      g.fillStyle(even ? 0x1a202c : 0xf7fafc, 1);
      g.fillRect(w / 2 + 5 + col * sq, 4 + row * sq, sq, sq);
    }
  }
  g.generateTexture(ENV_TEXTURES.finish, w, h);
}
