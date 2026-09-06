import type { Checkpoint, Obstacle, PowerUp, TrackDefinition } from './types.js';

function hurdle(id: string, x: number): Obstacle {
  return { id, x, width: 40, clearance: 90, kind: 'hurdle' };
}

function barrage(id: string, x: number): Obstacle {
  // A denser jump obstacle - wider and taller, needs a fuller jump.
  return { id, x, width: 70, clearance: 130, kind: 'barrage' };
}

function thrown(id: string, x: number): Obstacle {
  // Flies in at head height - jumping doesn't clear it, only ducking does.
  return { id, x, width: 55, clearance: 0, kind: 'thrown' };
}

function speedPowerup(id: string, x: number): PowerUp {
  return { id, x, kind: 'speed' };
}

function shieldPowerup(id: string, x: number): PowerUp {
  return { id, x, kind: 'shield' };
}

const obstacles: Obstacle[] = [
  hurdle('obs-1', 550),
  barrage('obs-2', 900),
  thrown('obs-3', 1150),
  hurdle('obs-4', 1400),
  hurdle('obs-5', 1650),
  thrown('obs-6', 1900),
  barrage('obs-7', 2150),
  // clear zone around checkpoint 1 (2600)
  thrown('obs-8', 2950),
  hurdle('obs-9', 3200),
  barrage('obs-10', 3450),
  thrown('obs-11', 3700),
  hurdle('obs-12', 3950),
  hurdle('obs-13', 4200),
  barrage('obs-14', 4450),
  // clear zone around checkpoint 2 (4700)
  thrown('obs-15', 5000),
  hurdle('obs-16', 5250),
  thrown('obs-17', 5500),
  barrage('obs-18', 5750),
];

const powerups: PowerUp[] = [
  speedPowerup('pow-1', 750),
  shieldPowerup('pow-2', 1300),
  speedPowerup('pow-3', 2400),
  speedPowerup('pow-4', 3350),
  shieldPowerup('pow-5', 4150),
  speedPowerup('pow-6', 5150),
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
