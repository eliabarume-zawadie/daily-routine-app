// The game itself: state machine, fixed-step loop, entity arrays, collisions,
// and progression. This is the module that owns the run.

import {
  STEP, MAX_STEPS, MAX_FRAME_DELTA, ARENA, COLORS, WEAPON, WAVE, XP, SHAKE,
  UPGRADES,
} from './config.js';
// Note: nothing here forces `input.firing` off on a state change. The mouse
// button is the browser's state to report, and clearing it here desynced the
// two — after a level-up or a pause the player had to release and re-click
// before the weapon would fire again. Firing is gated by the PLAYING state in
// update() instead, which is where it belongs.
import { initInput, takePressed, anyPressed, clearPressed } from './input.js';
import {
  createPlayer, updatePlayer, tryFire, muzzlePoint,
  createBullet, updateBullet,
  createZombie, updateZombie, hitZombie, zombieCanBite,
  createOrb, updateOrb,
  emit, updateParticles, clearParticles,
} from './entities.js';
import * as waves from './waves.js';
import { initRender, resize, screenToWorld, draw } from './render.js';
import {
  initUI, showScreen, updateHUD, showBanner, showUpgrades, showGameOver,
  pickUpgradeByIndex,
} from './ui.js';

export const STATE = {
  MENU: 'start',
  PLAYING: 'playing',
  LEVEL_UP: 'levelup',
  PAUSED: 'pause',
  GAME_OVER: 'gameover',
};

export const xpToNext = (level) =>
  Math.round(XP.base + XP.factor * level ** XP.exponent);

// Exported so the run can be inspected from the browser console while tuning.
export const game = {
  state: STATE.MENU,
  player: null,
  zombies: [],
  bullets: [],
  orbs: [],
  rings: [],
  wave: 1,
  toSpawn: 0,
  spawnTimer: 0,
  breather: 0,
  xp: 0,
  xpNeeded: xpToNext(1),
  level: 1,
  score: 0,
  stacks: {},
  pendingLevels: 0,
  trauma: 0,
};

export function addShake(amount) {
  game.trauma = Math.min(1, game.trauma + amount);
}

// --- Run lifecycle ----------------------------------------------------------

function startRun() {
  game.player = createPlayer();
  game.zombies.length = 0;
  game.bullets.length = 0;
  game.orbs.length = 0;
  game.rings.length = 0;
  clearParticles();

  game.xp = 0;
  game.level = 1;
  game.xpNeeded = xpToNext(1);
  game.score = 0;
  game.stacks = {};
  game.pendingLevels = 0;
  game.trauma = 0;
  game.breather = 0;

  beginWave(1);
  clearPressed();
  game.state = STATE.PLAYING;
  showScreen(null);
  updateHUD(game);
}

function beginWave(n) {
  game.wave = n;
  game.toSpawn = waves.budget(n);
  game.spawnTimer = 0;
  showBanner(`WAVE ${n}`);
}

function endRun() {
  game.state = STATE.GAME_OVER;
  showGameOver(game);
}

// --- Spawning ---------------------------------------------------------------

function spawnZombie() {
  const type = waves.pickType(game.wave);
  const m = WAVE.spawnMargin;
  let x;
  let y;

  switch ((Math.random() * 4) | 0) {
    case 0: x = Math.random() * ARENA.w; y = -m; break;
    case 1: x = ARENA.w + m; y = Math.random() * ARENA.h; break;
    case 2: x = Math.random() * ARENA.w; y = ARENA.h + m; break;
    default: x = -m; y = Math.random() * ARENA.h; break;
  }

  game.zombies.push(createZombie(
    type, x, y, waves.hpScale(game.wave), waves.speedScale(game.wave),
  ));
}

function updateWaves(dt) {
  if (game.breather > 0) {
    game.breather -= dt;
    if (game.breather <= 0) beginWave(game.wave + 1);
    return;
  }

  if (game.toSpawn > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnZombie();
      game.toSpawn--;
      game.spawnTimer = waves.interval(game.wave);
    }
  } else if (game.zombies.length === 0) {
    game.breather = WAVE.breather;
  }
}

