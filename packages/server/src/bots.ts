import type { PhysicsState, TrackDefinition } from '@speedster/shared';

interface BotLike extends PhysicsState {
  hitObstacles: Set<string>;
  botSkill: number; // 0..1, higher = reacts earlier/more consistently
}

export function randomBotSkill(): number {
  return 0.55 + Math.random() * 0.4;
}

/** Simple reactive AI: jump when the next un-hit obstacle is within reaction range. */
export function computeBotJump(player: BotLike, track: TrackDefinition, _nowMs: number): boolean {
  if (!player.grounded) return false;

  const upcoming = track.obstacles
    .filter((o) => !player.hitObstacles.has(o.id) && o.x >= player.x)
    .sort((a, b) => a.x - b.x)[0];

  if (!upcoming) return false;

  const distance = upcoming.x - player.x;
  const reactionWindow = 60 + player.botSkill * 55;
  return distance <= reactionWindow;
}
