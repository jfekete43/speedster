import type {
  CheckpointResultPayload,
  Cosmetics,
  LobbyStateView,
  RaceSnapshot,
  StandingEntry,
  TrackDefinition,
} from './types.js';

// Keep these string literals in sync with the keys below - socket.io's typed
// generics need literal keys, so we can't derive one from the other.
export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  SET_PROFILE: 'set_profile',
  SET_READY: 'set_ready',
  ADD_BOTS: 'add_bots',
  START_RACE: 'start_race',
  JUMP: 'jump_input',

  LOBBY_STATE: 'lobby_state',
  COUNTDOWN: 'countdown',
  RACE_START: 'race_start',
  SNAPSHOT: 'snapshot',
  POWERUP_TAKEN: 'powerup_taken',
  CHECKPOINT_RESULT: 'checkpoint_result',
  RACE_FINISHED: 'race_finished',
  ERROR_MSG: 'error_msg',
} as const;

export interface JoinRoomPayload {
  name: string;
  cosmetics?: Partial<Cosmetics>;
}
export interface SetProfilePayload {
  name: string;
  cosmetics?: Partial<Cosmetics>;
}
export interface SetReadyPayload {
  ready: boolean;
}
export interface AddBotsPayload {
  count: number;
}
export interface JumpInputPayload {
  seq: number;
}

export interface CountdownPayload {
  startsAt: number;
  ms: number;
}
export interface RaceStartPayload {
  track: TrackDefinition;
  startTime: number;
}
export interface PowerupTakenPayload {
  powerupId: string;
  playerId: string;
}
export interface RaceFinishedPayload {
  standings: StandingEntry[];
}
export interface ErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload) => void;
  set_profile: (payload: SetProfilePayload) => void;
  set_ready: (payload: SetReadyPayload) => void;
  add_bots: (payload: AddBotsPayload) => void;
  start_race: () => void;
  jump_input: (payload: JumpInputPayload) => void;
}

export interface ServerToClientEvents {
  lobby_state: (payload: LobbyStateView) => void;
  countdown: (payload: CountdownPayload) => void;
  race_start: (payload: RaceStartPayload) => void;
  snapshot: (payload: RaceSnapshot) => void;
  powerup_taken: (payload: PowerupTakenPayload) => void;
  checkpoint_result: (payload: CheckpointResultPayload) => void;
  race_finished: (payload: RaceFinishedPayload) => void;
  error_msg: (payload: ErrorPayload) => void;
}
