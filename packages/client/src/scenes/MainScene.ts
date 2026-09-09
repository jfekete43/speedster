import Phaser from 'phaser';
import type { PlayerSnapshot } from '@speedster/shared';
import { app } from '../App';
import {
  SPRITE_SCALE,
  SUPERSAMPLE,
  RUNNER_FRAMES,
  SIZES,
  TEX,
  ensureRunnerTexture,
  ensureStaticTextures,
  hatTextureFor,
} from '../render/textures';

/**
 * Side-scroller convention: every racer shares one ground plane. The track
 * surface recedes upward behind that line purely as scenery, so runners always
 * stand on it instead of floating in a stack of fake depth lanes.
 */
const GROUND_Y = 520;
const TRACK_BAND = 116; // how much running surface is visible behind the line
const CAMERA_ZOOM = 1.32;
/** World point kept vertically centred; puts the ground line low in frame. */
const CAMERA_FOCUS_Y = GROUND_Y - 172;
const RUN_FRAME_MS = 70;
const DUST_INTERVAL_MS = 110;

const DEPTH = {
  ground: -60,
  soil: -58,
  laneLine: -57,
  obstacle: 10,
  gate: 14,
  pickup: 20,
  shadow: 25,
  player: 40,
  label: 120,
  fx: 300,
} as const;

interface PlayerVisual {
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
  aura: Phaser.GameObjects.Ellipse;
  labelLift: number;
  displayX: number;
  displayY: number;
  wasGrounded: boolean;
  wasStumbling: boolean;
  lastDustAt: number;
  squash: number;
  runPhase: number;
  alivePrev: boolean;
  confettiFired: boolean;
}

export class MainScene extends Phaser.Scene {
  private raceObjects: Phaser.GameObjects.GameObject[] = [];
  private playerVisuals = new Map<string, PlayerVisual>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private orderIndex = new Map<string, number>();
  private builtForRaceInstance = -1;
  private lastDuckSent: boolean | null = null;
  private cameraCenterX = 0;

