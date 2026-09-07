/**
 * BONK! — Item spawner + falling item update/draw
 * Reads level difficulty from the level object and item data from ITEMS.
 */
class Spawner {
  constructor(level) { this.level = level; this.items = []; this.timer = .8; this.stage = 0; this.stageAt = 0; this.safeUntil = level.safeTime || 0; }

  /** Enter act `i` at level time `time`: pace steps up, hazards pause briefly so the light change is never a cheap hit. */
  setStage(i, time) { this.stage = i; this.stageAt = time; this.safeUntil = Math.max(this.safeUntil, time + 1.5); }
  /** 0..1 pace within the level: which act we're in (stepped) + a soft 90→100 % ease inside the act. */
  pace(time) {
    const L = this.level, n = (L.stages || []).length || 1, k = n > 1 ? this.stage / (n - 1) : 1;
    const ease = Math.max(0, Math.min(1, (time - this.stageAt) / L.ramp));
    return { k, mul: .9 + .1 * ease };
  }

  /**
   * Fall profiles — how an item moves once spawned (all values relative to level fall speed `v`).
   *   start   – initial vy as a fraction of v (items accelerate in, they don't appear at full speed)
   *   accel   – how quickly vy approaches terminal speed (1/s)
   *   term    – terminal speed multiplier (heavy things end up faster than light ones)
   *   sway    – horizontal drift amplitude (stage widths) and frequency (Hz)
   *   spin    – rotation multiplier applied to item.rot from ITEMS
   *   wobble  – tilt oscillation (rad) for things that rock while falling (coins/leaves)
   */
  static FALL = {
    tumble:  { start: .35, accel: 2.2, term: 1.00, sway: [.010, .9], spin: 1.0, wobble: 0 },     // bones: end-over-end
    flutter: { start: .30, accel: 1.6, term: .85,  sway: [.022, 1.4], spin: 0,  wobble: .35 },   // coins: light, rock side to side
    heavy:   { start: .55, accel: 3.5, term: 1.18, sway: [.003, .6], spin: .8,  wobble: 0 },     // rocks/bombs: drop hard & straight
    float:   { start: .25, accel: 1.2, term: .72,  sway: [.028, .8], spin: .5,  wobble: .15 },   // power-ups: drift down gently
  };

  static pick(weights) {
    let tot = 0; for (const k in weights) tot += weights[k];
    let r = Math.random() * tot; for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }
  static lerp(a, b, t) { return a + (b - a) * t; }

  spawn(time) {
    const L = this.level;
    let type = Spawner.pick(L.weights);
    if (time < this.safeUntil && ITEMS[type].kind === 'hazard') type = 'bone';
    this.spawnAt(type, null, time, 1);
    const { k, mul } = this.pace(time);
    this.timer = Spawner.lerp(L.spawn[0], L.spawn[1], k) / mul * (.8 + Math.random() * .4);
  }

  /** Spawn a specific item. xFrac null = random lane position; speedMul scales the level fall speed (hazard waves use ~1.08). */
  spawnAt(type, xFrac, time, speedMul = 1) {
    const L = this.level, W = BG.W, H = BG.H, { k, mul } = this.pace(time);
    const def = ITEMS[type], size = W * def.size, margin = W * .05 + size / 2, F = Spawner.FALL[def.fall] || Spawner.FALL.tumble;
    const v = H * Spawner.lerp(L.speed[0], L.speed[1], k) * mul * (.9 + Math.random() * .25) * F.term * speedMul;
    const x = xFrac == null ? margin + Math.random() * (W - margin * 2) : margin + xFrac * (W - margin * 2);
    this.items.push({ type, def, F, x, y: -size, size,
      vy: v * F.start, vt: v, age: 0,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * def.rot * F.spin,
      wob: Math.random() * 6.28, swayF: F.sway[1] * (.85 + Math.random() * .3), swayA: W * F.sway[0] * (.7 + Math.random() * .6), tilt: 0, dead: false });
  }