// --- Progression ------------------------------------------------------------

function addXp(amount) {
  game.xp += amount;
  // A loop, not an if: one big pickup can cross more than one threshold, and
  // the remainder has to carry over rather than being discarded.
  while (game.xp >= game.xpNeeded) {
    game.xp -= game.xpNeeded;
    game.level++;
    game.xpNeeded = xpToNext(game.level);
    game.pendingLevels++;
  }
  if (game.pendingLevels > 0 && game.state === STATE.PLAYING) openLevelUp();
}

function rollUpgrades() {
  const pool = UPGRADES.filter((u) => (game.stacks[u.id] || 0) < u.cap);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function openLevelUp() {
  const options = rollUpgrades();

  // Everything maxed: bank the level and keep playing rather than showing an
  // empty screen the player cannot dismiss.
  if (options.length === 0) {
    game.pendingLevels = 0;
    return;
  }

  const p = game.player;
  game.rings.push({
    x: p.x, y: p.y, radius: 20, maxRadius: 220,
    life: 0.7, maxLife: 0.7, color: COLORS.orb,
  });
  emit(p.x, p.y, 26, {
    speed: 260, life: 0.6, size: 3.5, color: COLORS.orb, glow: 14,
  });
  addShake(SHAKE.levelUp);

  game.state = STATE.LEVEL_UP;
  showUpgrades(options, (index) => choose(options[index]));
}

function choose(upgrade) {
  if (!upgrade) return;
  upgrade.apply(game.player.stats, game.player);
  game.stacks[upgrade.id] = (game.stacks[upgrade.id] || 0) + 1;
  game.pendingLevels--;

  if (game.pendingLevels > 0) {
    openLevelUp();
    return;
  }

  game.state = STATE.PLAYING;
  clearPressed();
  showScreen(null);
  updateHUD(game);
}

// --- Collisions -------------------------------------------------------------

function killZombie(index) {
  const z = game.zombies[index];

  game.score += z.score;
  game.orbs.push(createOrb(z.x, z.y, z.xp));
  emit(z.x, z.y, z.type === 'brute' ? 26 : 14, {
    speed: z.type === 'brute' ? 300 : 200,
    life: 0.55, size: z.type === 'brute' ? 5 : 3.5,
    color: COLORS.zombie, glow: 10,
  });
  if (z.type === 'brute') addShake(SHAKE.bruteDeath);

  swapPop(game.zombies, index);
}

function resolveCollisions() {
  const p = game.player;

  // Bullets against zombies.
  for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
    const b = game.bullets[bi];
    for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
      const z = game.zombies[zi];
      const r = z.radius + b.radius;
      const dx = z.x - b.x;
      const dy = z.y - b.y;
      if (dx * dx + dy * dy > r * r) continue;

      emit(b.x, b.y, 5, {
        speed: 150, life: 0.22, size: 2.5,
        color: COLORS.bullet, glow: 10,
        angle: Math.atan2(-b.vy, -b.vx), spread: 1.4,
      });
      if (hitZombie(z, b.damage)) killZombie(zi);
      swapPop(game.bullets, bi);
      break;
    }
  }

  // Zombies against the player. Cooldown is per zombie, so a crowd hurts more
  // than a single attacker.
  for (let i = 0; i < game.zombies.length; i++) {
    const z = game.zombies[i];
    if (!zombieCanBite(z, p)) continue;

    p.health -= z.damage;
    addShake(SHAKE.playerHit);
    emit(p.x, p.y, 10, {
      speed: 220, life: 0.35, size: 3,
      color: COLORS.danger, glow: 12,
    });

    if (p.health <= 0) {
      p.health = 0;
      emit(p.x, p.y, 40, {
        speed: 340, life: 0.9, size: 5, color: COLORS.player, glow: 16,
      });
      addShake(0.8);
      endRun();
      return;
    }
  }
}