  private skyLayer!: Phaser.GameObjects.Image;
  private sunLayer!: Phaser.GameObjects.Image;
  /**
   * Scrolling layers are only as wide as the viewport and are re-anchored to
   * the camera every frame, with the illusion of distance coming from
   * tilePositionX. Sizing them to the whole track instead would exceed the
   * maximum WebGL texture width and the layer silently fails to upload.
   */
  private scrollLayers: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('main');
  }

  create() {
    ensureStaticTextures(this);
    this.cameras.main.setBackgroundColor('#5b93e6');
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.buildBackdrop();
    this.buildEmitters();

    this.input.keyboard?.on('keydown-SPACE', () => this.tryJump());
    this.input.keyboard?.on('keydown-UP', () => this.tryJump());
    this.input.on('pointerdown', () => this.tryJump());
    this.input.keyboard?.on('keydown-DOWN', () => this.setDuck(true));
    this.input.keyboard?.on('keyup-DOWN', () => this.setDuck(false));
    this.input.keyboard?.on('keydown-S', () => this.setDuck(true));
    this.input.keyboard?.on('keyup-S', () => this.setDuck(false));

    app.subscribe(() => this.syncWorld());
    this.syncWorld();
  }

  // --- backdrop ----------------------------------------------------------

  private buildBackdrop() {
    const horizon = GROUND_Y - TRACK_BAND;

    // Sky and sun live in world space and are re-pinned to the camera each
    // frame: scroll-locked objects position ambiguously once the camera is
    // zoomed, and the camera's Y never moves anyway.
    this.skyLayer = this.add.image(0, 0, TEX.sky).setOrigin(0.5, 1).setDepth(-200);
    this.sunLayer = this.add.image(0, 0, TEX.sun).setScale(SPRITE_SCALE).setDepth(-199);

    // Parallax layers use supersampled textures, so the tile has to be scaled
    // back down or it repeats at 3x and only the top slice is visible.
    this.scrollLayers = [];
    const layer = (h: number, key: string, factor: number, y: number, depth: number) => {
      const sprite = this.add
        .tileSprite(0, y, this.layerWidth(), h, key)
        .setOrigin(0, 1)
        .setDepth(depth)
        .setTileScale(SPRITE_SCALE, SPRITE_SCALE);
      this.scrollLayers.push({ sprite, factor });
      return sprite;
    };

    layer(SIZES.clouds.height, TEX.clouds, 0.08, horizon - 40, -190).setAlpha(0.9);
    layer(SIZES.mountains.height, TEX.mountains, 0.18, horizon + 30, -180);
    layer(SIZES.hills.height, TEX.hills, 0.32, horizon + 40, -170);
    layer(SIZES.trees.height, TEX.trees, 0.5, horizon + 52, -160);

    this.layoutBackdrop();
    this.scale.on('resize', () => this.layoutBackdrop());
  }

  private layerWidth() {
    return this.scale.width / CAMERA_ZOOM + 260;
  }

  private layoutBackdrop() {
    const worldW = this.scale.width / CAMERA_ZOOM;
    const worldH = this.scale.height / CAMERA_ZOOM;
    this.skyLayer.setDisplaySize(worldW + 320, worldH + GROUND_Y);
    this.skyLayer.setY(GROUND_Y + 200);
    for (const { sprite } of this.scrollLayers) sprite.setSize(this.layerWidth(), sprite.height);
    this.pinCameraLayers();
  }

  /** Re-anchors camera-following layers; also drives the parallax offsets. */
  private pinCameraLayers() {
    const worldW = this.scale.width / CAMERA_ZOOM;
    const worldH = this.scale.height / CAMERA_ZOOM;
    const cx = this.cameras.main.midPoint.x || 0;
    const left = cx - worldW / 2 - 130;

    this.skyLayer.setX(cx);
    this.sunLayer.setPosition(cx + worldW * 0.26, CAMERA_FOCUS_Y - worldH * 0.34);

    for (const { sprite, factor } of this.scrollLayers) {
      sprite.setX(left);
      // tilePositionX is in texture pixels, hence the supersample factor.
      sprite.tilePositionX = left * factor * SUPERSAMPLE;
    }
  }

  private buildEmitters() {
    this.dust = this.add
      .particles(0, 0, TEX.dust, {
        lifespan: 620,
        speed: { min: 12, max: 64 },
        angle: { min: 160, max: 260 },
        scale: { start: 0.22, end: 0.62 },
        alpha: { start: 0.38, end: 0 },
        gravityY: -30,
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.sparks = this.add
      .particles(0, 0, TEX.spark, {
        lifespan: 460,
        speed: { min: 40, max: 170 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 320,
        emitting: false,
      })
      .setDepth(DEPTH.fx + 10);

    this.confetti = this.add
      .particles(0, 0, TEX.confetti, {
        lifespan: 2600,
        speed: { min: 120, max: 380 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.1, end: 0.7 },
        rotate: { start: 0, end: 720 },
        alpha: { start: 1, end: 0.85 },
        gravityY: 520,
        tint: [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xf78c6b],
        emitting: false,
      })
      .setDepth(DEPTH.fx + 20);
  }

  // --- input -------------------------------------------------------------

  private tryJump() {
    if (app.phase === 'racing') app.jump();
  }

  private setDuck(ducking: boolean) {
    if (app.phase !== 'racing' || this.lastDuckSent === ducking) return;
    this.lastDuckSent = ducking;
    app.setDuck(ducking);
  }

  // --- world -------------------------------------------------------------

  private syncWorld() {
    // The countdown is dead time - use it to rasterise each racer's sheet so
    // the first frame of the race is not spent baking textures.
    if (app.phase === 'countdown' && app.lobby) {
      for (const p of app.lobby.players) ensureRunnerTexture(this, p.cosmetics.color);
    }
    if (app.phase === 'racing' && app.track && this.builtForRaceInstance !== app.raceInstanceId) {
      this.buildWorld();
    }
  }

  private own<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.raceObjects.push(obj);
    return obj;
  }

  private buildWorld() {
    const track = app.track;
    if (!track) return;

    for (const obj of this.raceObjects) obj.destroy();
    this.raceObjects = [];
    this.scrollLayers = this.scrollLayers.filter((l) => l.sprite.active);
    this.playerVisuals.clear();
    this.pickupSprites.clear();
    this.orderIndex.clear();

    this.builtForRaceInstance = app.raceInstanceId;
    this.lastDuckSent = null;
    this.cameraCenterX = this.scale.width / CAMERA_ZOOM * 0.5 - 260;

    const trackTop = GROUND_Y - TRACK_BAND;
    const spanW = track.length + 2400;
    const spanX = spanW / 2 - 1200;

    const ground = this.own(
      this.add
        .tileSprite(0, trackTop, this.layerWidth(), TRACK_BAND + 26, TEX.ground)
        .setOrigin(0, 0)
        .setDepth(DEPTH.ground)
        .setTileScale(SPRITE_SCALE, SPRITE_SCALE)
    );
    this.scrollLayers.push({ sprite: ground, factor: 1 });
    this.own(this.add.rectangle(spanX, trackTop - 4, spanW, 12, 0x3f9e6a).setDepth(DEPTH.ground));
    this.own(this.add.rectangle(spanX, trackTop - 10, spanW, 6, 0x2d7350).setDepth(DEPTH.ground));
    const soil = this.own(
      this.add
        .tileSprite(0, GROUND_Y + 26, this.layerWidth(), 190, TEX.soil)
        .setOrigin(0, 0)
        .setDepth(DEPTH.soil)
        .setTileScale(SPRITE_SCALE, SPRITE_SCALE)
    );
    this.scrollLayers.push({ sprite: soil, factor: 1 });
    // near edge of the running surface, right under the runners' feet
    this.own(this.add.rectangle(spanX, GROUND_Y + 24, spanW, 5, 0xf6f1e6, 0.85).setDepth(DEPTH.laneLine));

    for (const obstacle of track.obstacles) {
      if (obstacle.kind === 'thrown') {
        const orb = this.own(
          this.add.image(obstacle.x, GROUND_Y - 96, TEX.orb).setScale(SPRITE_SCALE).setDepth(DEPTH.obstacle)
        );
        this.tweens.add({ targets: orb, angle: 360, duration: 1500, repeat: -1, ease: 'Linear' });
        this.tweens.add({
          targets: orb,
          y: orb.y - 10,
          duration: 780,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        const key = obstacle.kind === 'barrage' ? TEX.barrage : TEX.hurdle;
        this.own(
          this.add
            .image(obstacle.x, GROUND_Y + 6, key)
            .setOrigin(0.5, 1)
            .setScale(SPRITE_SCALE)
            .setDepth(DEPTH.obstacle)
        );
      }
    }

    for (const powerup of track.powerups) {
      const key = powerup.kind === 'shield' ? TEX.pickupShield : TEX.pickupSpeed;
      const icon = this.own(
        this.add.image(powerup.x, GROUND_Y - 78, key).setScale(SPRITE_SCALE).setDepth(DEPTH.pickup)
      );
      this.tweens.add({
        targets: icon,
        y: icon.y - 12,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.pickupSprites.set(powerup.id, icon);
    }

    const labelStyle = {
      fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    };
    track.checkpoints.forEach((cp, i) => {
      this.own(
        this.add
          .image(cp.x, GROUND_Y + 12, TEX.gateCheckpoint)
          .setOrigin(0.5, 1)
          .setScale(SPRITE_SCALE)
          .setDepth(DEPTH.gate)
      );
      this.own(
        this.add
          .text(cp.x, GROUND_Y - 262, `CHECKPOINT ${i + 1}`, labelStyle)
          .setOrigin(0.5)
          .setShadow(0, 3, '#0b1030aa', 6)
          .setDepth(DEPTH.gate + 1)
      );
    });

    this.own(
      this.add
        .image(track.length, GROUND_Y + 12, TEX.gateFinish)
        .setOrigin(0.5, 1)
        .setScale(SPRITE_SCALE)
        .setDepth(DEPTH.gate)
    );
    this.own(
      this.add
        .text(track.length, GROUND_Y - 262, 'FINISH', { ...labelStyle, fontSize: '26px', color: '#ffe89a' })
        .setOrigin(0.5)
        .setShadow(0, 3, '#0b1030aa', 6)
        .setDepth(DEPTH.gate + 1)
    );
  }

  private getOrCreatePlayerVisual(id: string): PlayerVisual {
    const existing = this.playerVisuals.get(id);
    if (existing) return existing;

    const meta = app.roster.get(id);
    const color = meta?.cosmetics.color ?? '#a0aec0';
    const texKey = ensureRunnerTexture(this, color);
    const isMe = id === app.myId;

    let order = this.orderIndex.get(id);
    if (order === undefined) {
      order = this.orderIndex.size;
      this.orderIndex.set(id, order);
    }
    // The local runner always draws on top of the pack.
    const depth = DEPTH.player + (isMe ? 50 : order);

    const shadow = this.own(
      this.add.image(0, GROUND_Y, TEX.shadow).setDepth(DEPTH.shadow).setScale(0.85)
    );
    const aura = this.own(
      this.add.ellipse(0, 0, 62, 90, 0x63b3ed, 0.18).setDepth(depth - 1).setVisible(false)
    );
    const body = this.own(
      this.add.sprite(0, GROUND_Y, texKey, RUNNER_FRAMES.run[0]).setOrigin(0.5, 1).setDepth(depth)
    );

    const hatKey = hatTextureFor(meta?.cosmetics.hat);
    const hat = hatKey
      ? this.own(this.add.image(0, 0, hatKey).setOrigin(0.5, 0.9).setScale(SPRITE_SCALE).setDepth(depth + 1))
      : null;

    const showLabel = isMe || !meta?.isBot;
    const label = this.own(
      this.add
        .text(0, 0, showLabel ? (meta?.name ?? '???') : '', {
          fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif',
          fontSize: isMe ? '17px' : '12px',
          color: isMe ? '#ffe89a' : '#eef3ff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 1)
        .setShadow(0, 2, '#0b1030dd', 4)
        .setDepth(DEPTH.label + (isMe ? 50 : order))
    );

    const visual: PlayerVisual = {
      body,
      shadow,
      hat,
      label,
      aura,
      // stagger labels so a tight pack does not stack its names on one line
      labelLift: (order % 3) * 15,
      displayX: 0,
      displayY: GROUND_Y,
      wasGrounded: true,
      wasStumbling: false,
      lastDustAt: 0,
      squash: 0,
      runPhase: Math.random(),
      alivePrev: true,
      confettiFired: false,
    };
    this.playerVisuals.set(id, visual);
    return visual;
  }

  private auraColorFor(p: PlayerSnapshot): number | null {
    if (p.shielded) return 0x63b3ed;
    if (p.boosted) return 0x68d391;
    if (p.stumbling) return 0xfc8181;
    return null;
  }

  private frameFor(p: PlayerSnapshot, visual: PlayerVisual): string {
    if (!p.alive) return RUNNER_FRAMES.stumble;
    if (p.stumbling && p.grounded) return RUNNER_FRAMES.stumble;
    if (!p.grounded) return p.y > 40 ? RUNNER_FRAMES.jump : RUNNER_FRAMES.fall;
    if (p.ducking) return RUNNER_FRAMES.duck;
    return RUNNER_FRAMES.run[Math.floor(visual.runPhase * 8) % 8];
  }

  update(time: number, delta: number) {
    if (app.phase !== 'racing' || !app.snapshot || !app.track) return;

    const lerp = Math.min(1, delta / 90);
    let localX = 0;
    let haveLocal = false;

    for (const p of app.snapshot.players) {
      const visual = this.getOrCreatePlayerVisual(p.id);

      visual.displayX += (p.x - visual.displayX) * lerp;
      visual.displayY += (GROUND_Y - p.y - visual.displayY) * lerp;

      if (p.grounded && p.alive && !p.ducking) visual.runPhase += delta / (RUN_FRAME_MS * 8);

      if (p.grounded && !visual.wasGrounded) {
        visual.squash = 1;
        this.dust.emitParticleAt(visual.displayX, GROUND_Y, 7);
      } else if (!p.grounded && visual.wasGrounded) {
        visual.squash = -0.7;
        this.dust.emitParticleAt(visual.displayX, GROUND_Y, 3);
      }
      visual.wasGrounded = p.grounded;

      if (p.stumbling && !visual.wasStumbling) {
        this.sparks.emitParticleAt(visual.displayX, visual.displayY - 30, 12);
        if (p.id === app.myId) this.cameras.main.shake(180, 0.006);
      }
      visual.wasStumbling = p.stumbling;

      if (visual.alivePrev && !p.alive) this.dust.emitParticleAt(visual.displayX, GROUND_Y, 16);
      visual.alivePrev = p.alive;

      if (p.alive && p.grounded && time - visual.lastDustAt > DUST_INTERVAL_MS) {
        visual.lastDustAt = time;
        this.dust.emitParticleAt(visual.displayX - 14, GROUND_Y, 1);
        if (p.boosted) this.sparks.emitParticleAt(visual.displayX - 18, GROUND_Y - 16, 2);
      }

      visual.squash *= Math.max(0, 1 - delta / 160);
      const squashY = 1 - visual.squash * 0.3;
      const squashX = 1 + visual.squash * 0.26;

      visual.body.setPosition(visual.displayX, visual.displayY);
      visual.body.setScale(SPRITE_SCALE * squashX, SPRITE_SCALE * squashY);
      visual.body.setFrame(this.frameFor(p, visual));
      visual.body.setAlpha(p.alive ? 1 : 0.35);
      visual.body.setTint(p.alive ? 0xffffff : 0x8892b0);

      const height = Math.max(0, GROUND_Y - visual.displayY);
      visual.shadow.setPosition(visual.displayX, GROUND_Y + 6);
      visual.shadow.setScale(0.85 * (1 - Math.min(0.5, height / 420)));
      visual.shadow.setAlpha((p.alive ? 0.85 : 0.25) * (1 - Math.min(0.6, height / 320)));

      const headY = visual.displayY - 78 * SPRITE_SCALE * squashY * 3;
      if (visual.hat) {
        visual.hat.setPosition(visual.displayX + 2, headY + 4);
        visual.hat.setVisible(p.alive && p.grounded && !p.ducking);
      }
      visual.label.setPosition(visual.displayX, headY - 10 - visual.labelLift);
      visual.label.setAlpha(p.alive ? (p.id === app.myId ? 1 : 0.82) : 0.35);

      const auraColor = this.auraColorFor(p);
      visual.aura.setVisible(auraColor !== null && p.alive);
      if (auraColor !== null) {
        visual.aura.setPosition(visual.displayX, visual.displayY - 42);
        visual.aura.setFillStyle(auraColor, 0.16);
        visual.aura.setStrokeStyle(3, auraColor, 0.8);
      }

      if (p.id === app.myId) {
        localX = visual.displayX;
        haveLocal = true;
        if (p.finished && !visual.confettiFired) {
          visual.confettiFired = true;
          this.confetti.emitParticleAt(visual.displayX, GROUND_Y - 260, 100);
        }
      }
    }

    for (const [id, icon] of this.pickupSprites) {
      icon.setVisible(!app.takenPowerupIds.has(id));
    }

    const cam = this.cameras.main;
    const worldViewW = this.scale.width / CAMERA_ZOOM;
    // Keep the local runner about a third in from the left.
    const desiredCenter = (haveLocal ? localX : 0) + worldViewW * 0.16;
    const targetCenter = Phaser.Math.Clamp(
      desiredCenter,
      worldViewW * 0.5 - 260,
      app.track.length + 420 - worldViewW * 0.5
    );
    this.cameraCenterX += (targetCenter - this.cameraCenterX) * 0.12;
    cam.centerOn(this.cameraCenterX, CAMERA_FOCUS_Y);
    this.pinCameraLayers();
  }
}
