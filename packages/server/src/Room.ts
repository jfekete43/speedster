import type { Server, Socket } from 'socket.io';
import {
  BOOST_DURATION_MS,
  COUNTDOWN_MS,
  DEFAULT_TRACK,
  FINAL_SURVIVORS,
  HAT_IDS,
  MAX_PLAYERS,
  MAX_RACE_MS,
  MIN_PLAYERS_TO_START,
  PICKUP_RADIUS,
  RESULTS_DISPLAY_MS,
  SHIELD_DURATION_MS,
  STUMBLE_DURATION_MS,
  TICK_MS,
  checkObstacleHit,
  createInitialPhysicsState,
  stepPhysics,
} from '@speedster/shared';
import type {
  ClientToServerEvents,
  Cosmetics,
  InputState,
  LobbyStateView,
  PhysicsState,
  RaceSnapshot,
  RoomPhase,
  ServerToClientEvents,
  StandingEntry,
  TrackDefinition,
} from '@speedster/shared';
import { computeBotAction, randomBotSkill } from './bots.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface ServerPlayer extends PhysicsState {
  id: string;
  name: string;
  cosmetics: Cosmetics;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  alive: boolean;
  finished: boolean;
  finishPlace: number | null;
  eliminatedAtCheckpoint: number | null;
  hitObstacles: Set<string>;
  pendingJump: boolean;
  ducking: boolean;
  botSkill: number;
  socket: IOSocket | null;
}

const BOT_COLORS = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#4299e1', '#9f7aea', '#ed64a6'];

let botCounter = 0;

function sanitizeCosmetics(input: Partial<Cosmetics> | undefined): Cosmetics {
  const hat = input?.hat && (HAT_IDS as readonly string[]).includes(input.hat) ? input.hat : 'none';
  const color = typeof input?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#4fd1c5';
  return { color, hat: hat as Cosmetics['hat'] };
}

/** How many racers survive a given checkpoint, funneling the field down to FINAL_SURVIVORS by the last one. */
function computeSurvivorTarget(aliveCount: number, checkpointIndex: number, totalCheckpoints: number): number {
  if (aliveCount <= FINAL_SURVIVORS) return aliveCount;
  const isLast = checkpointIndex === totalCheckpoints - 1;
  if (isLast) return FINAL_SURVIVORS;
  return Math.max(Math.ceil(aliveCount / 2), FINAL_SURVIVORS);
}

export class Room {
  readonly id: string;
  private io: IOServer;
  private players = new Map<string, ServerPlayer>();
  private hostId: string | null = null;
  private phase: RoomPhase = 'lobby';

  private track: TrackDefinition = DEFAULT_TRACK;
  private raceStartTime = 0;
  private tickHandle: NodeJS.Timeout | null = null;
  private tickCount = 0;
  private nextCheckpointIndex = 0;
  private checkpointGraceDeadline: number | null = null;
  private takenPowerups = new Set<string>();
  private finishCounter = 0;

  constructor(id: string, io: IOServer) {
    this.id = id;
    this.io = io;
  }

  addPlayer(socket: IOSocket, name: string, cosmetics: Partial<Cosmetics> | undefined) {
    if (this.players.size >= MAX_PLAYERS) {
      socket.emit('error_msg', { message: 'Room is full.' });
      return;
    }

    const player: ServerPlayer = {
      ...createInitialPhysicsState(0),
      id: socket.id,
      name,
      cosmetics: sanitizeCosmetics(cosmetics),
      isBot: false,
      ready: false,
      connected: true,
      alive: true,
      finished: false,
      finishPlace: null,
      eliminatedAtCheckpoint: null,
      hitObstacles: new Set(),
      pendingJump: false,
      ducking: false,
      botSkill: 1,
      socket,
    };

    this.players.set(player.id, player);
    socket.join(this.id);
    if (!this.hostId) this.hostId = player.id;

    socket.on('set_profile', ({ name: newName, cosmetics: newCosmetics }) =>
      this.setProfile(player.id, newName, newCosmetics)
    );
    socket.on('set_ready', ({ ready }) => this.setReady(player.id, ready));
    socket.on('add_bots', ({ count }) => this.addBots(count));
    socket.on('start_race', () => this.tryStartRace(player.id));
    socket.on('jump_input', () => this.queueJump(player.id));
    socket.on('duck_input', ({ ducking }) => this.setDucking(player.id, ducking));

    this.broadcastLobbyState();
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;

    if (this.phase === 'lobby') {
      this.players.delete(id);
      if (this.hostId === id) {
        const next = [...this.players.values()].find((p) => !p.isBot);
        this.hostId = next ? next.id : null;
      }
    } else {
      // Mid-race: freeze them out rather than yanking them from the simulation.
      player.connected = false;
      player.alive = false;
      player.socket = null;
    }

    const anyHumansLeft = [...this.players.values()].some((p) => !p.isBot);
    if (!anyHumansLeft) {
      this.fullyClearRoom();
      return;
    }

    if (this.phase === 'lobby') this.broadcastLobbyState();
  }

