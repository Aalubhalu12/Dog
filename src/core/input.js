/**
 * BONK! — Unified input (touch buttons, drag, keyboard)
 * Exposes  Input.left / Input.right (bool)  and  Input.drag (0..1 | null)
 */
const Input = (() => {
  const st = { left: false, right: false, drag: null, active: () => false, onPause: () => {} };
  let btnL, btnR, dragId = null;

  function bind({ leftBtn, rightBtn, dragSurface, canvas }) {
    btnL = leftBtn; btnR = rightBtn;
    const down = (k, b) => e => { e.preventDefault(); st[k] = true; b.classList.add('down'); SFX.unlock(); };
    const up   = (k, b) => e => { e.preventDefault(); st[k] = false; b.classList.remove('down'); };
    for (const [b, k] of [[btnL, 'left'], [btnR, 'right']]) {
      b.addEventListener('pointerdown', down(k, b));
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, up(k, b)));
    }
    const posX = e => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    dragSurface.addEventListener('pointerdown', e => { if (!st.active() || e.target.closest('button')) return; dragId = e.pointerId; st.drag = posX(e); SFX.unlock(); });
    window.addEventListener('pointermove', e => { if (dragId === e.pointerId && st.drag != null) st.drag = posX(e); });
    const endDrag = e => { if (dragId === e.pointerId) { dragId = null; st.drag = null; } };
    window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);

    const KEYS_L = ['ArrowLeft', 'a', 'A'], KEYS_R = ['ArrowRight', 'd', 'D'];
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (KEYS_L.includes(e.key)) { st.left = true; btnL.classList.add('down'); }
      if (KEYS_R.includes(e.key)) { st.right = true; btnR.classList.add('down'); }
      if (['Escape', 'p', 'P'].includes(e.key)) st.onPause();
    });
    window.addEventListener('keyup', e => {
      if (KEYS_L.includes(e.key)) { st.left = false; btnL.classList.remove('down'); }
      if (KEYS_R.includes(e.key)) { st.right = false; btnR.classList.remove('down'); }
    });
    window.addEventListener('blur', () => { reset(); st.onPause(true); });
  }
  function reset() { st.left = st.right = false; st.drag = null; dragId = null; btnL && btnL.classList.remove('down'); btnR && btnR.classList.remove('down'); }
  return {
    bind, reset,
    get left() { return st.left; }, get right() { return st.right; }, get drag() { return st.drag; },
    get any() { return st.left || st.right || st.drag != null; },
    setActiveCheck(fn) { st.active = fn; }, setPauseHandler(fn) { st.onPause = fn; },
  };
})();
