import type { PhysicsState, TrackDefinition } from '@speedster/shared';

interface BotLike extends PhysicsState {
  hitObstacles: Set<string>;
  botSkill: number; // 0..1, higher = reacts earlier/more consistently
}

export interface BotAction {
  jump: boolean;
  duck: boolean;
}

export function randomBotSkill(): number {
  return 0.55 + Math.random() * 0.4;
}

/**
 * Simple reactive AI: looks at the next un-hit obstacle and reacts once it's
 * within range - jumping for ground hurdles, ducking for thrown obstacles.
 * Only one obstacle is ever considered, so a bot commits to one dodge at a
 * time (matches how tightly the track is spaced).
 */
export function computeBotAction(player: BotLike, track: TrackDefinition, _nowMs: number): BotAction {
  const upcoming = track.obstacles
    .filter((o) => !player.hitObstacles.has(o.id) && o.x >= player.x)
    .sort((a, b) => a.x - b.x)[0];

  if (!upcoming) return { jump: false, duck: false };

  const distance = upcoming.x - player.x;
  const reactionWindow = 60 + player.botSkill * 55;
  const inRange = distance <= reactionWindow;

  if (upcoming.kind === 'thrown') {
    return { jump: false, duck: inRange };
  }
  return { jump: inRange && player.grounded, duck: false };
}
