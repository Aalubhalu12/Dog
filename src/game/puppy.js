/**
 * BONK! — Puppy (player): movement physics + rig driver
 * ---------------------------------------------------------------
 * v0.17: the puppy is a procedural cut-out rig (src/game/rig.js) instead of sprite sheets.
 * This class owns the PHYSICS (position, velocity, turning, hop, i-frames) and turns it into
 * the rig's inputs each frame:
 *   • speed  → gait cadence + stride length (paws lock to the ground at every speed)
 *   • accel  → body lean, ear/tail whip (secondary motion)
 *   • target → head look-at: he watches the nearest good thing falling toward him
 *   • state  → run / idle / yay / bonk / dizzy / celebrate (expressions, mouth, eyes)
 * Direction changes pivot through a short narrowing (no instant mirror); landing squashes.
 *
 * Public surface used by Game / Mechanics / FTUE / bots:
 *   x, vx, width, height, groundY, box, inv, stun, squash, voiceCd, face
 *   update(dt) · draw(c, t, magnet, shield) · reset() · setPose(p, t) · celebrate() · surprised() · puffDust(n)
 *   lookAt(x, y | null)  — set by Game each frame (nearest catchable item)
 */
class Puppy {
  constructor() { this.reset(); }

  reset() {
    Object.assign(this, {
      x: .5, vx: 0, face: 1, prevFace: 1, turnT: 1, pose: 'idle', poseT: 0, inv: 0, stun: 0,
      squash: 1, hop: 0, hopV: 0, dust: [], turnCooldown: 0, voiceCd: 0, stepPhase: 0, look: null, celebT: 0, airborne: false, windLean: 0,
    });
    if (typeof Rig !== 'undefined') Rig.reset();
  }

  // --- geometry -----------------------------------------------------------
  get W() { return BG.W; } get H() { return BG.H; }
  /** standing height (ground → top of head) */
  get height() { return Math.min(this.H * CONFIG.PUPPY.HEIGHT_FRAC, this.W * CONFIG.PUPPY.MAX_WIDTH_FRAC / 1.25); }
  get width()  { return this.height * 1.25; }
  get groundY(){ return this.H * CONFIG.PUPPY.GROUND_Y; }
  get box() {
    const pw = this.width, ph = this.height, x = this.x * this.W;
    return { x: x - pw * .34, y: this.groundY - this.hop - ph * .98, w: pw * .68, h: ph * .95, cx: x, cy: this.groundY - this.hop - ph * .55, pw, ph };
  }

  /** Reaction from game: 'yay' on a catch, 'bonk' / 'dizzy' on a hit. */
  setPose(p, t) {
    const MAX = this.W * CONFIG.PUPPY.MAX_SPEED, sp = Math.abs(this.vx) / MAX;
    if (p === 'yay') { this.hopV = this.width * (sp > .3 ? 1.5 : 1.1); this.squash = 1.12; }
    if (p === 'bonk' || p === 'dizzy') { Rig.kick(p === 'bonk' ? -7 : 5); this.squash = .86; }
    this.pose = p; this.poseT = t;
  }
  /** Level clear: plant the paws, sit up and bounce — a little curtain call. */
  celebrate() { this.vx = 0; this.stun = 1.4; this.inv = 2; this.pose = 'celebrate'; this.poseT = 1.6; this.hopV = this.width * 1.8; this.squash = 1.15; this.puffDust(4); this.celebT = .55; }
  /** Squirrel stole a bone: a tiny startled bounce + squash ("HEY!") without stopping the run. */
  surprised() { if (this.stun > 0) return; this.hopV = Math.max(this.hopV, this.width * .9); this.squash = .88; Rig.kick(4); }
  /** Where should he look? (stage px) — Game passes the nearest catchable item, or null. */
  lookAt(x, y) { this.look = x == null ? null : [x, y]; }

