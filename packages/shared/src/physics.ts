import { BASE_SPEED, BOOST_SPEED_MULT, GRAVITY, JUMP_VELOCITY, PLAYER_WIDTH, STUMBLE_SPEED_MULT } from './constants.js';

export interface InputState {
  jump: boolean;
}

export interface PhysicsState {
  x: number;
  y: number; // height above ground; 0 = grounded
  vy: number;
  grounded: boolean;
  stumbleUntil: number; // race-clock ms until which a stumble speed penalty applies
  boostUntil: number; // race-clock ms until which a speed boost applies
  shieldUntil: number; // race-clock ms until which the next obstacle hit is blocked
}

export function createInitialPhysicsState(x = 0): PhysicsState {
  return { x, y: 0, vy: 0, grounded: true, stumbleUntil: 0, boostUntil: 0, shieldUntil: 0 };
}

/**
 * Pure physics step, shared between the authoritative server simulation and
 * (in a future pass) client-side prediction, so the two never diverge.
 */
export function stepPhysics(state: PhysicsState, input: InputState, dtMs: number, nowMs: number): PhysicsState {
  const dt = dtMs / 1000;
  let { y, vy, grounded } = state;
  let x = state.x;

  if (input.jump && grounded) {
    vy = JUMP_VELOCITY;
    grounded = false;
  }

  vy += GRAVITY * dt;
  y += vy * dt;
  if (y <= 0) {
    y = 0;
    vy = 0;
    grounded = true;
  }

  let speed = BASE_SPEED;
  if (nowMs < state.boostUntil) speed *= BOOST_SPEED_MULT;
  if (nowMs < state.stumbleUntil) speed *= STUMBLE_SPEED_MULT;
  x += speed * dt;

  return {
    x,
    y,
    vy,
    grounded,
    stumbleUntil: state.stumbleUntil,
    boostUntil: state.boostUntil,
    shieldUntil: state.shieldUntil,
  };
}

/**
 * Hurdle/barrage obstacles sit on the ground - clear them by jumping above
 * `clearance`. Thrown obstacles fly at head height - jumping doesn't help,
 * only ducking does.
 */
export function checkObstacleHit(
  playerX: number,
  playerY: number,
  ducking: boolean,
  obstacle: { x: number; width: number; clearance: number; kind: 'hurdle' | 'barrage' | 'thrown' }
): boolean {
  const halfSpan = obstacle.width / 2 + PLAYER_WIDTH / 2;
  const within = playerX > obstacle.x - halfSpan && playerX < obstacle.x + halfSpan;
  if (!within) return false;
  if (obstacle.kind === 'thrown') return !ducking;
  return playerY < obstacle.clearance;
}