  private fullyClearRoom() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.players.clear();
    this.hostId = null;
    this.phase = 'lobby';
  }

  private setProfile(id: string, name: string, cosmetics: Partial<Cosmetics> | undefined) {
    const player = this.players.get(id);
    if (!player || this.phase !== 'lobby') return;
    if (name && name.trim()) player.name = name.trim().slice(0, 16);
    player.cosmetics = sanitizeCosmetics(cosmetics);
    this.broadcastLobbyState();
  }

  private setReady(id: string, ready: boolean) {
    const player = this.players.get(id);
    if (!player || this.phase !== 'lobby') return;
    player.ready = ready;
    this.broadcastLobbyState();
  }

  private addBots(count: number) {
    if (this.phase !== 'lobby') return;
    const n = Math.max(0, Math.min(count, MAX_PLAYERS - this.players.size));
    for (let i = 0; i < n; i++) {
      const id = `bot-${++botCounter}`;
      const bot: ServerPlayer = {
        ...createInitialPhysicsState(0),
        id,
        name: `Bot ${botCounter}`,
        cosmetics: { color: BOT_COLORS[botCounter % BOT_COLORS.length], hat: 'none' },
        isBot: true,
        ready: true,
        connected: true,
        alive: true,
        finished: false,
        finishPlace: null,
        eliminatedAtCheckpoint: null,
        hitObstacles: new Set(),
        pendingJump: false,
        ducking: false,
        botSkill: randomBotSkill(),
        socket: null,
      };
      this.players.set(id, bot);
    }
    this.broadcastLobbyState();
  }

  private queueJump(id: string) {
    const player = this.players.get(id);
    if (!player || this.phase !== 'racing') return;
    player.pendingJump = true;
  }

  private setDucking(id: string, ducking: boolean) {
    const player = this.players.get(id);
    if (!player || player.isBot || this.phase !== 'racing') return;
    player.ducking = ducking;
  }

  private tryStartRace(byId: string) {
    if (this.phase !== 'lobby') return;
    if (byId !== this.hostId) return;
    const humans = [...this.players.values()].filter((p) => !p.isBot);
    if (humans.length === 0) return;
    const allReady = this.players.size > 0 && [...this.players.values()].every((p) => p.ready);
    if (!allReady || this.players.size < MIN_PLAYERS_TO_START) return;

    this.phase = 'countdown';
    const startsAt = Date.now() + COUNTDOWN_MS;
    this.io.to(this.id).emit('countdown', { startsAt, ms: COUNTDOWN_MS });
    setTimeout(() => this.beginRacing(), COUNTDOWN_MS);
  }

  private beginRacing() {
    if (this.phase !== 'countdown') return;
    this.phase = 'racing';
    this.tickCount = 0;
    this.nextCheckpointIndex = 0;
    this.checkpointGraceDeadline = null;
    this.takenPowerups = new Set();
    this.finishCounter = 0;
    this.raceStartTime = Date.now();

    for (const player of this.players.values()) {
      Object.assign(player, createInitialPhysicsState(0));
      player.alive = true;
      player.finished = false;
      player.finishPlace = null;
      player.eliminatedAtCheckpoint = null;
      player.hitObstacles = new Set();
      player.pendingJump = false;
      player.ducking = false;
    }

    this.io.to(this.id).emit('race_start', { track: this.track, startTime: this.raceStartTime });
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const now = Date.now() - this.raceStartTime;

    for (const player of this.players.values()) {
      if (!player.alive || player.finished) continue;

      let jump: boolean;
      if (player.isBot) {
        const action = computeBotAction(player, this.track, now);
        jump = action.jump;
        player.ducking = action.duck;
      } else {
        jump = player.pendingJump;
        player.pendingJump = false;
      }

      const input: InputState = { jump };
      const next = stepPhysics(player, input, TICK_MS, now);
      Object.assign(player, next);

      for (const obstacle of this.track.obstacles) {
        if (player.hitObstacles.has(obstacle.id)) continue;
        if (checkObstacleHit(player.x, player.y, player.ducking, obstacle)) {
          player.hitObstacles.add(obstacle.id);
          if (now < player.shieldUntil) {
            player.shieldUntil = now; // shield absorbs this hit and is consumed
          } else {
            player.stumbleUntil = now + STUMBLE_DURATION_MS;
          }
        }
      }

      for (const powerup of this.track.powerups) {
        if (this.takenPowerups.has(powerup.id)) continue;
        if (Math.abs(player.x - powerup.x) < PICKUP_RADIUS) {
          this.takenPowerups.add(powerup.id);
          if (powerup.kind === 'speed') {
            player.boostUntil = now + BOOST_DURATION_MS;
          } else {
            player.shieldUntil = now + SHIELD_DURATION_MS;
          }
          this.io.to(this.id).emit('powerup_taken', { powerupId: powerup.id, playerId: player.id });
        }
      }

      if (player.x >= this.track.length) {
        player.x = this.track.length;
        player.finished = true;
        player.finishPlace = ++this.finishCounter;
      }
    }

    this.resolveCheckpoints(now);

    const snapshot: RaceSnapshot = {
      tick: this.tickCount++,
      serverTime: now,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        grounded: p.grounded,
        ducking: p.ducking,
        alive: p.alive,
        finished: p.finished,
        boosted: now < p.boostUntil,
        shielded: now < p.shieldUntil,
        stumbling: now < p.stumbleUntil,
      })),
    };
    this.io.to(this.id).emit('snapshot', snapshot);

    this.checkRaceEnd(now);
  }

  private resolveCheckpoints(now: number) {
    if (this.nextCheckpointIndex >= this.track.checkpoints.length) return;
    const checkpoint = this.track.checkpoints[this.nextCheckpointIndex];
    const contenders = [...this.players.values()].filter((p) => p.alive && !p.finished);
    if (contenders.length === 0) {
      this.nextCheckpointIndex++;
      return;
    }

    if (this.checkpointGraceDeadline === null) {
      const leaderArrived = contenders.some((p) => p.x >= checkpoint.x);
      if (!leaderArrived) return;
      this.checkpointGraceDeadline = now + checkpoint.graceMs;
    }

    const allArrived = contenders.every((p) => p.x >= checkpoint.x);
    if (now < this.checkpointGraceDeadline && !allArrived) return;

    const target = computeSurvivorTarget(contenders.length, this.nextCheckpointIndex, this.track.checkpoints.length);
    const ranked = [...contenders].sort((a, b) => b.x - a.x);
    const survivors = ranked.slice(0, target);
    const eliminated = ranked.slice(target);

    for (const p of eliminated) {
      p.alive = false;
      p.eliminatedAtCheckpoint = this.nextCheckpointIndex;
    }

    this.io.to(this.id).emit('checkpoint_result', {
      checkpointIndex: this.nextCheckpointIndex,
      survivors: survivors.map((p) => p.id),
      eliminated: eliminated.map((p) => p.id),
    });

    this.nextCheckpointIndex++;
    this.checkpointGraceDeadline = null;
  }

  private checkRaceEnd(now: number) {
    const stillRacing = [...this.players.values()].some((p) => p.alive && !p.finished);
    if (stillRacing && now < MAX_RACE_MS) return;
    this.endRace();
  }

  private endRace() {
    if (this.phase !== 'racing') return;
    this.phase = 'results';
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }

    const finished = [...this.players.values()]
      .filter((p) => p.finished)
      .sort((a, b) => (a.finishPlace ?? 0) - (b.finishPlace ?? 0));
    const eliminated = [...this.players.values()]
      .filter((p) => !p.finished)
      .sort((a, b) => (b.eliminatedAtCheckpoint ?? -1) - (a.eliminatedAtCheckpoint ?? -1) || b.x - a.x);

    const standings: StandingEntry[] = [];
    let place = 1;
    for (const p of finished) {
      standings.push({ id: p.id, name: p.name, place: place++, outcome: 'finished', eliminatedAtCheckpoint: null });
    }
    for (const p of eliminated) {
      standings.push({
        id: p.id,
        name: p.name,
        place: place++,
        outcome: 'eliminated',
        eliminatedAtCheckpoint: p.eliminatedAtCheckpoint,
      });
    }

    this.io.to(this.id).emit('race_finished', { standings });
    setTimeout(() => this.resetToLobby(), RESULTS_DISPLAY_MS);
  }

  private resetToLobby() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    if (this.players.size === 0) return;
    this.phase = 'lobby';
    for (const player of this.players.values()) {
      Object.assign(player, createInitialPhysicsState(0));
      player.ready = player.isBot;
      player.alive = true;
      player.finished = false;
      player.finishPlace = null;
      player.eliminatedAtCheckpoint = null;
      player.hitObstacles = new Set();
      player.ducking = false;
    }
    this.broadcastLobbyState();
  }

  private broadcastLobbyState() {
    const view: LobbyStateView = {
      phase: this.phase,
      hostId: this.hostId,
      maxPlayers: MAX_PLAYERS,
      minPlayers: MIN_PLAYERS_TO_START,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        cosmetics: p.cosmetics,
        isBot: p.isBot,
        ready: p.ready,
        isHost: p.id === this.hostId,
      })),
    };
    this.io.to(this.id).emit('lobby_state', view);
  }
}
