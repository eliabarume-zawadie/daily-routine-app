# Zombie Survival Arena — Design

Date: 2026-08-19
Source PRD: `Game app/PRD.md`

## Purpose

A browser-based 2D zombie survival arena game. The player is trapped in an
arena, survives escalating waves of zombies, earns XP, levels up, and picks
upgrades. It must read as a small polished arcade game, not a coding demo.

This spec covers the full PRD, built in five stages. Every stage ends with a
playable game.

## Decisions

Four choices were made up front; everything below follows from them.

1. **Full PRD scope, built incrementally.** All ten steps of PRD section 8,
   including the visual polish pass, delivered stage by stage with a playable
   checkpoint at each stage boundary.
2. **Modular ES modules, served over HTTP.** Real `import`/`export` modules in
   `src/`. Browsers block ES modules over `file://`, so the game runs from a
   local static server: `node serve.mjs`. This satisfies the PRD's "modular and
   maintainable" requirement at the cost of one command to launch.

   `serve.mjs` uses only Node's standard library and adds no dependency. It
   exists because `python -m http.server` cannot be relied on — on Windows
   `python` is frequently a Microsoft Store alias rather than an interpreter,
   and the documented command fails outright.
3. **Neon noir art direction.** Near-black arena, cyan player, sickly-green
   zombies, hot-white tracers, magenta XP orbs, glow via canvas `shadowBlur`.
   Drawn entirely procedurally — no image assets, no external dependencies.
4. **Keep it as simple as the PRD asks.** PRD section 8 says not to add
   complexity before the core is stable, and section 6 says to avoid
   dependencies. So: seven source modules, no build step, no package manager,
   no test framework, and no file that does not earn its place. Nine files of
   game — the HTML, the CSS, and seven modules.

## Architecture

### Canvas renders the world; DOM renders the UI

A single `<canvas>` draws the arena, entities, and effects. The HUD and all
four screens (start, pause, level-up, game-over) are HTML elements positioned
over it with CSS.

Rationale: reimplementing text layout, buttons, hover states, and focus
management inside canvas is substantial work for a worse result. The DOM gives
crisp text, real interaction states, and keyboard accessibility for free.

### Fixed-timestep game loop

`requestAnimationFrame` feeds an accumulator that advances simulation in fixed
1/60 s steps, capped at 5 steps per frame to prevent a death spiral. Rendering
happens once per animation frame.

Rationale: PRD section 7 requires preventing broken game states. A variable
timestep lets a backgrounded tab return with a multi-second delta, tunnelling
zombies straight through the player. The fixed step removes that class of bug.

### State machine

```
MENU -> PLAYING -> LEVEL_UP -> PLAYING
          |  ^                    |
          v  |                    v
        PAUSED                GAME_OVER -> PLAYING (restart)
```

A single `state` value routes input handling, updates, and rendering. Illegal
actions — shooting while a level-up is open, pausing on the menu — are
structurally impossible rather than guarded case by case.

### Fixed logical arena

The arena is a fixed 1280×720 logical space, scaled uniformly to fit the window
with letterboxing. Zombies spawn just outside the edges and walk in. There is
no scrolling camera; screen shake is applied as a translation at draw time.

Rationale: for a wave-survival arena this is more readable than a scrolling
world, and it reduces "responsive where practical" to one scale calculation.

## Files

```
Game app/
  CLAUDE.md      guidance for working on this game
  PRD.md         the product requirements
  index.html     canvas + DOM UI overlay
  styles.css
  serve.mjs      dependency-free static server, Node stdlib only
  src/
    config.js    every tunable: stats, curves, palette, upgrade definitions
    input.js     keyboard state + canvas-relative mouse position
    entities.js  player, zombies, bullets, XP orbs, particles
    waves.js     spawn budget, type weights, difficulty scaling
    game.js      state machine, loop, collisions, XP/levels, upgrade flow
    render.js    all canvas drawing, including effects and screen shake
    ui.js        DOM HUD, the four screens, high-score persistence
```

Nine files of game plus `serve.mjs`, and the PRD and the folder's CLAUDE.md. No
`package.json`, no build step, no test directory — nothing that exists only to
support tooling.

### What lives where

- `config.js` — pure data, no imports. Every number that might be tuned during
  balancing lives here so a balance pass touches one file.
- `entities.js` — creation and per-frame update for each entity kind. They are
  plain objects in flat arrays, not class hierarchies.
- `waves.js` — pure functions from wave number to spawn budget, type weights,
  spawn interval, and stat scaling.
- `game.js` — owns the entity arrays and the state machine, runs the loop, and
  resolves collisions and progression. The largest module; if it grows past
  comfortable reading, waves/upgrade logic splits out first.
- `render.js` and `ui.js` — the only modules that touch the canvas context or
  the DOM.

## Gameplay

### Player

Radius 14, speed 260 px/s, max health 100. Moves on WASD/arrows, aims at the
mouse, fires on click or held mouse button. Confined to the arena bounds.

Starting weapon: damage 25, fire rate 5/s, projectile speed 900 px/s,
projectile radius 4, lifetime 1.2 s. One weapon only — the PRD does not ask
for a second, and upgrades provide the progression.

### Zombie types

| Type   | HP  | Speed | Damage | Radius | XP | Score | From wave |
|--------|-----|-------|--------|--------|----|-------|-----------|
| Walker | 40  | 70    | 8      | 14     | 1  | 10    | 1         |
| Runner | 22  | 155   | 6      | 11     | 2  | 20    | 3         |
| Brute  | 220 | 42    | 22     | 26     | 6  | 60    | 6         |

Each is visually distinct in silhouette and size, satisfying PRD section 4.

