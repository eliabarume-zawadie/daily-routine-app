# Zombie Survival Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-based 2D zombie survival arena game specified in
`docs/superpowers/specs/2026-08-19-zombie-survival-arena-design.md`.

**Architecture:** Vanilla ES modules served over HTTP. A single canvas draws the
world; the DOM draws the HUD and all four screens. A fixed 1/60 s timestep
accumulator drives an explicit state machine (MENU / PLAYING / LEVEL_UP /
PAUSED / GAME_OVER). Entities are plain objects in flat arrays.

**Tech Stack:** HTML5 Canvas 2D, vanilla JavaScript ES modules, CSS. No
dependencies, no build step, no package manager, no test framework.

## Global Constraints

- No external dependencies, no build step, no `package.json`, no test framework.
- Nine game files only: `index.html`, `styles.css`, and seven `src/*.js`
  modules. Do not add files beyond these.
- Every tunable number lives in `src/config.js`. No magic numbers in logic.
- `render.js` is the only module touching the canvas context; `ui.js` is the
  only module touching the DOM.
- Simulation steps at a fixed `1/60` s, capped at 5 steps per frame.
- Entities are plain objects in flat arrays, removed by swap-and-pop.
- Arena is a fixed `1280×720` logical space, uniformly scaled with letterboxing.
- Run with `python -m http.server 8000` from `Game app/`; never `file://`.
- Verification is the browser smoke checklist — there is no automated suite.
  Every task ends by loading the page and confirming a clean console.

## Verification Ritual

Every task's final verification step means:

1. Serve `Game app/` and open `http://localhost:8000`.
2. Open DevTools console. **Zero errors and zero warnings** is the pass bar.
3. Perform the task's stated checks.

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Canvas element plus the DOM HUD and four screen overlays. |
| `styles.css` | Letterboxed canvas layout, HUD, screens, upgrade cards. |
| `src/config.js` | All tunables: arena, player, weapon, zombie stats, wave curves, XP curve, upgrade definitions, palette. Pure data, no imports. |
| `src/input.js` | Keyboard set, one-shot key presses, canvas-relative mouse position, fire state. |
| `src/entities.js` | Create/update for player, zombies, bullets, XP orbs, particles. |
| `src/waves.js` | Pure functions from wave number to budget, interval, scaling, and spawn type. |
| `src/game.js` | State machine, fixed-step loop, entity arrays, collisions, XP/level/upgrade flow. |
| `src/render.js` | All canvas drawing, camera shake, screen↔world coordinate mapping. |
| `src/ui.js` | DOM HUD updates, screen switching, upgrade cards, high-score persistence. |

---

### Task 1: Scaffold, loop, and arena

**Files:**
- Create: `Game app/index.html`, `Game app/styles.css`, `Game app/src/config.js`,
  `Game app/src/render.js`, `Game app/src/game.js`

**Interfaces:**
- Produces:
  - `config.js`: `ARENA {w,h}`, `COLORS {...}`, `STEP = 1/60`, `MAX_STEPS = 5`
  - `render.js`: `initRender(canvas)`, `resize()`, `screenToWorld(cx, cy) -> {x,y}`,
    `addShake(amount)`, `draw(game)`
  - `game.js`: `STATE {MENU,PLAYING,LEVEL_UP,PAUSED,GAME_OVER}`,
    `createGame() -> game`, `update(game, dt)`, `start(game)`

- [ ] **Step 1: Write `config.js` with arena, palette, and loop constants**

```js
export const STEP = 1 / 60;
export const MAX_STEPS = 5;
export const ARENA = { w: 1280, h: 720 };
export const COLORS = {
  bgDeep: '#07070c', bgGrid: '#14141f', player: '#22d3ee',
  bullet: '#fef9c3', zombie: '#84cc16', zombieHurt: '#ef4444',
  orb: '#d946ef', health: '#22c55e', danger: '#f43f5e',
};
```

- [ ] **Step 2: Write `index.html` with the canvas and empty overlay containers**

Module entry is `<script type="module" src="src/game.js"></script>`.

