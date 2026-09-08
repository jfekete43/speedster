import Phaser from 'phaser';
import { LANE_SPACING, PLAYER_HEIGHT, type PlayerSnapshot } from '@speedster/shared';
import { app } from '../App';
import {
  CHAR_TEXTURES,
  ENV_TEXTURES,
  HAT_TEXTURES,
  OBSTACLE_TEXTURES,
  POWERUP_TEXTURES,
  ensureGameTextures,
} from '../render/textures';

const GROUND_SCREEN_Y = 520;
const RUN_FRAME_MS = 150; // how fast the 2-frame run cycle alternates

const ELIMINATED_TINT = 0x718096;

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  hat: Phaser.GameObjects.Image;
  statusAura: Phaser.GameObjects.Ellipse;
  localMarker: Phaser.GameObjects.Ellipse | null;
  hatKey: string | null;
  baseColor: number;
  displayX: number;
  displayY: number;
  lane: number;
}

export class MainScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Container;
  private playerVisuals = new Map<string, PlayerVisual>();
  private powerupSprites = new Map<string, Phaser.GameObjects.Image>();
  private laneAssignment = new Map<string, number>();
  private nextLane = 0;
  private builtForRaceInstance = -1;
  private lastDuckSent: boolean | null = null;

  constructor() {
    super('main');
  }

  create() {
    ensureGameTextures(this);

    this.cameras.main.setBackgroundColor('#4f9fd4');

    // Parallax scenery - persists across races, sits behind worldLayer.
    this.add
      .tileSprite(0, 30, 20000, 260, ENV_TEXTURES.clouds)
      .setOrigin(0, 0)
      .setScrollFactor(0.15)
      .setAlpha(0.85);
    this.add
      .tileSprite(0, GROUND_SCREEN_Y - 40, 20000, 160, ENV_TEXTURES.hills)
      .setOrigin(0, 1)
      .setScrollFactor(0.35);

    this.worldLayer = this.add.container(0, 0);

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

  private tryJump() {
    if (app.phase === 'racing') app.jump();
  }

  private setDuck(ducking: boolean) {
    if (app.phase !== 'racing' || this.lastDuckSent === ducking) return;
    this.lastDuckSent = ducking;
    app.setDuck(ducking);
  }

  private syncWorld() {
    if (app.phase === 'racing' && app.track && this.builtForRaceInstance !== app.raceInstanceId) {
      this.buildWorld();
    }
  }

  private buildWorld() {
    const track = app.track;
    if (!track) return;

    this.worldLayer.removeAll(true);
    this.playerVisuals.clear();
    this.powerupSprites.clear();
    this.laneAssignment.clear();
    this.nextLane = 0;
    this.builtForRaceInstance = app.raceInstanceId;
    this.lastDuckSent = null;
    this.cameras.main.scrollX = 0;

    const groundWidth = track.length + 800;
    const ground = this.add
      .tileSprite(groundWidth / 2 - 400, GROUND_SCREEN_Y + 30, groundWidth, 60, ENV_TEXTURES.ground)
      .setOrigin(0.5, 0.5);
    this.worldLayer.add(ground);

    for (const obstacle of track.obstacles) {
      if (obstacle.kind === 'thrown') {
        const orb = this.add.image(obstacle.x, GROUND_SCREEN_Y - 105, OBSTACLE_TEXTURES.thrown);
        this.worldLayer.add(orb);
        this.tweens.add({ targets: orb, angle: 360, duration: 1400, repeat: -1, ease: 'Linear' });
        this.tweens.add({ targets: orb, y: orb.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        continue;
      }
      const key = obstacle.kind === 'barrage' ? OBSTACLE_TEXTURES.barrage : OBSTACLE_TEXTURES.hurdle;
      const img = this.add.image(obstacle.x, GROUND_SCREEN_Y, key).setOrigin(0.5, 1);
      this.worldLayer.add(img);
    }

    for (const powerup of track.powerups) {
      const key = powerup.kind === 'shield' ? POWERUP_TEXTURES.shield : POWERUP_TEXTURES.speed;
      const icon = this.add.image(powerup.x, GROUND_SCREEN_Y - 70, key);
      this.worldLayer.add(icon);
      this.tweens.add({ targets: icon, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.powerupSprites.set(powerup.id, icon);
    }

    track.checkpoints.forEach((cp, i) => {
      const gate = this.add.image(cp.x, GROUND_SCREEN_Y, ENV_TEXTURES.gate).setOrigin(0.5, 1);
      this.worldLayer.add(gate);
      const label = this.add
        .text(cp.x, GROUND_SCREEN_Y - 330, `Checkpoint ${i + 1}`, { fontSize: '16px', color: '#ffffff' })
        .setOrigin(0.5)
        .setShadow(0, 2, '#00000080', 3);
      this.worldLayer.add(label);
    });

    const finish = this.add.image(track.length, GROUND_SCREEN_Y, ENV_TEXTURES.finish).setOrigin(0.5, 1);
    this.worldLayer.add(finish);
    const finishLabel = this.add
      .text(track.length, GROUND_SCREEN_Y - 330, 'FINISH', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#00000080', 3);
    this.worldLayer.add(finishLabel);
  }

  private getOrCreatePlayerVisual(id: string): PlayerVisual {
    let visual = this.playerVisuals.get(id);
    if (visual) return visual;

    const meta = app.roster.get(id);
    const color = Phaser.Display.Color.HexStringToColor(meta?.cosmetics.color ?? '#a0aec0').color;
    const isMe = id === app.myId;

    const statusAura = this.add.ellipse(0, -PLAYER_HEIGHT / 2, 48, 66, 0x63b3ed, 0.22);
    statusAura.setStrokeStyle(2, 0x63b3ed, 0.9);
    statusAura.setVisible(false);

    const localMarker = isMe ? this.add.ellipse(0, -2, 30, 12, 0xffffff, 0.35) : null;

    const body = this.add.sprite(0, 0, CHAR_TEXTURES.standA).setOrigin(0.5, 1);
    body.setTint(color);

    const hatKey = meta?.cosmetics.hat && HAT_TEXTURES[meta.cosmetics.hat] ? HAT_TEXTURES[meta.cosmetics.hat] : null;
    const hat = this.add.image(3, -70, hatKey ?? HAT_TEXTURES.top_hat).setOrigin(0.5, 1);
    hat.setVisible(!!hatKey);

    const label = this.add
      .text(0, -96, meta?.name ?? '???', { fontSize: '12px', color: '#ffffff' })
      .setOrigin(0.5)
      .setShadow(0, 1, '#00000090', 2);

    const lane = this.laneAssignment.get(id) ?? this.nextLane++;
    this.laneAssignment.set(id, lane);

    const children = [statusAura, ...(localMarker ? [localMarker] : []), body, hat, label];
    const container = this.add.container(0, 0, children);
    this.worldLayer.add(container);

    visual = {
      container,
      body,
      hat,
      statusAura,
      localMarker,
      hatKey,
      baseColor: color,
      displayX: 0,
      displayY: GROUND_SCREEN_Y,
      lane,
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

  update(time: number, delta: number) {
    if (app.phase !== 'racing' || !app.snapshot || !app.track) return;

    const alpha = Math.min(1, delta / 90);
    const laneCenterOffset = (Math.max(this.nextLane, 1) - 1) * LANE_SPACING * 0.5;
    const runFrame = Math.floor(time / RUN_FRAME_MS) % 2;

    let localX = 0;
    let haveLocal = false;

    for (const p of app.snapshot.players) {
      const visual = this.getOrCreatePlayerVisual(p.id);
      const targetX = p.x;
      const targetY = GROUND_SCREEN_Y - p.y + visual.lane * LANE_SPACING - laneCenterOffset;

      visual.displayX += (targetX - visual.displayX) * alpha;
      visual.displayY += (targetY - visual.displayY) * alpha;
      visual.container.setPosition(visual.displayX, visual.displayY);
      visual.container.setAlpha(p.alive ? 1 : 0.3);
      visual.body.setTint(p.alive ? visual.baseColor : ELIMINATED_TINT);

      const poseKey = !p.grounded
        ? CHAR_TEXTURES.jump
        : p.ducking
          ? CHAR_TEXTURES.duck
          : runFrame === 0
            ? CHAR_TEXTURES.standA
            : CHAR_TEXTURES.standB;
      if (visual.body.texture.key !== poseKey) visual.body.setTexture(poseKey);

      visual.hat.setVisible(!!visual.hatKey && p.grounded && !p.ducking);

      const auraColor = this.auraColorFor(p);
      visual.statusAura.setVisible(auraColor !== null);
      if (auraColor !== null) {
        visual.statusAura.setFillStyle(auraColor, 0.22);
        visual.statusAura.setStrokeStyle(2, auraColor, 0.9);
      }

      if (p.id === app.myId) {
        localX = visual.displayX;
        haveLocal = true;
      }
    }

    for (const [id, icon] of this.powerupSprites) {
      icon.setVisible(!app.takenPowerupIds.has(id));
    }

    const viewWidth = this.scale.width;
    const targetScroll = Phaser.Math.Clamp(
      (haveLocal ? localX : 0) - viewWidth * 0.35,
      0,
      Math.max(0, app.track.length + 200 - viewWidth)
    );
    this.cameras.main.scrollX += (targetScroll - this.cameras.main.scrollX) * 0.12;
  }
}
