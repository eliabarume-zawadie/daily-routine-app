// Every canvas draw call in the game lives in this file. Nothing else touches
// the 2D context.

import { ARENA, COLORS, PLAYER, WEAPON, SHAKE, XP } from './config.js';
import { particles } from './entities.js';

let canvas = null;
let ctx = null;

export function initRender(el) {
  canvas = el;
  canvas.width = ARENA.w;
  canvas.height = ARENA.h;
  ctx = canvas.getContext('2d');
  resize();
}

// The backing store stays 1280x720, so all game coordinates are logical.
// Only the CSS size changes, which gives us uniform scaling plus letterboxing.
export function resize() {
  if (!canvas) return;
  const scale = Math.min(
    window.innerWidth / ARENA.w,
    window.innerHeight / ARENA.h,
  );
  canvas.style.width = `${Math.floor(ARENA.w * scale)}px`;
  canvas.style.height = `${Math.floor(ARENA.h * scale)}px`;
}

export function screenToWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * ARENA.w,
    y: ((clientY - r.top) / r.height) * ARENA.h,
  };
}

// --- Main draw --------------------------------------------------------------

export function draw(game) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.bgDeep;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);

  // Trauma-based shake: squaring it keeps small hits subtle and big ones loud.
  const t = game.trauma * game.trauma;
  if (t > 0.0005) {
    ctx.translate(
      (Math.random() * 2 - 1) * SHAKE.max * t,
      (Math.random() * 2 - 1) * SHAKE.max * t,
    );
  }

  drawGrid();
  drawOrbs(game.orbs);
  drawParticles();
  drawRings(game.rings);
  drawBullets(game.bullets);
  drawZombies(game.zombies);
  if (game.player && game.player.health > 0) drawPlayer(game.player);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawVignette();
}

function drawGrid() {
  const step = 64;
  ctx.strokeStyle = COLORS.bgGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= ARENA.w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, ARENA.h);
  }
  for (let y = 0; y <= ARENA.h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(ARENA.w, y + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34,211,238,0.10)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, ARENA.w - 3, ARENA.h - 3);
}

let vignette = null;
function drawVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(
      ARENA.w / 2, ARENA.h / 2, ARENA.h * 0.35,
      ARENA.w / 2, ARENA.h / 2, ARENA.h * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
}

// --- Entities ---------------------------------------------------------------

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  // Soft ground glow.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.ellipse(0, PLAYER.radius * 0.7, PLAYER.radius * 1.5, PLAYER.radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.rotate(p.angle);

  // Legs, swinging while moving.
  const swing = Math.sin(p.walkPhase) * 5;
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-8, -7 - swing);
  ctx.moveTo(-2, 5);
  ctx.lineTo(-8, 7 + swing);
  ctx.stroke();

  // Weapon.
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(PLAYER.radius - 4, -2.5, WEAPON.muzzleOffset - PLAYER.radius + 10, 5);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(PLAYER.radius - 8, -4.5, 7, 9);

  // Body.
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 18;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Head and visor, so facing reads at a glance.
  ctx.fillStyle = '#083344';
  ctx.beginPath();
  ctx.arc(2, 0, PLAYER.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.arc(PLAYER.radius * 0.45, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawZombies(zombies) {
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    ctx.save();
    ctx.translate(z.x, z.y);

    const hurt = z.flash > 0;
    const body = hurt ? COLORS.zombieHurt : zombieColor(z.type);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, z.radius * 0.75, z.radius * 1.1, z.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.rotate(z.facing || 0);

    if (z.type === 'brute') drawBrute(z, body);
    else if (z.type === 'runner') drawRunner(z, body);
    else drawWalker(z, body);

    ctx.restore();

    // Damage readout on the tanky one, where it actually matters.
    if (z.type === 'brute' && z.hp < z.maxHp) {
      const w = z.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(z.x - w / 2, z.y - z.radius - 12, w, 4);
      ctx.fillStyle = COLORS.danger;
      ctx.fillRect(z.x - w / 2, z.y - z.radius - 12, w * (z.hp / z.maxHp), 4);
    }
  }
}

function zombieColor(type) {
  if (type === 'runner') return '#bef264';
  if (type === 'brute') return '#4d7c0f';
  return COLORS.zombie;
}

function drawWalker(z, body) {
  const sway = Math.sin(z.phase) * 4;
  // Outstretched arms.
  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(z.radius + 8, -5 + sway);
  ctx.moveTo(2, 6);
  ctx.lineTo(z.radius + 8, 5 - sway);
  ctx.stroke();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(3, 0, z.radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.danger;
  ctx.beginPath();
  ctx.arc(z.radius * 0.5, -3, 1.8, 0, Math.PI * 2);
  ctx.arc(z.radius * 0.5, 3, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawRunner(z, body) {
  const stride = Math.sin(z.phase * 2) * 7;
  ctx.strokeStyle = body;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-10, -4 - stride);
  ctx.moveTo(-2, 4);
  ctx.lineTo(-10, 4 + stride);
  ctx.stroke();

  // Leaning forward — reads as fast even standing still.
  ctx.shadowColor = body;
  ctx.shadowBlur = 8;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(2, 0, z.radius * 1.25, z.radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = COLORS.danger;
  ctx.beginPath();
  ctx.arc(z.radius * 0.8, -2.5, 1.6, 0, Math.PI * 2);
  ctx.arc(z.radius * 0.8, 2.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrute(z, body) {
  const sway = Math.sin(z.phase) * 3;
  ctx.strokeStyle = body;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(z.radius + 6, -14 + sway);
  ctx.moveTo(0, 12);
  ctx.lineTo(z.radius + 6, 14 - sway);
  ctx.stroke();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a2e05';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(5, 0, z.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.danger;
  ctx.beginPath();
  ctx.arc(z.radius * 0.6, -5, 2.6, 0, Math.PI * 2);
  ctx.arc(z.radius * 0.6, 5, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullets(bullets) {
  ctx.shadowColor = COLORS.bullet;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = COLORS.bullet;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    const len = 9;
    const inv = 1 / (Math.hypot(b.vx, b.vy) || 1);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * inv * len, b.y - b.vy * inv * len);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawOrbs(orbs) {
  ctx.shadowColor = COLORS.orb;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLORS.orb;
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    const pulse = 1 + Math.sin(o.spin) * 0.18;
    ctx.beginPath();
    ctx.arc(o.x, o.y, XP.orbRadius * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    const k = p.life / p.maxLife;
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.glow;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawRings(rings) {
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const k = 1 - r.life / r.maxLife;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius + (r.maxRadius - r.radius) * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
