# Zombie Survival Arena — PRD

## 1. Product Overview

Build a polished, browser-based 2D zombie survival arena game.

The player controls a survivor trapped in an arena and must survive increasingly difficult waves of zombies. The player moves, aims, shoots, earns XP, levels up, and chooses upgrades to become stronger.

The game should feel like a small, polished arcade game rather than a basic coding demo.

## 2. Core Gameplay

* Move the player using WASD / Arrow Keys.
* Aim using the mouse.
* Click to shoot.
* Zombies continuously spawn and chase the player.
* Killing zombies gives XP and score.
* Survive increasingly difficult waves.
* Leveling up pauses the game and presents 3 upgrade choices.
* Player health reaches zero → Game Over.
* Allow the player to restart and play again.

## 3. Progression

Include:

* Increasing zombie count and difficulty.
* Player XP and levels.
* Score counter.
* Health system.
* Multiple upgrade choices.
* Increasingly difficult waves.
* High score saved locally in the browser.

Example upgrades:

* +20% weapon damage
* +20% fire rate
* +15% movement speed
* +25 maximum health
* Health regeneration
* Increased projectile speed

## 4. Visual Direction

Create a dark, atmospheric, modern arcade aesthetic.

The arena should include:

* Dark environment
* Detailed player character
* Visually distinct zombies
* Muzzle flashes
* Bullet/projectile effects
* Zombie hit effects
* Explosions or death particles
* Screen shake for impactful events
* XP pickup effects
* Level-up animation
* Clear HUD

Prioritize smooth animation and visual feedback.

## 5. Game UI

HUD should clearly display:

* Health
* XP / XP progress
* Current level
* Score
* Current wave
* Zombies remaining
* Weapon information

Include:

* Start screen
* Pause screen
* Level-up upgrade screen
* Game-over screen
* Restart button

## 6. Technical Requirements

* Browser-based.
* Desktop-first but responsive where practical.
* No backend required for the initial version.
* Store high score using localStorage.
* Prefer HTML5 Canvas and JavaScript for the game engine.
* Keep the project modular and maintainable.
* Avoid external dependencies unless clearly necessary.

## 7. Quality Requirements

The game must:

* Feel responsive and fast.
* Have smooth movement and animations.
* Provide immediate visual feedback for actions.
* Work reliably without console errors.
* Prevent impossible or broken game states.
* Have clear game instructions.
* Look polished enough to demonstrate as a finished mini-game.

## 8. Development Approach

Build the game incrementally.

Start with the minimum playable version:

1. Player movement
2. Mouse aiming
3. Shooting
4. Zombie spawning and chasing
5. Collision and damage
6. XP and score
7. Waves
8. Level-up upgrades
9. Game-over/restart
10. Visual polish and effects

Do not add unnecessary complexity before the core gameplay is stable.

Before implementing each major feature, verify that the existing game still works correctly.