- [ ] **Step 3: Write `styles.css` — full-viewport dark page, centered canvas**

- [ ] **Step 4: Write `render.js` — scale-to-fit, letterbox, grid arena, shake**

Uniform scale is `min(window.innerWidth / ARENA.w, window.innerHeight / ARENA.h)`,
applied to the canvas CSS size so the backing store stays `1280×720` and all
game coordinates are logical. `screenToWorld` inverts that mapping using
`canvas.getBoundingClientRect()`. Shake is trauma-based: store `trauma`, decay
it each frame, and translate by `trauma² × 12` px in a random direction.

- [ ] **Step 5: Write `game.js` — fixed-step accumulator and state machine**

```js
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps++ < MAX_STEPS) { update(game, STEP); acc -= STEP; }
  draw(game);
  requestAnimationFrame(frame);
}
```

- [ ] **Step 6: Verify**

Load the page. The arena grid renders, fills the window with letterboxing,
survives a window resize, and the console is clean.

- [ ] **Step 7: Commit**

```bash
git add "Game app"
git commit -m "Add game scaffold, fixed-step loop, and arena rendering"
```

---

### Task 2: Player movement, aiming, and shooting

**Files:**
- Create: `Game app/src/input.js`, `Game app/src/entities.js`
- Modify: `Game app/src/config.js`, `Game app/src/game.js`, `Game app/src/render.js`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `config.js` adds `PLAYER {radius:14, speed:260, maxHealth:100}` and
    `WEAPON {damage:25, fireRate:5, bulletSpeed:900, bulletRadius:4, bulletLife:1.2}`
  - `input.js`: `initInput(canvas)`, `input {keys:Set, mouse:{x,y}, firing:bool}`,
    `takePressed(code) -> bool`
  - `entities.js`: `createPlayer() -> player`, `updatePlayer(p, dt, input)`,
    `createBullet(x, y, angle, speed, damage, life) -> bullet`,
    `updateBullet(b, dt) -> bool` (false when expired or out of bounds)

- [ ] **Step 1: Write `input.js`**

Track `keydown`/`keyup` into a `Set` of `event.code`. Keep a separate
`pressed` set that `takePressed(code)` reads and clears, so pause and upgrade
keys fire once per press rather than every frame. Mouse position converts
through `screenToWorld`. `firing` follows `mousedown`/`mouseup`, and also
clears on `mouseleave` so the weapon cannot stick on.

- [ ] **Step 2: Write `entities.js` with player and bullet**

Movement normalizes the input vector so diagonals are not faster, then clamps
the player inside `ARENA` accounting for radius. Aim angle is
`Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x)`. Firing respects a
cooldown of `1 / fireRate`, decremented by `dt`.

- [ ] **Step 3: Wire bullets into `game.js`**

`game.bullets` array; update each and swap-pop the dead ones:

```js
for (let i = g.bullets.length - 1; i >= 0; i--) {
  if (!updateBullet(g.bullets[i], dt)) {
    g.bullets[i] = g.bullets[g.bullets.length - 1];
    g.bullets.pop();
  }
}
```

- [ ] **Step 4: Draw the player and bullets in `render.js`**

Player is a glowing cyan body with a barrel drawn along the aim angle. Bullets
are short bright tracers oriented along their velocity.

- [ ] **Step 5: Verify**

WASD and arrows move in all eight directions at equal speed; the player cannot
leave the arena; the barrel tracks the cursor; clicking and holding fires at a
steady rate; bullets expire rather than accumulating forever. Console clean.

- [ ] **Step 6: Commit**

```bash
git add "Game app"
git commit -m "Add player movement, mouse aiming, and shooting"
```

---

### Task 3: Zombies and chase AI

**Files:**
- Modify: `Game app/src/config.js`, `Game app/src/entities.js`,
  `Game app/src/game.js`, `Game app/src/render.js`

