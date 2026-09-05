/**
 * BONK! — Visual feedback: floating text, banners, flash, shake, particles
 */
const FX = (() => {
  const layer = document.getElementById('fx');
  const shaker = document.getElementById('shaker');
  let parts = [];

  const pop = (x, y, text, cls = 'good') => {
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
    d.style.left = (x / BG.W * 100) + '%'; d.style.top = (y / BG.H * 100) + '%'; layer.appendChild(d); setTimeout(() => d.remove(), 1000);
  };
  const banner = text => { const d = document.createElement('div'); d.className = 'banner'; d.textContent = text; layer.appendChild(d); setTimeout(() => d.remove(), 1400); };
  const flash  = () => { if (!CONFIG.FX.FLASH) return; const d = document.createElement('div'); d.className = 'flash'; layer.appendChild(d); setTimeout(() => d.remove(), 500); };
  const shake  = () => { if (!CONFIG.FX.SHAKE) return; shaker.classList.remove('shake'); void shaker.offsetWidth; shaker.classList.add('shake'); };
  const vibrate= p => { if (Store.setting('vib', CONFIG.FX.VIBRATE_DEFAULT) && navigator.vibrate) navigator.vibrate(p); };

  const burst = (x, y, cols, n = 10, spd = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = (60 + Math.random() * 140) * spd;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: .6 + Math.random() * .4, t: 0, r: 3 + Math.random() * 4, col: cols[i % cols.length], star: Math.random() < .3 });
    }
  };
  const update = dt => { for (const p of parts) { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(p => p.t < p.life); };
  const draw = c => {
    for (const p of parts) {
      const a = 1 - p.t / p.life; c.save(); c.globalAlpha = a; c.fillStyle = p.col; c.translate(p.x, p.y);
      if (p.star) { c.rotate(p.t * 6); c.beginPath(); for (let i = 0; i < 5; i++) { const A = i * 1.2566, B = A + .628; c.lineTo(Math.cos(A) * p.r * 1.6, Math.sin(A) * p.r * 1.6); c.lineTo(Math.cos(B) * p.r * .7, Math.sin(B) * p.r * .7); } c.closePath(); c.fill(); }
      else { c.beginPath(); c.arc(0, 0, p.r * a, 0, 6.28); c.fill(); }
      c.restore();
    }
  };
  const clear = () => { layer.innerHTML = ''; parts = []; };
  return { pop, banner, flash, shake, vibrate, burst, update, draw, clear };
})();
