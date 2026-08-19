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

Three choices were made up front; everything below follows from them.

1. **Full PRD scope, built incrementally.** All ten steps of PRD section 8,
   including the visual polish pass, delivered stage by stage with a playable
   checkpoint at each stage boundary.
2. **Modular ES modules, served over HTTP.** Real `import`/`export` modules in
   `src/`. Browsers block ES modules over `file://`, so the game runs from a
   local static server (`python -m http.server 8000`). This satisfies the PRD's
   "modular and maintainable" requirement at the cost of one command to launch.
3. **Neon noir art direction.** Near-black arena, cyan player, sickly-green
   zombies, hot-white tracers, magenta XP orbs, glow via canvas `shadowBlur`.
   Drawn entirely procedurally — no image assets, no external dependencies.

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
no scrolling camera; the camera module exists only to apply screen shake.

Rationale: for a wave-survival arena this is more readable than a scrolling
world, and it reduces "responsive where practical" to one scale calculation.

## Module layout

```
Game app/
  index.html          canvas + DOM UI overlay
  styles.css
  package.json        no dependencies; { "type": "module" } so Node can test src/
  README.md           how to run it
  src/
    main.js           bootstrap, game loop, state machine, wiring
    config.js         all tunables and the palette
    input.js          keyboard + canvas-relative mouse coordinates
    player.js         movement, health, weapon stats, firing
    zombie.js         three types, chase + separation AI
    bullet.js         projectile pool
    collision.js      bullet/zombie, zombie/player, player/orb
    waves.js          wave composition, spawn budget, difficulty curve
    xp.js             orbs, magnetism, level curve
    upgrades.js       pool, three-choice roll, stat application
    particles.js      muzzle flash, blood, death burst, level-up ring
    camera.js         trauma-based screen shake
    render.js         world drawing
    hud.js            live HUD updates
    screens.js        start / pause / level-up / game-over
    storage.js        localStorage high score, try/catch wrapped
  test/
    *.test.js         node --test over the DOM-free logic modules
```

Every tunable number lives in `config.js`. Balancing means changing numbers
dozens of times; scattering them through logic files makes balance passes
impractical.

### Module contracts

- `config.js` — pure data. No imports, no DOM.
- `waves.js` — given a wave number, returns spawn budget, type weights, spawn
  interval, and stat scaling. No DOM.
- `xp.js` — level curve and orb state. The curve function is pure. No DOM.
- `upgrades.js` — owns the pool and stacking caps; `roll(taken)` returns three
  non-maxed options; `apply(stats, id)` returns updated stats. No DOM.
- `render.js`, `hud.js`, `screens.js` — the only modules that touch the DOM or
  the canvas context.

The four DOM-free modules are the testable core.

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

| Type   | Weight                                    |
|--------|-------------------------------------------|
| Walker | `10`                                      |
| Runner | `0` before wave 3, else `min(10, 2 + (wave − 3))` |
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
- Object pooling for bullets and particles, avoiding mid-fight GC stutter.
- `localStorage` access wrapped in try/catch — it throws outright in some
  private-browsing modes. A failure silently disables high-score persistence
  rather than breaking the game.
- Canvas resize recomputes scale without corrupting coordinates.
- Entity removal via swap-and-pop, never splicing during iteration.

## Verification

No test framework and no dependencies, per PRD section 6.

**Automated:** `node --test` over `test/*.test.js`, covering the DOM-free
logic — level curve monotonicity, upgrade stacking caps and stat math, wave
budget and interval curves, and type-weight selection. This uses only Node's
built-in test runner.

**Manual:** a written smoke checklist run at every stage checkpoint, per PRD
section 8's requirement to verify the existing game still works before adding
each major feature. The checklist covers: no console errors, movement and aim
responsiveness, shooting and kills, wave advance, level-up and upgrade
application, game over and restart, and high-score persistence across reload.

## Build stages

Each stage ends playable.

| Stage | Delivers | PRD steps |
|-------|----------|-----------|
| 1 | Project skeleton, loop, arena, player movement, mouse aim, shooting | 1–3 |
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