**Interfaces:**
- Produces:
  - `config.js` adds `ZOMBIES` keyed by type:
    `walker {hp:40,speed:70,damage:8,radius:14,xp:1,score:10,fromWave:1}`,
    `runner {hp:22,speed:155,damage:6,radius:11,xp:2,score:20,fromWave:3}`,
    `brute {hp:220,speed:42,damage:22,radius:26,xp:6,score:60,fromWave:6}`
  - `entities.js`: `createZombie(type, x, y, hpScale, speedScale) -> zombie`,
    `updateZombie(z, dt, player, zombies)`

- [ ] **Step 1: Add the three zombie types to `config.js`**

- [ ] **Step 2: Implement `createZombie` and `updateZombie`**

Steering is the unit vector toward the player, plus a separation force summed
over neighbours closer than the sum of the two radii:

```js
let sx = 0, sy = 0;
for (const o of zombies) {
  if (o === z) continue;
  const dx = z.x - o.x, dy = z.y - o.y;
  const d2 = dx * dx + dy * dy;
  const r = z.radius + o.radius;
  if (d2 > 0 && d2 < r * r) {
    const d = Math.sqrt(d2);
    sx += (dx / d) * (1 - d / r);
    sy += (dy / d) * (1 - d / r);
  }
}
```

Separation is weighted (`SEPARATION_WEIGHT` in config) and added to the chase
vector before normalizing and applying speed.

- [ ] **Step 3: Spawn zombies just outside a random arena edge in `game.js`**

Temporary for this task: spawn one walker per second so the AI is observable.
Task 5 replaces this with real waves.

- [ ] **Step 4: Draw the three types distinctly in `render.js`**

Walker is a mid-size green body with shambling limb offsets driven by a
per-zombie phase; Runner is smaller, paler, leaning forward; Brute is large,
darker, with a heavier outline. Each briefly flashes `zombieHurt` after taking
damage.

- [ ] **Step 5: Verify**

Zombies enter from off-screen, converge on the player, and visibly push apart
instead of stacking into a single shape. Console clean.

- [ ] **Step 6: Commit**

```bash
git add "Game app"
git commit -m "Add zombie types with chase and separation AI"
```

---

### Task 4: Collision, damage, death, and restart

**Files:**
- Modify: `Game app/src/config.js`, `Game app/src/game.js`,
  `Game app/src/render.js`
- Create: `Game app/src/ui.js`

**Interfaces:**
- Produces:
  - `config.js` adds `CONTACT_COOLDOWN = 0.6`
  - `game.js` adds `damagePlayer(g, amount)`, `killZombie(g, index)`,
    `restart(g)`
  - `ui.js`: `initUI(game, handlers)`, `showScreen(name|null)`,
    `updateHUD(game)`

- [ ] **Step 1: Bullet↔zombie collision in `game.js`**

Circle overlap test. On hit: subtract damage, set the zombie's hit-flash timer,
remove the bullet. At or below zero HP, remove the zombie.

- [ ] **Step 2: Zombie↔player contact damage**

Each zombie carries its own `attackCd`, decremented by `dt`. On overlap with
`attackCd <= 0`, apply the zombie's damage, reset that zombie's cooldown to
`CONTACT_COOLDOWN`, and add shake. Per-attacker, not global i-frames — being
surrounded must be more dangerous than being chased by one.

- [ ] **Step 3: Health, death, and the game-over screen**

At zero health, transition to `GAME_OVER` and show the screen with final score.

- [ ] **Step 4: Restart**

`restart(g)` clears every entity array, rebuilds the player, resets wave, score,
XP, level, and upgrade stacks, then sets `PLAYING`. Bind it to the button and
the `R` key.

- [ ] **Step 5: Verify**

Bullets kill zombies; contact drains health; a surrounding crowd drains it
faster than a single zombie; death shows game over; restart yields a clean run
with full health and no leftover entities. Console clean.

- [ ] **Step 6: Commit**

```bash
git add "Game app"
git commit -m "Add collision, damage, death, and restart"
```

---

### Task 5: Waves

**Files:**
- Create: `Game app/src/waves.js`
- Modify: `Game app/src/config.js`, `Game app/src/game.js`

