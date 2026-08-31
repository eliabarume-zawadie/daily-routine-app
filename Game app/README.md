# Zombie Survival Arena

A browser-based 2D zombie survival arena game. You are trapped in a walled
arena; zombies pour in from every side in escalating waves. Shoot them, collect
the XP they drop, level up, pick an upgrade, and see how long you last.

Vanilla JavaScript, HTML5 Canvas, ES modules. **No dependencies, no build step,
no package manager.**

## Quick start

ES modules are blocked over `file://`, so double-clicking `index.html` will not
work — the game has to be served over HTTP:

```
node serve.mjs
```

Then open <http://localhost:8000>. Pass a port to use a different one:

```
node serve.mjs 9000
```

Requires Node 20.11 or newer (`serve.mjs` uses `import.meta.dirname`). There is
nothing to install and nothing to build — edit a file, refresh the browser.

`serve.mjs` is a ~40-line static file server built on Node's standard library
alone. It exists because `python -m http.server` is not reliably available: on
Windows `python` is often a Microsoft Store alias rather than a real install.
Any other static server works just as well.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrow keys | Move |
| Mouse | Aim |
| Left click | Shoot (hold to keep firing) |
| `1` `2` `3` | Pick an upgrade on the level-up screen |
| `P` / `Esc` | Pause and resume |
| `R` | Restart from the game-over screen |

Any key starts a run from the title screen.

## How it plays

**Waves.** Each wave releases a budget of zombies, then gives you a three-second
breather before the next one. The budget grows, the spawn interval shrinks, and
zombie health and speed scale up as you go.

**Zombie types.** Walkers from the start; runners join around wave 3, brutes
around wave 6, and the spawn mix keeps tilting toward them.

| Type | Health | Speed | Bite | XP | Score |
|---|---|---|---|---|---|
| Walker | 40 | 70 | 8 | 1 | 10 |
| Runner | 22 | 155 | 6 | 2 | 20 |
| Brute | 220 | 42 | 22 | 6 | 60 |

**XP and levels.** Kills drop magenta XP orbs that pull toward you once you get
close. Filling the XP bar pauses the game and offers three upgrades drawn from
the pool below; each has a stack cap, so the pool stays alive deep into a run.

- **High Caliber** — +20% weapon damage (×5)
- **Hair Trigger** — +20% fire rate (×5)
- **Adrenaline** — +15% movement speed (×4)
- **Field Rations** — +25 max health, and heals 25 (×5)
- **Field Medic** — regenerate +0.5 health per second (×3)
- **Hot Loads** — +20% projectile speed (×3)

**Difficulty tracks your level, not just the wave.** Every scaling curve takes
both the wave number and your player level, so stacking upgrades raises the
stakes instead of trivialising the run — you meet bigger, faster, nastier
crowds sooner. No upgrade can ever make the game easier.

**Zombies are solid.** You cannot walk through them, so a closed ring will trap
you. Contact damage is capped as a refilling budget of bites per cooldown spent
closest-zombie-first, which keeps a swarm survivable without making it harmless.

**High score** persists in `localStorage` under `zsa.highscore`. If storage is
unavailable (some private-browsing modes throw outright), persistence is
silently disabled rather than breaking the run.

## Project structure

```
index.html     canvas + DOM UI overlay (HUD and the four screens)
styles.css
serve.mjs      dependency-free static server
src/
  config.js    every tunable: stats, curves, palette, upgrade definitions
  input.js     keyboard state + canvas-relative mouse position
  entities.js  player, zombies, bullets, XP orbs, particles
  waves.js     spawn budget, type weights, difficulty scaling
  game.js      state machine, loop, collisions, XP/levels, upgrade flow
  render.js    all canvas drawing, including effects and screen shake
  ui.js        DOM HUD, the four screens, high-score persistence
```

Two conventions carry most of the weight:

- **All tunable numbers live in `src/config.js`.** Balancing means changing
  numbers dozens of times, so nothing else should hold a magic number.
- **Canvas draws the world, DOM draws the UI.** `render.js` owns the canvas
  context; `ui.js` owns the DOM. Nothing else touches either.

The simulation runs on a fixed 1/60 s timestep with a per-frame step cap, and a
`MENU` / `PLAYING` / `LEVEL_UP` / `PAUSED` / `GAME_OVER` state machine gates all
behavior.

## Tweaking it

Open `src/config.js` — arena size and palette, player and weapon stats, the
three zombie profiles, wave and level scaling coefficients, the XP curve, screen
shake, and the upgrade list are all there. Setting every coefficient in
`LEVEL_SCALING` to zero reverts to pure wave-based difficulty.

## Docs

- `PRD.md` — the product requirements this was built against
- `../docs/superpowers/specs/2026-08-19-zombie-survival-arena-design.md` — the
  design doc, authoritative for stats, curves, palette, and build order
- `CLAUDE.md` — conventions and rationale for anyone (or any agent) editing the code

There is no automated test suite: playing it in the browser and watching the
console is the test. The design doc's Verification section has the smoke
checklist.

> **Note:** this folder is unrelated to the daily-briefing routine in the
> repository root `CLAUDE.md`. They just share a repository.
