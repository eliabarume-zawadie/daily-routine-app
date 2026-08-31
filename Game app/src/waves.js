// Wave difficulty curves. Pure functions of the wave number and the player's
// level — no state, no DOM, nothing to mock. Keeping them pure is what makes
// the difficulty curve easy to reason about and tweak.
//
// Two pressures compound here: surviving longer (wave) and growing stronger
// (level). Upgrades therefore keep pace with the horde rather than outrunning
// it, so the game gets harder the further you get in either direction.

import { WAVE, LEVEL_SCALING as L } from './config.js';

export const budget = (wave, level = 1) => Math.round(
  WAVE.budgetBase
  + WAVE.budgetPerWave * (wave - 1)
  + L.budgetPerLevel * (level - 1),
);

export const interval = (wave, level = 1) => Math.max(
  WAVE.intervalMin,
  WAVE.intervalBase
  - WAVE.intervalPerWave * (wave - 1)
  - L.intervalPerLevel * (level - 1),
);

export const hpScale = (wave, level = 1) =>
  (1 + WAVE.hpPerWave * (wave - 1)) * (1 + L.hpPerLevel * (level - 1));

export const speedScale = (wave, level = 1) => Math.min(
  WAVE.speedMax,
  (1 + WAVE.speedPerWave * (wave - 1)) * (1 + L.speedPerLevel * (level - 1)),
);

// A high-level player meets the nastier zombie mix earlier than the wave
// number alone would give them.
export const threat = (wave, level = 1) =>
  wave + Math.floor(L.wavesPerLevel * (level - 1));

// Spawn mix shifts from all-walkers toward a runner-and-brute-heavy horde.
export function weights(wave, level = 1) {
  const n = threat(wave, level);
  return {
    walker: 10,
    runner: n < 3 ? 0 : Math.min(10, 2 + (n - 3)),
    brute: n < 6 ? 0 : Math.min(6, 1 + Math.floor((n - 6) / 2)),
  };
}

export function pickType(wave, level = 1, rand = Math.random) {
  const w = weights(wave, level);
  const total = w.walker + w.runner + w.brute;
  let roll = rand() * total;
  if ((roll -= w.walker) < 0) return 'walker';
  if ((roll -= w.runner) < 0) return 'runner';
  return 'brute';
}