**Interfaces:**
- Produces:
  - `waves.js`: `budget(n)`, `interval(n)`, `hpScale(n)`, `speedScale(n)`,
    `pickType(n, rand = Math.random) -> 'walker'|'runner'|'brute'`

- [ ] **Step 1: Write `waves.js` as pure functions**

```js
export const budget = n => WAVE.budgetBase + WAVE.budgetPerWave * (n - 1);
export const interval = n =>
  Math.max(WAVE.intervalMin, WAVE.intervalBase - WAVE.intervalPerWave * (n - 1));
export const hpScale = n => 1 + WAVE.hpPerWave * (n - 1);
export const speedScale = n =>
  Math.min(WAVE.speedMax, 1 + WAVE.speedPerWave * (n - 1));
```

Type weights, exactly as specified:

```js
const weights = n => ({
  walker: 10,
  runner: n < 3 ? 0 : Math.min(10, 2 + (n - 3)),
  brute:  n < 6 ? 0 : Math.min(6, 1 + Math.floor((n - 6) / 2)),
});
```

`pickType` does a weighted draw over that map.

- [ ] **Step 2: Drive spawning from the wave state in `game.js`**

Track `wave`, `toSpawn`, `spawnTimer`, `breatherTimer`. A wave ends when
`toSpawn === 0 && zombies.length === 0`; then run the 3 s breather, increment
the wave, and refill the budget.

- [ ] **Step 3: Show the "WAVE N" banner during the breather**

- [ ] **Step 4: Verify**

Wave 1 is walkers only; runners appear at wave 3 and brutes at wave 6; each
wave spawns more, faster, and tougher; the banner shows between waves; the
"zombies remaining" count is accurate. Console clean.

- [ ] **Step 5: Commit**

```bash
git add "Game app"
git commit -m "Add waves with difficulty curve and type weighting"
```

---

### Task 6: XP orbs, levels, and score

**Files:**
- Modify: `Game app/src/config.js`, `Game app/src/entities.js`,
  `Game app/src/game.js`, `Game app/src/render.js`, `Game app/src/ui.js`

**Interfaces:**
- Produces:
  - `config.js` adds `XP {magnetRadius:90, pickupRadius:20, orbRadius:5, magnetSpeed:420}`
  - `entities.js`: `createOrb(x, y, value)`, `updateOrb(o, dt, player) -> bool`
    (true when collected)
  - `game.js`: `xpToNext(level) = Math.round(5 + 4 * level ** 1.35)`, `addXp(g, n)`

- [ ] **Step 1: Drop an orb on each zombie death, worth that type's XP**

- [ ] **Step 2: Implement orb magnetism**

Inside `magnetRadius`, accelerate the orb toward the player; inside
`pickupRadius`, collect it.

- [ ] **Step 3: XP, level threshold, and score accumulation**

`addXp` loops while `xp >= xpToNext(level)` so a single large pickup can grant
more than one level without losing the remainder.

- [ ] **Step 4: HUD shows health, XP bar, level, score, wave, zombies remaining**

- [ ] **Step 5: Verify**

Orbs drop, visibly fly to the player, and fill the XP bar; the bar resets and
the level increments at the threshold; score rises by type value. Console clean.

- [ ] **Step 6: Commit**

```bash
git add "Game app"
git commit -m "Add XP orbs, levelling, and score"
```

---

### Task 7: Level-up screen and upgrades

**Files:**
- Modify: `Game app/src/config.js`, `Game app/src/game.js`,
  `Game app/src/ui.js`, `Game app/styles.css`

**Interfaces:**
- Produces:
  - `config.js` adds `UPGRADES`, an array of
    `{id, name, description, cap, apply(stats)}`
  - `game.js`: `rollUpgrades(g) -> Upgrade[3]`, `applyUpgrade(g, id)`
  - `ui.js`: `showUpgrades(options, onPick)`

- [ ] **Step 1: Define the six upgrades with caps in `config.js`**

