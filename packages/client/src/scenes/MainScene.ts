import Phaser from 'phaser';
import { LANE_SPACING, PLAYER_HEIGHT, PLAYER_WIDTH, type PlayerSnapshot } from '@speedster/shared';
import { app } from '../App';

const GROUND_SCREEN_Y = 520;

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  hat: Phaser.GameObjects.Rectangle;
  displayX: number;
  displayY: number;
  lane: number;
}

export class MainScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Container;
  private playerVisuals = new Map<string, PlayerVisual>();
  private powerupSprites = new Map<string, Phaser.GameObjects.Arc>();
  private laneAssignment = new Map<string, number>();
  private nextLane = 0;
  private builtForRaceInstance = -1;

  constructor() {
    super('main');
  }

  create() {
    this.cameras.main.setBackgroundColor('#101820');
    this.worldLayer = this.add.container(0, 0);

    this.input.keyboard?.on('keydown-SPACE', () => this.tryJump());
    this.input.keyboard?.on('keydown-UP', () => this.tryJump());
    this.input.on('pointerdown', () => this.tryJump());

    app.subscribe(() => this.syncWorld());
    this.syncWorld();
  }

  private tryJump() {
    if (app.phase === 'racing') app.jump();
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
    this.cameras.main.scrollX = 0;

    const groundWidth = track.length + 800;
    const ground = this.add.rectangle(groundWidth / 2 - 400, GROUND_SCREEN_Y + 30, groundWidth, 60, 0x2d3748);
    this.worldLayer.add(ground);

    for (const obstacle of track.obstacles) {
      const color = obstacle.kind === 'barrage' ? 0xf56565 : 0xecc94b;
      const height = obstacle.clearance + 10;
      const rect = this.add.rectangle(obstacle.x, GROUND_SCREEN_Y - height / 2, obstacle.width, height, color, 0.85);
      rect.setStrokeStyle(2, 0x000000, 0.3);
      this.worldLayer.add(rect);
    }

    for (const powerup of track.powerups) {
      const orb = this.add.circle(powerup.x, GROUND_SCREEN_Y - 70, 14, 0x68d391, 1);
      orb.setStrokeStyle(3, 0xffffff, 0.6);
      this.worldLayer.add(orb);
      this.powerupSprites.set(powerup.id, orb);
    }

    track.checkpoints.forEach((cp, i) => {
      const gate = this.add.rectangle(cp.x, GROUND_SCREEN_Y - 160, 10, 320, 0x4299e1, 0.5);
      this.worldLayer.add(gate);
      const label = this.add
        .text(cp.x, GROUND_SCREEN_Y - 330, `Checkpoint ${i + 1}`, { fontSize: '16px', color: '#90cdf4' })
        .setOrigin(0.5);
      this.worldLayer.add(label);
    });

    const finish = this.add.rectangle(track.length, GROUND_SCREEN_Y - 160, 12, 320, 0xf6e05e, 0.9);
    this.worldLayer.add(finish);
    const finishLabel = this.add
      .text(track.length, GROUND_SCREEN_Y - 330, 'FINISH', { fontSize: '18px', color: '#f6e05e', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.worldLayer.add(finishLabel);
  }

  private getOrCreatePlayerVisual(id: string): PlayerVisual {
    let visual = this.playerVisuals.get(id);
    if (visual) return visual;

    const meta = app.roster.get(id);
    const color = Phaser.Display.Color.HexStringToColor(meta?.cosmetics.color ?? '#a0aec0').color;

    const body = this.add.rectangle(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT, color);
    body.setStrokeStyle(id === app.myId ? 3 : 2, id === app.myId ? 0xffffff : 0x000000, id === app.myId ? 0.9 : 0.4);

    const hasHat = meta?.cosmetics.hat && meta.cosmetics.hat !== 'none';
    const hat = this.add.rectangle(0, -PLAYER_HEIGHT / 2 - 8, PLAYER_WIDTH * 0.7, 14, 0x1a202c);
    hat.setVisible(!!hasHat);

    const label = this.add
      .text(0, -PLAYER_HEIGHT / 2 - 26, meta?.name ?? '???', { fontSize: '12px', color: '#e2e8f0' })
      .setOrigin(0.5);

    const lane = this.laneAssignment.get(id) ?? this.nextLane++;
    this.laneAssignment.set(id, lane);

    const container = this.add.container(0, 0, [body, hat, label]);
    this.worldLayer.add(container);

    visual = { container, body, hat, displayX: 0, displayY: GROUND_SCREEN_Y, lane };
    this.playerVisuals.set(id, visual);
    return visual;
  }

  private tintFor(p: PlayerSnapshot): number {
    if (!p.alive) return 0x4a5568;
    if (p.boosted) return 0x68d391;
    if (p.stumbling) return 0xfc8181;
    const meta = app.roster.get(p.id);
    return Phaser.Display.Color.HexStringToColor(meta?.cosmetics.color ?? '#a0aec0').color;
  }

  update(_time: number, delta: number) {
    if (app.phase !== 'racing' || !app.snapshot || !app.track) return;

    const alpha = Math.min(1, delta / 90);
    const laneCenterOffset = (Math.max(this.nextLane, 1) - 1) * LANE_SPACING * 0.5;

    let localX = 0;
    let haveLocal = false;

    for (const p of app.snapshot.players) {
      const visual = this.getOrCreatePlayerVisual(p.id);
      const targetX = p.x;
      const targetY = GROUND_SCREEN_Y - p.y + visual.lane * LANE_SPACING - laneCenterOffset;

      visual.displayX += (targetX - visual.displayX) * alpha;
      visual.displayY += (targetY - visual.displayY) * alpha;
      visual.container.setPosition(visual.displayX, visual.displayY);
      visual.container.setAlpha(p.alive ? 1 : 0.25);
      visual.body.setFillStyle(this.tintFor(p));

      if (p.id === app.myId) {
        localX = visual.displayX;
        haveLocal = true;
      }
    }

    for (const [id, orb] of this.powerupSprites) {
      orb.setVisible(!app.takenPowerupIds.has(id));
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