AI: a steering force toward the player plus a separation force pushing apart
overlapping zombies, so a crowd spreads into a horde instead of collapsing into
one shape. Contact damage applies on touch with a per-zombie 0.6 s cooldown —
per-attacker rather than global invulnerability frames, so being surrounded is
genuinely more dangerous than being chased by one.

### Waves

- Spawn budget: `8 + 5 × (wave − 1)`
- Spawn interval: `max(0.25, 1.2 − 0.06 × (wave − 1))` seconds
- HP scaling: `1 + 0.06 × (wave − 1)`
- Speed scaling: `min(1.5, 1 + 0.02 × (wave − 1))`

Spawn type is a weighted random draw, with the weights growing by wave so the
mix shifts from all Walkers toward a Runner-and-Brute-heavy horde:

| Type   | Weight                                                     |
|--------|------------------------------------------------------------|
| Walker | `10`                                                       |
| Runner | `0` before wave 3, else `min(10, 2 + (wave − 3))`          |
| Brute  | `0` before wave 6, else `min(6, 1 + floor((wave − 6) / 2))` |

A wave clears when its budget is spent and no zombies remain alive. A 3 s
breather and a "WAVE N" banner follow before the next wave begins.

### XP, levels, score

Every zombie death drops an XP orb. Orbs magnetize toward the player inside a
90 px radius and are collected at 20 px. Level threshold:
`xpToNext(level) = round(5 + 4 × level^1.35)`.

Score accumulates per kill by type, and is what gets saved as the high score.

### Upgrades

Exactly the six from PRD section 3, each stackable to a cap:

| Upgrade             | Effect per stack | Cap |
|---------------------|------------------|-----|
| Weapon damage       | +20%             | 5   |
| Fire rate           | +20%             | 5   |
| Movement speed      | +15%             | 4   |
| Maximum health      | +25 (and heals)  | 5   |
| Health regeneration | +0.5 HP/s        | 3   |
| Projectile speed    | +20%             | 3   |

On level-up the game freezes and offers three options drawn from upgrades that
have not hit their cap. Twenty-five total stacks means the pool stays alive
deep into a run rather than drying up around level 8. Selectable by click or
the 1/2/3 keys.

## Visual design

Palette (`config.js`):

```
bg deep      #07070c      player       #22d3ee
bg grid      #14141f      bullet       #fef9c3
zombie       #84cc16      zombie hurt  #ef4444
xp orb       #d946ef      health       #22c55e
danger       #f43f5e
```

Effects, all procedural: muzzle flash at the barrel, tracer projectiles with
glow, hit flash and blood particles, death bursts, XP pickup sparkle, a
level-up ring expanding from the player, and trauma-based screen shake
(`offset = trauma² × 12 px`, with trauma decaying continuously) triggered by
player damage, Brute deaths, and level-ups.

## HUD and screens

HUD, always visible during play: health bar, XP bar with current level, score,
current wave, zombies remaining, and weapon stats.

Screens: **Start** with controls and the stored high score; **Pause**;
**Level-up** with three upgrade cards; **Game-over** with final score, wave
reached, high score, and a restart button.

Controls: WASD/arrows move, mouse aims, click or hold to shoot, `P` or `Esc`
pauses, `1`/`2`/`3` picks an upgrade, `R` restarts from game over.

## Error handling and robustness

- Fixed timestep with a step cap, as above.
- Auto-pause on window blur, so returning to the tab is never a free death.
- Particles come from a fixed-size ring buffer, so heavy effect churn cannot
  trigger mid-fight garbage-collection stutter. Other entities use flat arrays
  with swap-and-pop removal; their counts are low enough that a pool
  abstraction would be complexity without benefit.
- `localStorage` access wrapped in try/catch — it throws outright in some
  private-browsing modes. A failure silently disables high-score persistence
  rather than breaking the game.
- Canvas resize recomputes scale without corrupting coordinates.
- Entity removal via swap-and-pop, never splicing during iteration.

## Verification

No test framework and no dependencies, per PRD section 6, and no tooling files,
per the simplicity decision above. Verification is functional, which is what
PRD section 8 asks for: before each major feature, confirm the existing game
still works.

At every stage checkpoint, run this smoke checklist in the browser:

1. Console is free of errors and warnings.
2. Movement responds immediately in all eight directions and the player cannot
   leave the arena.
3. Aim tracks the cursor; firing produces bullets that travel and expire.
4. Zombies spawn, chase, take damage, and die. (Stage 2 onward.)
5. A wave clears and the next begins. (Stage 3 onward.)
6. Level-up appears, an upgrade applies, and its effect is observable.
   (Stage 4 onward.)
7. Death shows game over; restart returns to a clean run with reset stats.
8. High score survives a page reload. (Stage 5.)

## Build stages

Each stage ends playable.

| Stage | Delivers | PRD steps |
|-------|----------|-----------|
| 1 | Skeleton, loop, arena, player movement, mouse aim, shooting | 1–3 |
| 2 | Zombies, chase AI, collision, damage, health, game over, restart | 4, 5, 9 |
| 3 | XP orbs, levels, score, waves | 6, 7 |
| 4 | Level-up screen and the six upgrades | 8 |
| 5 | Particles, muzzle flash, screen shake, level-up animation, full HUD and screens, high score | 10 |

## Out of scope

- Any backend, account, or online leaderboard.
- Additional weapons or weapon switching.
- Mobile and touch controls beyond the responsive canvas scale.
- A spatial-hash collision grid. At realistic entity counts the naive checks
  are a few thousand comparisons per frame. Add one only if profiling shows a
  measured problem.
- Audio. The PRD does not ask for it.