  /**
   * @param onCatch(item)   – item touched the puppy
   * @param onMiss(item)    – a good item hit the ground (combo-breaker for bones)
   * @param onNear(item)    – a hazard passed close by without touching (near-miss)
   * @param onDodge(item)   – a hazard reached the ground without touching the puppy
   */
  update(dt, time, puppy, powers, onCatch, onMiss, onNear, onDodge) {
    this.timer -= dt; if (this.timer <= 0) { if (Mechanics.spawnPaused) this.timer = .3; else this.spawn(time); }
    const box = puppy.box, W = BG.W, H = BG.H, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    // wind: light things (coins, power-ups) drift most, bones a bit, rocks/bombs NOT at all — hazards stay predictable
    const wind = Mechanics.windX, windK = wind ? W * .30 * wind : 0;
    for (const it of this.items) {
      if (it.dead) continue;
      // ease toward terminal speed (gravity feel), drift sideways on a per-item sine, rotate/wobble by profile
      it.age += dt; const F = it.F;
      it.vy += (it.vt - it.vy) * Math.min(1, F.accel * dt);
      it.wob += dt * it.swayF * 6.283;
      it.y += it.vy * dt; it.x += Math.cos(it.wob) * it.swayA * it.swayF * 6.283 * dt;
      if (windK && F !== Spawner.FALL.heavy) { const m = F === Spawner.FALL.tumble ? .7 : 1; it.x = clamp(it.x + windK * m * dt, it.size * .4, W - it.size * .4); }
      it.rot += it.vr * dt;
      it.tilt = (F.wobble ? Math.sin(it.wob) * F.wobble : 0) + (windK && F !== Spawner.FALL.heavy ? wind * .22 : 0);
      // slow the tumble slightly as things speed up? no — keep spin constant; it reads more solid.
      if (powers.magnet > 0 && POWERS.magnet.attracts.includes(it.type)) {
        const dx = box.cx - it.x, dy = box.cy - it.y, d = Math.hypot(dx, dy) || 1, R = W * POWERS.magnet.radius;
        if (d < R) { const f = (1 - d / R) * W * POWERS.magnet.pull * dt; it.x += dx / d * f; it.y += dy / d * f; }
      }
      const r = it.size * .36, nx = clamp(it.x, box.x, box.x + box.w), ny = clamp(it.y, box.y, box.y + box.h);
      if (it.y > box.y - r && Math.hypot(it.x - nx, it.y - ny) < r) { it.dead = true; onCatch(it); continue; }
      // near-miss: a hazard's centre passes the puppy's mid-height within MARGIN puppy-widths of its body, never touching
      if (it.def.kind === 'hazard' && !it.near && it.y > box.cy) { it.near = true;
        const gap = Math.abs(it.x - box.cx) - box.w * .5 - r; if (gap > 0 && gap < box.pw * CONFIG.NEAR_MISS.MARGIN && puppy.inv <= 0 && onNear) onNear(it); }
      if (it.y > H * CONFIG.PUPPY.GROUND_Y + it.size * .5) { it.dead = true; if (it.def.kind !== 'hazard') { onMiss && onMiss(it); Mechanics.onGround(it); } else if (onDodge) onDodge(it); }
    }
    this.items = this.items.filter(i => !i.dead);
  }

  draw(c, t) {
    for (const it of this.items) {
      const im = Assets.img(it.type); if (!im) continue;
      const s = it.size, h = s * im.height / im.width;
      if (it.def.kind === 'power' || it.def.glow) { c.save(); c.globalAlpha = .35 + Math.sin(t * 6 + it.wob) * .15; c.fillStyle = it.def.glow || (it.type === 'star' ? '#ffe45c' : '#7fe3ff'); c.beginPath(); c.arc(it.x, it.y, s * .7, 0, 6.28); c.fill(); c.restore(); }
      if (it.def.rare) { c.save(); for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.09, rr = s * .62; c.globalAlpha = .5 + Math.sin(t * 9 + i) * .4; c.fillStyle = '#fff'; c.beginPath(); c.arc(it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr * .6, s * .05, 0, 6.28); c.fill(); } c.restore(); }
      // ground shadow: appears in the last third of the fall, tightens & darkens as the item approaches the ground line
      const gy = BG.H * CONFIG.PUPPY.GROUND_Y, near = 1 - Math.min(1, Math.max(0, (gy - it.y) / (BG.H * .33)));
      if (near > 0) { c.save(); c.globalAlpha = .22 * near; c.fillStyle = '#1e3a0a'; c.beginPath(); c.ellipse(it.x, gy + 2, s * (.55 - .2 * near), s * (.13 - .05 * near), 0, 0, 6.28); c.fill(); c.restore(); }
      // faint motion streak only for heavy fast things
      if (it.F === Spawner.FALL.heavy && it.vy > it.vt * .8) { c.save(); c.globalAlpha = .12; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(it.x, it.y - s * .75, s * .18, s * .45, 0, 0, 6.28); c.fill(); c.restore(); }
      c.save(); c.translate(it.x, it.y); c.rotate(it.rot + it.tilt);
      if (it.type === 'coin') { const k = Math.cos(it.wob * .75); c.scale(Math.abs(k) * .82 + .18, 1); if (k < 0) c.scale(-1, 1); }
      c.drawImage(im, -s / 2, -h / 2, s, h); c.restore();
    }
  }
}
