// Creation and per-frame update for everything that lives in the arena.
// Entities are plain objects in flat arrays — no class hierarchy, no inheritance.

import {
  ARENA, PLAYER, WEAPON, ZOMBIES, SEPARATION_WEIGHT, CONTACT_COOLDOWN,
  HIT_FLASH, XP, MAX_PARTICLES,
} from './config.js';
import { input, moveVector } from './input.js';

// --- Player -----------------------------------------------------------------

export function createPlayer() {
  return {
    x: ARENA.w / 2,
    y: ARENA.h / 2,
    angle: 0,
    health: PLAYER.maxHealth,
    cooldown: 0,
    walkPhase: 0,
    // Every upgradeable number. Upgrades mutate this block, never the config.
    stats: {
      maxHealth: PLAYER.maxHealth,
      speedMul: 1,
      damageMul: 1,
      fireRateMul: 1,
      bulletSpeedMul: 1,
      regen: 0,
    },
  };
}

export function updatePlayer(p, dt) {
  const s = p.stats;
  const move = moveVector();
  const speed = PLAYER.speed * s.speedMul;

  p.x += move.x * speed * dt;
  p.y += move.y * speed * dt;

  // Stay inside the arena.
  p.x = Math.max(PLAYER.radius, Math.min(ARENA.w - PLAYER.radius, p.x));
  p.y = Math.max(PLAYER.radius, Math.min(ARENA.h - PLAYER.radius, p.y));

  if (move.x !== 0 || move.y !== 0) p.walkPhase += dt * 9;

  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

  if (p.cooldown > 0) p.cooldown -= dt;

  if (s.regen > 0 && p.health < s.maxHealth) {
    p.health = Math.min(s.maxHealth, p.health + s.regen * dt);
  }
}

/** True if the weapon fired this step; resets the cooldown as a side effect. */
export function tryFire(p) {
  if (!input.firing || p.cooldown > 0) return false;
  p.cooldown = 1 / (WEAPON.fireRate * p.stats.fireRateMul);
  return true;
}

export function muzzlePoint(p) {
  return {
    x: p.x + Math.cos(p.angle) * WEAPON.muzzleOffset,
    y: p.y + Math.sin(p.angle) * WEAPON.muzzleOffset,
  };
}

// --- Bullets ----------------------------------------------------------------

export function createBullet(x, y, angle, speed, damage) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    life: WEAPON.bulletLife,
    radius: WEAPON.bulletRadius,
  };
}

/** False once the bullet has expired or left the arena. */
export function updateBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
  if (b.life <= 0) return false;
  const m = 40;
  return b.x > -m && b.x < ARENA.w + m && b.y > -m && b.y < ARENA.h + m;
}

// --- Zombies ----------------------------------------------------------------

export function createZombie(type, x, y, hpScale, speedScale) {
  const base = ZOMBIES[type];
  return {
    type,
    x,
    y,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    speed: base.speed * speedScale,
    damage: base.damage,
    radius: base.radius,
    xp: base.xp,
    score: base.score,
    attackCd: 0,
    flash: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

export function updateZombie(z, dt, player, zombies) {
  if (z.attackCd > 0) z.attackCd -= dt;
  if (z.flash > 0) z.flash -= dt;

  // Chase.
  let dx = player.x - z.x;
  let dy = player.y - z.y;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist;
  dy /= dist;

  // Separation, so a crowd spreads into a horde instead of stacking into one
  // shape. Only neighbours actually overlapping contribute.
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < zombies.length; i++) {
    const o = zombies[i];
    if (o === z) continue;
    const ox = z.x - o.x;
    const oy = z.y - o.y;
    const d2 = ox * ox + oy * oy;
    const r = z.radius + o.radius;
    if (d2 > 0.0001 && d2 < r * r) {
      const d = Math.sqrt(d2);
      const push = 1 - d / r;
      sx += (ox / d) * push;
      sy += (oy / d) * push;
    }
  }

  let vx = dx + sx * SEPARATION_WEIGHT;
  let vy = dy + sy * SEPARATION_WEIGHT;
  const len = Math.hypot(vx, vy) || 1;
  vx /= len;
  vy /= len;

  z.x += vx * z.speed * dt;
  z.y += vy * z.speed * dt;
  z.phase += dt * (z.speed / 26);
  z.facing = Math.atan2(dy, dx);
}

export function hitZombie(z, damage) {
  z.hp -= damage;
  z.flash = HIT_FLASH;
  return z.hp <= 0;
}

/** True if this zombie is touching the player and its own cooldown has expired. */
export function zombieCanBite(z, player) {
  if (z.attackCd > 0) return false;
  const r = z.radius + PLAYER.radius;
  const dx = z.x - player.x;
  const dy = z.y - player.y;
  if (dx * dx + dy * dy > r * r) return false;
  z.attackCd = CONTACT_COOLDOWN;
  return true;
}

// --- XP orbs ----------------------------------------------------------------

export function createOrb(x, y, value) {
  const a = Math.random() * Math.PI * 2;
  const s = 40 + Math.random() * 60;
  return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value, spin: Math.random() * 6 };
}

/** True once the orb has been collected. */
export function updateOrb(o, dt, player) {
  const dx = player.x - o.x;
  const dy = player.y - o.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (dist < XP.pickupRadius) return true;

  if (dist < XP.magnetRadius) {
    o.vx += (dx / dist) * XP.magnetAccel * dt;
    o.vy += (dy / dist) * XP.magnetAccel * dt;
    const sp = Math.hypot(o.vx, o.vy);
    if (sp > XP.maxSpeed) {
      o.vx = (o.vx / sp) * XP.maxSpeed;
      o.vy = (o.vy / sp) * XP.maxSpeed;
    }
  } else {
    // Loose orbs drift to a stop.
    o.vx *= 1 - Math.min(1, 3 * dt);
    o.vy *= 1 - Math.min(1, 3 * dt);
  }

  o.x += o.vx * dt;
  o.y += o.vy * dt;
  o.spin += dt * 4;
  return false;
}

// --- Particles --------------------------------------------------------------
// A fixed-size ring buffer. Allocated once at load; `emit` overwrites the
// oldest slots, so effect churn during a heavy wave never allocates and never
// triggers a garbage-collection pause mid-fight.

export const particles = new Array(MAX_PARTICLES);
for (let i = 0; i < MAX_PARTICLES; i++) {
  particles[i] = {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    size: 2, color: '#fff', drag: 2, glow: 0,
  };
}
let cursor = 0;

export function emit(x, y, count, opts = {}) {
  const {
    speed = 120, spread = Math.PI * 2, angle = 0, life = 0.4,
    size = 3, color = '#fff', drag = 3, glow = 8, speedVar = 0.6,
  } = opts;

  for (let i = 0; i < count; i++) {
    const p = particles[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (1 - Math.random() * speedVar);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.maxLife = life * (0.7 + Math.random() * 0.6);
    p.life = p.maxLife;
    p.size = size * (0.7 + Math.random() * 0.6);
    p.color = color;
    p.drag = drag;
    p.glow = glow;
  }
}

export function updateParticles(dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    const d = 1 - Math.min(1, p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function clearParticles() {
  for (let i = 0; i < MAX_PARTICLES; i++) particles[i].life = 0;
}
