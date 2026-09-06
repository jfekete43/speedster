// Simulation runs on a fixed server tick. Everything below is tuned so that
// obstacles are always clearable with a well-timed jump but punish sloppy timing.

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

export const GRAVITY = 2600; // px/s^2
export const JUMP_VELOCITY = -980; // px/s (negative = upward)
export const BASE_SPEED = 260; // px/s, constant auto-run speed

export const STUMBLE_SPEED_MULT = 0.45;
export const STUMBLE_DURATION_MS = 700;

export const BOOST_SPEED_MULT = 1.6;
export const BOOST_DURATION_MS = 2200;

export const SHIELD_DURATION_MS = 6000; // blocks the next obstacle hit(s) within this window

export const PICKUP_RADIUS = 45; // px

export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 58;
export const LANE_SPACING = 44; // purely visual vertical separation between racers

export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS = 10;
export const FINAL_SURVIVORS = 3; // the field is funneled down to this many for the last stretch

export const COUNTDOWN_MS = 3500;
export const MAX_RACE_MS = 180_000; // safety cap so a stalled race always ends
export const RESULTS_DISPLAY_MS = 15_000; // how long results are shown before the room resets to lobby

export const HAT_IDS = ['none', 'top_hat', 'crown'] as const;
