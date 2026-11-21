// input.js — keyboard and mouse state for the game canvas.
// Tracks held keys, the mouse position in canvas pixels, and a queue of
// click events (consumed by the player update). No gameplay logic lives here.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    clicks: [], // { x, y } in canvas pixels, consumed once
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
    Space: 'sprint',
    KeyE: 'interact',
    KeyQ: 'smoke',
    KeyR: 'retry',
    KeyM: 'mute',
    Escape: 'pause',
    Enter: 'confirm',
  };

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (action) {
      if (!keys.has(action)) input.pressed.add(action);
      keys.add(action);
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    input.clicks.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  input.isDown = (action) => keys.has(action);
  input.wasPressed = (action) => input.pressed.has(action);
  input.endFrame = () => {
    input.pressed.clear();
    input.clicks.length = 0;
  };

  return input;
}
