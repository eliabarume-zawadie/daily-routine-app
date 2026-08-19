// Every tunable value in the game lives here.
// Balancing should never require editing logic — if you find yourself typing a
// number into another module, it probably belongs in this file instead.

// --- Loop -------------------------------------------------------------------

export const STEP = 1 / 60;        // fixed simulation step, seconds
export const MAX_STEPS = 5;        // per frame, guards against a death spiral
export const MAX_FRAME_DELTA = 0.25;

// --- Arena ------------------------------------------------------------------

export const ARENA = { w: 1280, h: 720 };

export const COLORS = {
  bgDeep: '#07070c',
  bgGrid: '#14141f',
  player: '#22d3ee',
  bullet: '#fef9c3',
  zombie: '#84cc16',
  zombieHurt: '#ef4444',
  orb: '#d946ef',
  health: '#22c55e',
  danger: '#f43f5e',
};

// --- Player and weapon ------------------------------------------------------

export const PLAYER = {
  radius: 14,
  speed: 260,
  maxHealth: 100,
};

export const WEAPON = {
  damage: 25,
  fireRate: 5,          // shots per second
  bulletSpeed: 900,
  bulletRadius: 4,
  bulletLife: 1.2,      // seconds before a bullet expires
  muzzleOffset: 20,     // distance from player centre the barrel ends
};

// --- Zombies ----------------------------------------------------------------

export const ZOMBIES = {
  walker: { hp: 40, speed: 70, damage: 8, radius: 14, xp: 1, score: 10 },
  runner: { hp: 22, speed: 155, damage: 6, radius: 11, xp: 2, score: 20 },
  brute: { hp: 220, speed: 42, damage: 22, radius: 26, xp: 6, score: 60 },
};

export const SEPARATION_WEIGHT = 1.6;   // how hard zombies push each other apart
export const CONTACT_COOLDOWN = 0.6;    // seconds between hits from ONE zombie
export const HIT_FLASH = 0.12;          // seconds a zombie flashes after a hit

// --- Waves ------------------------------------------------------------------

export const WAVE = {
  budgetBase: 8,
  budgetPerWave: 5,
  intervalBase: 1.2,
  intervalPerWave: 0.06,
  intervalMin: 0.25,
  hpPerWave: 0.06,
  speedPerWave: 0.02,
  speedMax: 1.5,
  breather: 3,          // seconds of calm between waves
  spawnMargin: 60,      // how far outside the arena zombies appear
};

// --- XP and levelling -------------------------------------------------------

export const XP = {
  magnetRadius: 90,
  pickupRadius: 20,
  orbRadius: 5,
  magnetAccel: 1800,
  maxSpeed: 760,
  // xpToNext(level) = round(base + factor * level ** exponent)
  base: 5,
  factor: 4,
  exponent: 1.35,
};

// --- Feel -------------------------------------------------------------------

export const SHAKE = {
  max: 12,              // pixels at full trauma
  decay: 1.4,           // trauma lost per second
  playerHit: 0.45,
  bruteDeath: 0.3,
  levelUp: 0.25,
};

export const MAX_PARTICLES = 400;

// --- Upgrades ---------------------------------------------------------------
// `apply` mutates the player's stats block, and may touch the player for
// immediate effects such as healing. Caps sum to 25 stacks, so the pool stays
// alive deep into a run instead of drying up around level 8.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'High Caliber',
    description: '+20% weapon damage',
    cap: 5,
    apply: (s) => { s.damageMul *= 1.2; },
  },
  {
    id: 'firerate',
    name: 'Hair Trigger',
    description: '+20% fire rate',
    cap: 5,
    apply: (s) => { s.fireRateMul *= 1.2; },
  },
  {
    id: 'movespeed',
    name: 'Adrenaline',
    description: '+15% movement speed',
    cap: 4,
    apply: (s) => { s.speedMul *= 1.15; },
  },
  {
    id: 'maxhealth',
    name: 'Field Rations',
    description: '+25 max health, and heals 25',
    cap: 5,
    apply: (s, player) => {
      s.maxHealth += 25;
      player.health = Math.min(s.maxHealth, player.health + 25);
    },
  },
  {
    id: 'regen',
    name: 'Field Medic',
    description: 'Regenerate +0.5 health per second',
    cap: 3,
    apply: (s) => { s.regen += 0.5; },
  },
  {
    id: 'bulletspeed',
    name: 'Hot Loads',
    description: '+20% projectile speed',
    cap: 3,
    apply: (s) => { s.bulletSpeedMul *= 1.2; },
  },
];
