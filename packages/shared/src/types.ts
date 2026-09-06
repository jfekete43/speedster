import type { HAT_IDS } from './constants.js';

export type PlayerId = string;

export type HatId = (typeof HAT_IDS)[number];

export interface Cosmetics {
  color: string; // '#rrggbb'
  hat: HatId;
}

export interface Obstacle {
  id: string;
  x: number;
  width: number;
  clearance: number; // jump-type only: player must be above this height (y) to clear it
  kind: 'hurdle' | 'barrage' | 'thrown'; // hurdle/barrage: jump over. thrown: duck under, jumping doesn't help.
}

export interface PowerUp {
  id: string;
  x: number;
  kind: 'speed' | 'shield';
}

export interface Checkpoint {
  id: string;
  x: number;
  graceMs: number; // how long stragglers get once the leader arrives, before the cut is made
}

export interface TrackDefinition {
  id: string;
  length: number;
  obstacles: Obstacle[];
  powerups: PowerUp[];
  checkpoints: Checkpoint[];
}

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface LobbyPlayerView {
  id: PlayerId;
  name: string;
  cosmetics: Cosmetics;
  isBot: boolean;
  ready: boolean;
  isHost: boolean;
}

export interface LobbyStateView {
  phase: RoomPhase;
  players: LobbyPlayerView[];
  hostId: PlayerId | null;
  maxPlayers: number;
  minPlayers: number;
}

export interface PlayerSnapshot {
  id: PlayerId;
  x: number;
  y: number;
  grounded: boolean;
  ducking: boolean;
  alive: boolean;
  finished: boolean;
  boosted: boolean;
  shielded: boolean;
  stumbling: boolean;
}

export interface RaceSnapshot {
  tick: number;
  serverTime: number;
  players: PlayerSnapshot[];
}

export interface CheckpointResultPayload {
  checkpointIndex: number;
  survivors: PlayerId[];
  eliminated: PlayerId[];
}

export interface StandingEntry {
  id: PlayerId;
  name: string;
  place: number;
  outcome: 'finished' | 'eliminated';
  eliminatedAtCheckpoint: number | null;
}
