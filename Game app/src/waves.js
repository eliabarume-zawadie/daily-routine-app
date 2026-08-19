// Wave difficulty curves. Pure functions of the wave number — no state, no DOM,
// nothing to mock. Keeping them pure is what makes the difficulty curve easy to
// reason about and tweak.

import { WAVE } from './config.js';

export const budget = (n) => WAVE.budgetBase + WAVE.budgetPerWave * (n - 1);

export const interval = (n) =>
  Math.max(WAVE.intervalMin, WAVE.intervalBase - WAVE.intervalPerWave * (n - 1));

export const hpScale = (n) => 1 + WAVE.hpPerWave * (n - 1);

export const speedScale = (n) =>
  Math.min(WAVE.speedMax, 1 + WAVE.speedPerWave * (n - 1));

// Spawn mix shifts from all-walkers toward a runner-and-brute-heavy horde.
export function weights(n) {
  return {
    walker: 10,
    runner: n < 3 ? 0 : Math.min(10, 2 + (n - 3)),
    brute: n < 6 ? 0 : Math.min(6, 1 + Math.floor((n - 6) / 2)),
  };
}

export function pickType(n, rand = Math.random) {
  const w = weights(n);
  const total = w.walker + w.runner + w.brute;
  let roll = rand() * total;
  if ((roll -= w.walker) < 0) return 'walker';
  if ((roll -= w.runner) < 0) return 'runner';
  return 'brute';
}