function swapPop(arr, i) {
  arr[i] = arr[arr.length - 1];
  arr.pop();
}

// --- Update -----------------------------------------------------------------

function update(dt) {
  if (game.trauma > 0) game.trauma = Math.max(0, game.trauma - SHAKE.decay * dt);

  for (let i = game.rings.length - 1; i >= 0; i--) {
    game.rings[i].life -= dt;
    if (game.rings[i].life <= 0) swapPop(game.rings, i);
  }

  if (game.state !== STATE.PLAYING) return;

  const p = game.player;
  updatePlayer(p, dt);

  if (tryFire(p)) {
    const m = muzzlePoint(p);
    game.bullets.push(createBullet(
      m.x, m.y, p.angle,
      WEAPON.bulletSpeed * p.stats.bulletSpeedMul,
      WEAPON.damage * p.stats.damageMul,
    ));
    emit(m.x, m.y, 6, {
      speed: 260, life: 0.14, size: 4, color: COLORS.bullet,
      glow: 16, angle: p.angle, spread: 0.7,
    });
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    if (!updateBullet(game.bullets[i], dt)) swapPop(game.bullets, i);
  }

  for (let i = 0; i < game.zombies.length; i++) {
    updateZombie(game.zombies[i], dt, p, game.zombies);
  }

  resolveCollisions();
  if (game.state !== STATE.PLAYING) return;

  for (let i = game.orbs.length - 1; i >= 0; i--) {
    if (updateOrb(game.orbs[i], dt, p)) {
      const o = game.orbs[i];
      emit(o.x, o.y, 5, {
        speed: 120, life: 0.3, size: 2.5, color: COLORS.orb, glow: 12,
      });
      swapPop(game.orbs, i);
      addXp(o.value);
    }
  }

  updateWaves(dt);
  updateParticles(dt);
  updateHUD(game);
}

// --- Keys that change state -------------------------------------------------

function handleStateKeys() {
  switch (game.state) {
    case STATE.MENU:
      if (anyPressed()) startRun();
      break;

    case STATE.PLAYING:
      if (takePressed('KeyP') || takePressed('Escape')) pause();
      break;

    case STATE.PAUSED:
      if (takePressed('KeyP') || takePressed('Escape')) resume();
      break;

    case STATE.LEVEL_UP:
      if (takePressed('Digit1')) pickUpgradeByIndex(0);
      else if (takePressed('Digit2')) pickUpgradeByIndex(1);
      else if (takePressed('Digit3')) pickUpgradeByIndex(2);
      break;

    case STATE.GAME_OVER:
      if (takePressed('KeyR')) startRun();
      break;

    default:
      break;
  }
}

function pause() {
  if (game.state !== STATE.PLAYING) return;
  game.state = STATE.PAUSED;
  showScreen('pause');
}

function resume() {
  if (game.state !== STATE.PAUSED) return;
  game.state = STATE.PLAYING;
  clearPressed();
  showScreen(null);
}

// --- Boot -------------------------------------------------------------------

let accumulator = 0;
let last = 0;

function frame(now) {
  const delta = Math.min((now - last) / 1000, MAX_FRAME_DELTA);
  last = now;

  handleStateKeys();

  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < MAX_STEPS) {
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  // Whatever is left after the cap is dropped rather than banked, so a long
  // stall cannot queue up a burst of catch-up steps.
  if (accumulator > STEP) accumulator = 0;

  draw(game);
  requestAnimationFrame(frame);
}

function boot() {
  const canvas = document.getElementById('game');
  initRender(canvas);
  initInput(canvas, screenToWorld);
  initUI({
    onStart: startRun,
    onResume: resume,
    onRestart: startRun,
  });

  window.addEventListener('resize', resize);
  // Returning to a backgrounded tab should never be a free death.
  window.addEventListener('blur', pause);

  showScreen('start');
  last = performance.now();
  requestAnimationFrame(frame);
}

boot();
