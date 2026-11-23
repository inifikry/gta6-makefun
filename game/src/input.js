// Keyboard and mouse input: WASD/arrows to move and drive, Shift to run,
// E to enter or leave a car, F to punch, Space or click to shoot, P/Esc to
// pause, Enter/Space to confirm on menus. The mouse position is tracked in
// canvas pixels so the player can aim with it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
};

export function createInput(canvas) {
  const keys = new Set();
  const queue = [];
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) queue.push(action);
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    // A click confirms on menus (start, restart, resume) and aims the shot
    // in play; the held button itself is what fires, via shooting().
    queue.push(ACTION_CONFIRM);
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // -1/0/1 on each axis, from WASD or the arrow keys.
    move() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    shooting() {
      return keys.has('Space') || mouseDown;
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    takeActions() {
      let actions = 0;
      while (queue.length > 0) actions |= queue.shift();
      return actions;
    },
  };
}
