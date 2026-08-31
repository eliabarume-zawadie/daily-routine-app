// Keyboard and mouse state. Nothing here knows what the game does with it.

export const input = {
  keys: new Set(),      // currently held, by KeyboardEvent.code
  mouse: { x: 0, y: 0 },  // arena coordinates, not screen pixels
  firing: false,
};

// Keys consumed once per physical press (pause, upgrade picks, restart).
// Reading a press clears it, so a held key cannot retrigger every frame.
const pressed = new Set();

export function takePressed(code) {
  if (!pressed.has(code)) return false;
  pressed.delete(code);
  return true;
}

export function anyPressed() {
  if (pressed.size === 0) return false;
  pressed.clear();
  return true;
}

export function clearPressed() {
  pressed.clear();
}

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

export function moveVector() {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
  // Normalize so diagonals aren't faster than the cardinals.
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(clientX: number, clientY: number) => {x: number, y: number}} screenToWorld
 */
export function initInput(canvas, screenToWorld) {
  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS.has(e.code) || e.code === 'Space') e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    input.keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });

  canvas.addEventListener('mousemove', (e) => {
    const p = screenToWorld(e.clientX, e.clientY);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.firing = true;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
  });

  // Without these the weapon can stick on when focus or the cursor leaves.
  canvas.addEventListener('mouseleave', () => { input.firing = false; });
  window.addEventListener('blur', () => {
    input.firing = false;
    input.keys.clear();
    pressed.clear();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
