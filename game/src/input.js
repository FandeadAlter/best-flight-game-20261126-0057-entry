// Keyboard + mouse. Arrow keys / WASD fly the plane, Shift/Ctrl work the
// throttle, the mouse steers like a stick (pointer offset from screen centre),
// the wheel works the throttle, R restarts, P pauses, M mutes.

export function createInput(canvas) {
  const keys = new Set();
  let mouseActive = false;
  let mousePitch = 0; // -1..1, + = pull up
  let mouseRoll = 0; // -1..1, + = bank right
  let wheelNudge = 0; // one-shot throttle nudge from the wheel, consumed by read()

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const onKeyUp = (e) => {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    if (Math.abs(dx) < 0.06 && Math.abs(dy) < 0.06) {
      mouseActive = false;
      mousePitch = 0;
      mouseRoll = 0;
      return;
    }
    mouseActive = true;
    mouseRoll = Math.max(-1, Math.min(1, dx));
    mousePitch = Math.max(-1, Math.min(1, -dy));
  };
  const onWheel = (e) => {
    e.preventDefault();
    wheelNudge += e.deltaY < 0 ? 0.07 : -0.07;
  };
  const onBlur = () => keys.clear();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function pressed(...names) {
    return names.some((n) => keys.has(n));
  }

  return {
    // One-shot edge: true only on the frame the key went down.
    consume(...names) {
      for (const n of names) {
        if (keys.has(n)) {
          keys.delete(n);
          return true;
        }
      }
      return false;
    },
    read() {
      const pitch = (pressed('ArrowUp', 'w') ? 1 : 0) - (pressed('ArrowDown', 's') ? 1 : 0);
      const roll = (pressed('ArrowRight', 'd') ? 1 : 0) - (pressed('ArrowLeft', 'a') ? 1 : 0);
      const throttle = (pressed('Shift') ? 1 : 0) - (pressed('Control') ? 1 : 0);
      const throttleNudge = wheelNudge;
      wheelNudge = 0;
      return {
        pitch,
        roll,
        throttle,
        throttleNudge,
        mouse: mouseActive ? { pitch: mousePitch, roll: mouseRoll } : null,
        paused: pressed('p', 'P'),
        restart: pressed('r', 'R'),
        mute: pressed('m', 'M'),
        start: pressed('Enter', ' '),
      };
    },
  };
}
