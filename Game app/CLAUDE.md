# CLAUDE.md — Zombie Survival Arena

Guidance for Claude Code when working on the game in this folder.

**This folder is unrelated to the daily-briefing routine in the repository root
`CLAUDE.md`.** That file is auto-loaded alongside this one; ignore its
procedure entirely when working here. It reads and trashes real email.

## What this is

A browser-based 2D zombie survival arena game: vanilla JavaScript, HTML5
Canvas, ES modules, zero dependencies.

- Requirements: `PRD.md`
- Design: `../docs/superpowers/specs/2026-08-19-zombie-survival-arena-design.md`

The design doc is authoritative for stats, curves, palette, and build order.
Change it there first, not only in code.

## Running it

ES modules are blocked over `file://`, so double-clicking `index.html` will not
work. Serve the folder:

```
node serve.mjs
```

Then open `http://localhost:8000`. Pass a port to use a different one
(`node serve.mjs 9000`). There is no build step and no package manager — edit a
file, refresh the browser.

`serve.mjs` is a dependency-free static server using only Node's standard
library. It exists because `python -m http.server` is not reliably available:
on Windows, `python` is often a Store alias rather than a real install. Any
other static server works too.

## Structure

```
index.html     canvas + DOM UI overlay
styles.css
serve.mjs      dependency-free static server (node serve.mjs)
src/
  config.js    every tunable: stats, curves, palette, upgrade definitions
  input.js     keyboard state + canvas-relative mouse position
  entities.js  player, zombies, bullets, XP orbs, particles
  waves.js     spawn budget, type weights, difficulty scaling
  game.js      state machine, loop, collisions, XP/levels, upgrade flow
  render.js    all canvas drawing, including effects and screen shake
  ui.js        DOM HUD, the four screens, high-score persistence
```

## Conventions

- **All tunable numbers live in `config.js`.** Balancing means changing numbers
  dozens of times; a magic number buried in game logic makes that impractical.
  If you write a literal that someone might want to tune, it belongs in config.
- **Canvas draws the world, DOM draws the UI.** `render.js` owns the canvas
  context; `ui.js` owns the DOM. Nothing else touches either.
- **Entities are plain objects in flat arrays.** No class hierarchies. Remove
  them with swap-and-pop, never by splicing during iteration.
- **Simulation runs on a fixed 1/60 s timestep** with a per-frame step cap.
  Update logic takes `dt` and must never read wall-clock time directly.
- **The state machine gates behavior.** `MENU`, `PLAYING`, `LEVEL_UP`,
  `PAUSED`, `GAME_OVER`. Route on state rather than adding boolean flags like
  `isPaused` — flags are how contradictory states get created.
- **Difficulty keys off both wave and player level.** `waves.js` takes
  `(wave, level)` and every curve is monotonic in each, so no upgrade can ever
  make the game easier. Coefficients live in `LEVEL_SCALING`; zero them to
  revert to pure wave-based difficulty.
- **Solid bodies are asymmetric, deliberately.** Zombies clamp themselves to
  the player's edge; the player's own movement is cancelled per axis. Never
  "fix" this by pushing the player out of overlaps instead — that makes
  encirclement impossible, because a closing ring squeezes the player straight
  out of it. Bites use `CONTACT_REACH` past the contact distance, since bodies
  now rest exactly on that boundary.
- **Contact damage is throughput-capped, not instant-capped.** `game.biteBudget`
  refills at `MAX_ATTACKERS` bites per `CONTACT_COOLDOWN`, spent
  closest-zombie-first. Do not "simplify" this to a limit on how many zombies
  may bite per frame — that was tried and measured failing, because the nearest
  few change as bodies jostle and the ring rotates through the cap.
- **No dependencies, no build step, no tooling files.** PRD section 6. If
  something seems to need a package, raise it before adding one.

## Building it

Follow the five stages in the design doc, in order. Each stage must end with a
game that actually runs — PRD section 8 requires verifying the existing game
still works before starting the next major feature.

Run the smoke checklist in the design doc's Verification section at every stage
boundary. There is no automated test suite; playing it in the browser and
watching the console *is* the test.
