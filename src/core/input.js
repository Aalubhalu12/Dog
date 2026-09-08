/**
 * BONK! — Unified input
 * ---------------------------------------------------------------
 * Touch schemes (Store.setting('control')):
 *   'drag'  (default)  relative drag — put a finger ANYWHERE and slide; the puppy moves by the same
 *                      distance × SENSITIVITY. Your thumb never has to sit on the dog, so it never hides him.
 *                      Exposed as Input.target (0..1 stage x) — a spring in Puppy follows it.
 *   'hold'             half-screen hold — left half = run left, right half = run right (Input.left / right).
 * Keyboard: ← → / A D always work. Escape / P = pause.
 * Input.any → true once the player has done anything this run (FTUE / hint use it).
 */
const Input = (() => {
  const st = { left: false, right: false, target: null, active: () => false, onPause: () => {}, puppyX: () => .5 };
  let canvas, ptr = null, mode = 'drag', sens = 1.3, touched = false;

  const rect = () => canvas.getBoundingClientRect();
  const fx = e => { const r = rect(); return (e.clientX - r.left) / r.width; };

  function bind({ dragSurface, canvas: cv }) {
    canvas = cv;
    dragSurface.addEventListener('pointerdown', e => {
      if (!st.active() || e.target.closest('button')) return;
      SFX.unlock(); touched = true; const x = fx(e);
      if (mode === 'hold') { ptr = { id: e.pointerId }; st.left = x < .5; st.right = x >= .5; return; }
      ptr = { id: e.pointerId, x0: x, p0: st.puppyX(), moved: false };  // relative drag: remember where the finger AND the puppy started
      st.target = ptr.p0;
    }, { passive: true });
    window.addEventListener('pointermove', e => {
      if (!ptr || ptr.id !== e.pointerId) return;
      const x = fx(e);
      if (mode === 'hold') { st.left = x < .5; st.right = x >= .5; return; }   // sliding across the middle switches direction
      st.target = Math.max(0, Math.min(1, ptr.p0 + (x - ptr.x0) * sens)); ptr.moved = true;
    }, { passive: true });
    const end = e => { if (ptr && ptr.id === e.pointerId) { ptr = null; st.target = null; st.left = st.right = false; } };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

    const KEYS_L = ['ArrowLeft', 'a', 'A'], KEYS_R = ['ArrowRight', 'd', 'D'];
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (KEYS_L.includes(e.key)) { st.left = true; touched = true; }
      if (KEYS_R.includes(e.key)) { st.right = true; touched = true; }
      if (['Escape', 'p', 'P'].includes(e.key)) st.onPause();
    });
    window.addEventListener('keyup', e => {
      if (KEYS_L.includes(e.key)) st.left = false;
      if (KEYS_R.includes(e.key)) st.right = false;
    });
    window.addEventListener('blur', () => { reset(); st.onPause(true); });
  }
  function reset() { st.left = st.right = false; st.target = null; ptr = null; touched = false; }
  return {
    bind, reset,
    get left() { return st.left; }, get right() { return st.right; },
    /** Relative-drag target (stage x 0..1) or null when no finger is down. */
    get target() { return st.target; },
    get any() { return touched || st.left || st.right || st.target != null; },
    get mode() { return mode; }, setMode(m) { mode = m === 'hold' ? 'hold' : 'drag'; reset(); },
    get sensitivity() { return sens; }, setSensitivity(v) { sens = Math.max(.6, Math.min(2.4, +v || 1.3)); },
    setActiveCheck(fn) { st.active = fn; }, setPauseHandler(fn) { st.onPause = fn; },
    /** Puppy tells us where he is so a new drag starts from his current spot (no jump). */
    setPuppyX(fn) { st.puppyX = fn; },
  };
})();
