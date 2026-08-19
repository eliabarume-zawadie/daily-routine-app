// The DOM half of the game: HUD, the four screens, upgrade cards, and the
// high score. Nothing else in the codebase touches the DOM.

import { WEAPON, PLAYER } from './config.js';

const HIGH_SCORE_KEY = 'zsa.highscore';

const el = {};
let onPickUpgrade = null;
let cardCount = 0;

function $(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

export function initUI(handlers) {
  el.hud = $('hud');
  el.healthFill = $('health-fill');
  el.healthText = $('health-text');
  el.xpFill = $('xp-fill');
  el.level = $('level');
  el.score = $('score');
  el.wave = $('wave');
  el.zombiesLeft = $('zombies-left');
  el.weapon = $('weapon-stats');
  el.banner = $('banner');
  el.cards = $('upgrade-cards');
  el.startHigh = $('start-high');
  el.finalScore = $('final-score');
  el.finalWave = $('final-wave');
  el.finalHigh = $('final-high');
  el.newRecord = $('new-record');

  el.screens = {
    start: $('screen-start'),
    pause: $('screen-pause'),
    levelup: $('screen-levelup'),
    gameover: $('screen-gameover'),
  };

  $('btn-start').addEventListener('click', handlers.onStart);
  $('btn-resume').addEventListener('click', handlers.onResume);
  $('btn-restart').addEventListener('click', handlers.onRestart);

  el.startHigh.textContent = String(loadHighScore());
}

export function showScreen(name) {
  for (const key of Object.keys(el.screens)) {
    el.screens[key].classList.toggle('hidden', key !== name);
  }
  el.hud.classList.toggle('hidden', name === 'start' || name === 'gameover');
}

export function updateHUD(game) {
  const p = game.player;
  if (!p) return;
  const s = p.stats;

  const hpPct = Math.max(0, (p.health / s.maxHealth) * 100);
  el.healthFill.style.width = `${hpPct}%`;
  el.healthFill.classList.toggle('low', hpPct <= 30);
  el.healthText.textContent = `${Math.ceil(Math.max(0, p.health))} / ${Math.round(s.maxHealth)}`;

  el.xpFill.style.width = `${(game.xp / game.xpNeeded) * 100}%`;
  el.level.textContent = String(game.level);
  el.score.textContent = String(game.score);
  el.wave.textContent = String(game.wave);
  el.zombiesLeft.textContent = String(game.zombies.length + game.toSpawn);

  const dmg = (WEAPON.damage * s.damageMul).toFixed(0);
  const rate = (WEAPON.fireRate * s.fireRateMul).toFixed(1);
  const spd = Math.round(PLAYER.speed * s.speedMul);
  el.weapon.textContent = `DMG ${dmg} · RPS ${rate} · SPD ${spd}`;
}

export function showBanner(text, ms = 1600) {
  el.banner.textContent = text;
  el.banner.classList.remove('show');
  // Force a reflow so the animation restarts on a repeated banner.
  void el.banner.offsetWidth;
  el.banner.classList.add('show');
  clearTimeout(el.bannerTimer);
  el.bannerTimer = setTimeout(() => el.banner.classList.remove('show'), ms);
}

export function showUpgrades(options, onPick) {
  onPickUpgrade = onPick;
  cardCount = options.length;
  el.cards.innerHTML = '';

  options.forEach((up, i) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.innerHTML = `
      <span class="card-key">${i + 1}</span>
      <span class="card-name"></span>
      <span class="card-desc"></span>
    `;
    card.querySelector('.card-name').textContent = up.name;
    card.querySelector('.card-desc').textContent = up.description;
    card.addEventListener('click', () => pick(i));
    el.cards.appendChild(card);
  });

  showScreen('levelup');
}

export function pickUpgradeByIndex(i) {
  pick(i);
}

function pick(i) {
  // Guard the index: when the pool is nearly exhausted fewer than three cards
  // are shown, and pressing 3 must not consume the handler and strand the
  // player on a screen they can no longer dismiss.
  if (i >= cardCount) return;
  const handler = onPickUpgrade;
  if (!handler) return;
  onPickUpgrade = null;   // one pick per level-up, no double-fire
  handler(i);
}

export function showGameOver(game) {
  const high = loadHighScore();
  const record = game.score > high;
  if (record) saveHighScore(game.score);

  el.finalScore.textContent = String(game.score);
  el.finalWave.textContent = String(game.wave);
  el.finalHigh.textContent = String(Math.max(high, game.score));
  el.newRecord.classList.toggle('hidden', !record);
  el.startHigh.textContent = String(Math.max(high, game.score));

  showScreen('gameover');
}

// localStorage throws outright in some private-browsing modes. A failure here
// must silently disable persistence, never break the game.
export function loadHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* persistence unavailable — the run still counts, it just isn't saved */
  }
}