  // --- update -------------------------------------------------------------
  update(dt) {
    const C = CONFIG.PUPPY, W = this.W;
    const MAX = W * C.MAX_SPEED, ACC = W * C.ACCEL, FR = C.FRICTION;
    const half = this.width * .40 / W, minX = Math.max(C.MIN_X, half), maxX = Math.min(C.MAX_X, 1 - half);
    const prevVx = this.vx;

    if (this.stun > 0) { this.stun -= dt; this.vx -= this.vx * Math.min(1, FR * dt); }
    else if (Input.target != null) {
      // relative drag: critically-damped spring to the target — weight, but no overshoot past the finger
      const k = C.DRAG_SPRING, d = 2 * Math.sqrt(k);
      const tx = Math.max(minX, Math.min(maxX, Input.target)) * W;
      this.vx += (k * (tx - this.x * W) - d * this.vx) * dt; this.vx = Math.max(-MAX * 1.4, Math.min(MAX * 1.4, this.vx));
    } else {
      const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
      if (dir) this.vx += dir * ACC * dt; else this.vx -= this.vx * Math.min(1, FR * dt);
      this.vx = Math.max(-MAX, Math.min(MAX, this.vx));
    }
    this.x += this.vx / W * dt;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx * -.25); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx * -.25); }

    // --- facing: by velocity, with a short pivot (body narrows to 45 % then widens facing the other way)
    const sp = Math.abs(this.vx) / MAX;
    const newFace = sp > .05 ? (this.vx > 0 ? 1 : -1) : this.face;
    this.turnCooldown -= dt;
    if (newFace !== this.face) {
      if (Math.abs(prevVx) > MAX * .35 && this.turnCooldown <= 0) { this.puffDust(3); this.turnCooldown = .4; Rig.kick(3 * newFace); }
      this.prevFace = this.face; this.turnT = this.turnT < 1 ? 1 - this.turnT : 0;
    }
    this.face = newFace;
    if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / .16);

    // --- pose timer
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.pose = 'idle'; }

    // --- hop (catch / celebrate): ballistic arc; squash on landing
    if (this.hopV > 0 || this.hop > 0) {
      this.hop += this.hopV * dt; this.hopV -= this.width * 14 * dt; this.airborne = true;
      if (this.hop <= 0) { this.hop = 0; this.hopV = 0; if (this.airborne) { this.squash = .90; Rig.kick(-2); this.airborne = false; } }
    }
    if (this.celebT > 0) { this.celebT -= dt; if (this.celebT <= 0 && this.hop <= 0) this.hopV = this.width * 1.3; }   // second celebration bounce
    this.squash += (1 - this.squash) * Math.min(1, dt * 8);
    if (this.inv > 0) this.inv -= dt;
    this.voiceCd -= dt;
    const gust = typeof Mechanics !== 'undefined' ? Mechanics.windX : 0; this.windLean += (gust - this.windLean) * Math.min(1, dt * 4);

    // --- paw pats (from the rig's stride phase) ----------------------------
    const ph = Rig.S.stride; if (sp > .3 && ((this.stepPhase < .5 && ph >= .5) || (this.stepPhase > ph))) SFX.step(sp); this.stepPhase = ph;

    // --- drive the rig ------------------------------------------------------
    const state = this.pose !== 'idle' ? this.pose : (sp > .04 && this.stun <= 0 ? 'run' : 'idle');
    let lookX = null, lookY = null;
    if (this.look) { const b = this.box, dx = (this.look[0] - b.cx) / this.W, dy = (b.cy - this.look[1]) / this.H; lookX = Math.max(-1, Math.min(1, dx * 3)) * this.face; lookY = Math.max(-1, Math.min(1, dy * 2.2)); }
    this._rigIn = { speed: this.vx / MAX, face: this.face, state, hop: this.hop, lookX, lookY, wind: this.windLean };
    Rig.update(dt, this._rigIn);
    Rig.S.squash = Rig.S.squash * .5 + this.squash * .5;

    for (const d of this.dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy -= 30 * dt; }
    this.dust = this.dust.filter(d => d.t < d.life);
  }

  puffDust(n) {
    const b = this.box;
    for (let i = 0; i < n; i++) this.dust.push({ x: b.cx - this.face * b.pw * (.1 + Math.random() * .25), y: this.groundY - 2, vx: -this.face * (20 + Math.random() * 40), vy: -(10 + Math.random() * 20), r: 3 + Math.random() * 4, t: 0, life: .45 + Math.random() * .25 });
  }

  // --- draw ---------------------------------------------------------------
  draw(c, t, magnetActive, shieldActive) {
    const box = this.box, gy = this.groundY, lift = this.hop;
    for (const d of this.dust) { c.save(); c.globalAlpha = (1 - d.t / d.life) * .35; c.fillStyle = '#e8d9b5'; c.beginPath(); c.arc(d.x, d.y, d.r * (1 + d.t * 2), 0, 6.28); c.fill(); c.restore(); }
    // shadow — shrinks and fades a little as the puppy lifts off
    const k = Math.min(1, lift / (box.pw * .3));
    c.save(); c.globalAlpha = .28 - k * .10; c.fillStyle = '#143c0a'; c.beginPath(); c.ellipse(box.cx, gy + 2, box.pw * (.36 - k * .08), box.pw * (.08 - k * .02), 0, 0, 6.28); c.fill(); c.restore();

    // turn pivot: width follows a V (1 → .45 → 1) and the facing swaps at the narrowest point
    const tt = this.turnT, MINW = .45, wx = tt < 1 ? 1 - (1 - MINW) * Math.sin(tt * Math.PI) : 1;
    const face = tt < .5 ? this.prevFace : this.face;
    const glow = this.inv > 0 && this.pose !== 'celebrate' ? (0.5 + 0.5 * Math.sin(this.inv * 18)) : 0;
    c.save();
    if (glow > 0 && Perf.tier >= 1) { c.shadowColor = `rgba(255,255,255,${(0.35 + 0.5 * glow).toFixed(2)})`; c.shadowBlur = box.pw * (0.06 + 0.10 * glow); }
    c.translate(box.cx, 0); c.scale(wx, 1 + (1 - wx) * .08); c.translate(-box.cx, 0);
    Rig.draw(c, box.cx, gy, this.height, face, this._rigIn || { state: 'idle', speed: 0 });
    c.restore();

    if (shieldActive) { c.save(); const R = box.pw * .62 + Math.sin(t * 4) * 3; const g = c.createRadialGradient(box.cx, box.cy, R * .55, box.cx, box.cy, R); g.addColorStop(0, '#7fe3ff00'); g.addColorStop(.85, '#7fe3ff55'); g.addColorStop(1, '#ffffffaa');
      c.fillStyle = g; c.beginPath(); c.ellipse(box.cx, box.cy, R, R * 1.08, 0, 0, 6.28); c.fill(); c.globalAlpha = .7; c.strokeStyle = '#dff6ff'; c.lineWidth = 2; c.stroke(); c.restore(); }
    if (magnetActive) { c.save(); c.globalAlpha = .16 + Math.sin(t * 8) * .05; c.fillStyle = '#7fe3ff'; c.beginPath(); c.arc(box.cx, box.cy, this.W * .20 + Math.sin(t * 5) * 5, 0, 6.28); c.fill(); c.restore(); }
  }
}