Damage +20% (cap 5), fire rate +20% (cap 5), move speed +15% (cap 4), max
health +25 and heal by 25 (cap 5), regeneration +0.5 HP/s (cap 3), projectile
speed +20% (cap 3).

- [ ] **Step 2: Roll three distinct non-maxed upgrades on level-up**

Filter the pool by `stacks[id] < cap`, shuffle, take three. If fewer than three
remain, offer what is left rather than padding or repeating.

- [ ] **Step 3: Enter `LEVEL_UP`, freeze simulation, show cards**

The loop keeps rendering but stops updating while in `LEVEL_UP`. Cards are
pickable by click or the `1`/`2`/`3` keys.

- [ ] **Step 4: Apply the pick, increment its stack, resume `PLAYING`**

- [ ] **Step 5: Implement health regeneration in the player update**

- [ ] **Step 6: Verify**

Levelling freezes the game and shows three cards; picking one visibly changes
behaviour (fire rate audibly/visibly faster, movement quicker, health bar
longer); a maxed upgrade stops being offered; regeneration ticks health back up.
Console clean.

- [ ] **Step 7: Commit**

```bash
git add "Game app"
git commit -m "Add level-up screen and the six upgrades"
```

---

### Task 8: Particles and visual polish

**Files:**
- Create: nothing
- Modify: `Game app/src/config.js`, `Game app/src/entities.js`,
  `Game app/src/game.js`, `Game app/src/render.js`

**Interfaces:**
- Produces:
  - `config.js` adds `MAX_PARTICLES = 400`
  - `entities.js`: `emit(x, y, count, opts)`, `updateParticles(dt)`,
    `particles` (the ring buffer, exported for `render.js`)

- [ ] **Step 1: Implement the particle ring buffer**

Preallocate `MAX_PARTICLES` objects once. `emit` overwrites the oldest slots via
a moving cursor, so heavy churn never allocates and never triggers a GC pause
mid-fight.

- [ ] **Step 2: Wire up the effects**

Muzzle flash at the barrel on fire; a small spark burst on bullet impact; a
blood burst on zombie death, scaled by type; a sparkle on XP pickup; an
expanding ring on level-up.

- [ ] **Step 3: Trigger screen shake**

On player damage, on brute death, and on level-up, at distinct magnitudes.

- [ ] **Step 4: Verify**

Every action has immediate visual feedback; particle count stays bounded during
a heavy wave; framerate holds steady with 60+ zombies on screen. Console clean.

- [ ] **Step 5: Commit**

```bash
git add "Game app"
git commit -m "Add particle effects, muzzle flash, and screen shake"
```

---

### Task 9: Screens, HUD polish, and high score

**Files:**
- Modify: `Game app/index.html`, `Game app/styles.css`,
  `Game app/src/ui.js`, `Game app/src/game.js`

**Interfaces:**
- Produces:
  - `ui.js`: `loadHighScore() -> number`, `saveHighScore(score) -> void`

- [ ] **Step 1: Build the start screen**

Title, controls, and the stored high score. Start on click or any key.

- [ ] **Step 2: Build the pause screen**

`P` or `Esc` toggles. Also auto-pause on `window.blur`, so returning to the tab
is never a free death.

- [ ] **Step 3: Build the game-over screen**

Final score, wave reached, high score, and whether this run beat it.

- [ ] **Step 4: High-score persistence**

```js
const KEY = 'zsa.highscore';
export function loadHighScore() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
export function saveHighScore(score) {
  try { localStorage.setItem(KEY, String(score)); } catch { /* private mode */ }
}
```

The try/catch is required: `localStorage` throws outright in some
private-browsing modes, and that must not break the game.

- [ ] **Step 5: Finish the HUD**

Health bar, XP bar with level, score, wave, zombies remaining, and weapon stats
reflecting current upgrades.

- [ ] **Step 6: Run the full smoke checklist**

All eight items from the spec's Verification section, plus: high score survives
a reload, and alt-tabbing mid-wave pauses rather than killing the player.

- [ ] **Step 7: Commit**

```bash
git add "Game app"
git commit -m "Add start, pause, and game-over screens with high score"
```
