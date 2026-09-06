import type { Checkpoint, Obstacle, PowerUp, TrackDefinition } from './types.js';

function hurdle(id: string, x: number): Obstacle {
  return { id, x, width: 40, clearance: 90, kind: 'hurdle' };
}

function barrage(id: string, x: number): Obstacle {
  // Represents a volley of thrown obstacles - wider and taller, needs a fuller jump.
  return { id, x, width: 70, clearance: 130, kind: 'barrage' };
}

function powerup(id: string, x: number): PowerUp {
  return { id, x, kind: 'speed' };
}

const obstacles: Obstacle[] = [
  hurdle('obs-1', 550),
  barrage('obs-2', 900),
  hurdle('obs-3', 1250),
  hurdle('obs-4', 1600),
  barrage('obs-5', 1950),
  // clear zone around checkpoint 1 (2600)
  hurdle('obs-6', 2950),
  barrage('obs-7', 3300),
  hurdle('obs-8', 3650),
  hurdle('obs-9', 4000),
  barrage('obs-10', 4350),
  // clear zone around checkpoint 2 (4700)
  hurdle('obs-11', 5000),
  barrage('obs-12', 5350),
  hurdle('obs-13', 5700),
];

const powerups: PowerUp[] = [
  powerup('pow-1', 750),
  powerup('pow-2', 1800),
  powerup('pow-3', 3150),
  powerup('pow-4', 4150),
  powerup('pow-5', 5500),
];

const checkpoints: Checkpoint[] = [
  { id: 'cp-1', x: 2600, graceMs: 5000 },
  { id: 'cp-2', x: 4700, graceMs: 4500 },
];

export const DEFAULT_TRACK: TrackDefinition = {
  id: 'circuit-1',
  length: 6000,
  obstacles,
  powerups,
  checkpoints,
};
