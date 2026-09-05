/**
 * BONK! — Puppy (player): movement physics + sprite animation
 * ---------------------------------------------------------------
 * Visual states (all go through ONE crossfade system, so nothing pops).
 * Every visual is a horizontal sprite sheet cut from the AI video clips
 * (uploads/clips/*.mp4, 24 fps) — see docs/ANIMATION_BRIEF.md:
 * ALL sheets are consecutive real clip frames and play at a true 24 fps (v0.12):
 *   idle   – 20 f, breathing, ping-ponged in code            (1.6 s per breath)
 *   run    – 16 f = one real stride of the treadmill clip   (24 fps at full speed, eases to 75 %)
 *   yay    – 28 f, take-off → smile → landing, plays once   (1.17 s)
 *   bonk   – 28 f, flinch → shake off, plays once           (1.17 s)
 *   dizzy  – 26 f, front view wobble + stars, loops         (1.08 s)
 * Sheets are colour-graded + pseudo-3D relit (tools/light_puppy.py): key light top-left, AO under the belly,
 * sky rim on the back, warm ground bounce, glossy sheen.
 *
 * Smoothness rules
 *   • Any visual → any visual dissolves (alpha sums to 1 → no ghosting).
 *   • Catching while running does NOT switch to the front-view pose
 *     (that was a hard pop) — it does a small hop + squash instead.
 *   • Direction changes ease through a quick turn instead of mirroring
 *     instantly.
 *   • Bob is one arc per stride, phase-locked to the gather frame.
 * Everything stays understated: dust only on hard turns, tiny hop, no
 * exaggerated stretch.
 */
class Puppy {
  constructor() {
    this.SHEETS = {
      // body = measured body-height / cell-height, so every sheet draws the dog the same size
      idle:  { key: 'idle_sheet',  frames: 20, fps: 24, loop: true,  body: .978, pingpong: true },   // 20 real frames played 0→19→0 (1.6 s breath)
      run:   { key: 'run_sheet',   frames: 16, fps: 24, loop: true,  body: .919 },
      yay:   { key: 'yay_sheet',   frames: 28, fps: 24, loop: false, body: .841 },
      bonk:  { key: 'bonk_sheet',  frames: 28, fps: 24, loop: false, body: .850 },
      dizzy: { key: 'dizzy_sheet', frames: 26, fps: 24, loop: true,  body: .943, scale: 1.18 },   // front view incl. stars: a bit taller
    };
    this.reset();
  }

  reset() {
    Object.assign(this, {
      x: .5, vx: 0, face: 1, faceVis: 1, prevFace: 1, turnT: 1, pose: 'idle', poseT: 0, inv: 0, stun: 0,
      squash: 1, lean: 0, bob: 0, hop: 0, hopV: 0,
      anim: 'idle', frame: 0,                     // current visual + fractional frame
      prevAnim: null, prevFrame: 0, blend: 0,     // crossfade remaining (1 → 0)
      idleTimer: 0, blinkAt: 3 + Math.random() * 3,
      dust: [], turnCooldown: 0, stepFrame: -1, voiceCd: 0, slowT: 0,
    });
  }

  // --- geometry -----------------------------------------------------------
  get W() { return BG.W; } get H() { return BG.H; }
  // size is defined by body HEIGHT (stable across side/front views); width follows the run sheet's body aspect
  get height() { return Math.min(this.H * CONFIG.PUPPY.HEIGHT_FRAC, this.W * CONFIG.PUPPY.MAX_WIDTH_FRAC / 1.25); }
  get width()  { return this.height * 1.25; }
  get groundY(){ return this.H * CONFIG.PUPPY.GROUND_Y; }
  get box() {
    const pw = this.width, ph = this.height, x = this.x * this.W;
    return { x: x - pw * .34, y: this.groundY - ph * .98, w: pw * .68, h: ph * .95, cx: x, cy: this.groundY - ph * .55, pw, ph };
  }

  /** Reaction from game: 'yay' on a catch, 'bonk' / 'dizzy' on a hit. */
  setPose(p, t) {
    const MAX = this.W * CONFIG.PUPPY.MAX_SPEED, sp = Math.abs(this.vx) / MAX;
    if (p === 'yay') {
      // running: keep the gallop + a little hop (a 1.2 s hop pose would slide); slow/still: the real happy hop clip
      this.hopV = this.width * (sp > .3 ? 1.6 : 0.5);
      if (sp > .3) return;
    }
    this.pose = p; this.poseT = t;
  }

  // --- update -------------------------------------------------------------
  update(dt) {
    const C = CONFIG.PUPPY, W = this.W;
    const MAX = W * C.MAX_SPEED, ACC = W * C.ACCEL, FR = C.FRICTION;
    // edge clamp follows the body size so the nose never leaves the screen on narrow phones
    const half = this.width * .42 / W, minX = Math.max(C.MIN_X, half), maxX = Math.min(C.MAX_X, 1 - half);
    const prevVx = this.vx;

    if (this.stun > 0) { this.stun -= dt; this.vx -= this.vx * Math.min(1, FR * dt); }
    else if (Input.drag != null) {
      const k = C.DRAG_SPRING, d = 2 * Math.sqrt(k) * .95;
      const tx = Math.max(minX, Math.min(maxX, Input.drag)) * W;
      this.vx += (k * (tx - this.x * W) - d * this.vx) * dt; this.vx = Math.max(-MAX * 1.4, Math.min(MAX * 1.4, this.vx));
    } else {
      const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
      if (dir) this.vx += dir * ACC * dt; else this.vx -= this.vx * Math.min(1, FR * dt);
      this.vx = Math.max(-MAX, Math.min(MAX, this.vx));
    }
    this.x += this.vx / W * dt;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx * -.25); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx * -.25); }

    // --- facing: decide by velocity, but ease the visible flip ---------------
    const sp = Math.abs(this.vx) / MAX;
    const newFace = sp > .05 ? (this.vx > 0 ? 1 : -1) : this.face;
    this.turnCooldown -= dt;
    if (newFace !== this.face && Math.abs(prevVx) > MAX * .35 && this.turnCooldown <= 0) { this.puffDust(3); this.turnCooldown = .4; }
    if (newFace !== this.face) {
      // turn = a pivot: the body narrows to 35 % (never to a line → no blink), swaps facing at the narrowest
      // point and widens out again. A turn mid-turn just reverses the pivot from where it is.
      this.prevFace = this.face; this.turnT = this.turnT < 1 ? 1 - this.turnT : 0;
    }
    this.face = newFace; this.faceVis = this.face;
    if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / .15);   // 150 ms turn

    // --- which visual should be showing? -----------------------------------
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.pose = 'idle'; }
    // hysteresis: start running above 8 % speed, only drop to idle below 4 % — no flicker around the threshold
    const slow = sp <= (this.anim === 'run' ? .04 : .08);
    // idle latch: a direction reversal passes through zero speed for a few ms — that must NOT show idle
    // (run→idle→run in 100 ms stacked two dissolves = visible flicker). Only settle to idle after 140 ms of stillness.
    this.slowT = slow ? this.slowT + dt : 0;
    const moving = this.stun <= 0 && !(slow && (this.anim !== 'run' || this.slowT > .14));
    const want = this.pose !== 'idle' ? this.pose : (moving ? 'run' : 'idle');
    if (want !== this.anim) {
      if (this.blend > 0 && want === this.prevAnim) {
        // change of mind mid-dissolve: just reverse it (no third image, no restart)
        const a = this.anim, f = this.frame; this.anim = this.prevAnim; this.frame = this.prevFrame; this.prevAnim = a; this.prevFrame = f; this.blend = 1 - this.blend;
      } else {
        this.prevAnim = this.anim; this.prevFrame = this.frame; this.blend = 1; this.anim = want;
        this.frame = 0;
      }
    }
    // dissolve length: idle↔run 110 ms, reactions 70 ms (they're covered by flash/shake anyway)
    const blendLen = (this.anim === 'run' || this.anim === 'idle') && (this.prevAnim === 'run' || this.prevAnim === 'idle') ? .09 : .07;
    if (this.blend > 0) this.blend = Math.max(0, this.blend - dt / blendLen);

    // --- advance the current visual ---------------------------------------
    if (this.anim === 'run' || (this.prevAnim === 'run' && this.blend > 0)) {
      // 16 real frames = one stride of the treadmill clip @ 24 fps (0.67 s). Play at the clip's own cadence
      // at full speed, ease down to ~70 % when slower — never faster than the source.
      const N = this.SHEETS.run.frames, fps = this.SHEETS.run.fps * (0.75 + 0.25 * Math.min(1, sp / .7));   // 18 → 24 sprite-fps with speed (never faster than the 24 fps source)
      if (this.anim === 'run') this.frame = (this.frame + fps * dt) % N; else this.prevFrame = (this.prevFrame + fps * dt) % N;
      const f = this.anim === 'run' ? this.frame : this.prevFrame;
      // one bob per stride: lowest at the gather (frame 0), highest at full suspension (frame ~2.5)
      const ph = (f - 9) / N * Math.PI * 2;   // lowest at the gather (~9), highest mid-flight (~1)
      const target = (0.5 - 0.5 * Math.cos(ph)) * this.width * .02 * Math.min(1, sp * 1.5);   // small: the clip has real bounce baked in
      this.bob += (target - this.bob) * Math.min(1, dt * 30);
      // soft paw pats on the two contact frames (front lands ≈ 11, hind lands ≈ 4)
      const fi = Math.floor(f);
      if (fi !== this.stepFrame) { this.stepFrame = fi; if ((fi === 4 || fi === 11) && sp > .3) SFX.step(sp); }
    } else {
      this.bob += (0 - this.bob) * Math.min(1, dt * 10);
    }
    if (this.anim === 'idle') {
      const S = this.SHEETS.idle, P = 2 * (S.frames - 1); this.idleT = ((this.idleT || 0) + S.fps * dt) % P;
      this.frame = this.idleT < S.frames - 1 ? this.idleT : P - this.idleT;   // 0→19→0 ping-pong: a seamless breath
    } else if (this.anim === 'yay' || this.anim === 'bonk' || this.anim === 'dizzy') {
      const S = this.SHEETS[this.anim]; this.frame += S.fps * dt;
      if (S.loop) this.frame %= S.frames; else this.frame = Math.min(S.frames - 1, this.frame);
    }
    if (this.prevAnim && this.blend > 0 && this.prevAnim !== 'run') {   // keep the fading-out visual moving too
      const S = this.SHEETS[this.prevAnim]; if (S) { this.prevFrame += S.fps * dt; this.prevFrame = S.loop ? this.prevFrame % S.frames : Math.min(S.frames - 1, this.prevFrame); }
    }

    // --- hop (catch while running): a tiny ballistic arc on top of the bob -----
    if (this.hopV > 0 || this.hop > 0) {
      this.hop += this.hopV * dt; this.hopV -= this.width * 14 * dt;
      if (this.hop <= 0) { this.hop = 0; this.hopV = 0; }
    }

    this.lean += (Math.max(-1, Math.min(1, this.vx / MAX)) * .10 - this.lean) * Math.min(1, dt * 10);
    this.squash += (1 - this.squash) * Math.min(1, dt * 8);
    if (this.inv > 0) this.inv -= dt;
    this.voiceCd -= dt;

    for (const d of this.dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy -= 30 * dt; }
    this.dust = this.dust.filter(d => d.t < d.life);
  }

  puffDust(n) {
    const b = this.box;
    for (let i = 0; i < n; i++) this.dust.push({ x: b.cx - this.face * b.pw * (.1 + Math.random() * .25), y: this.groundY - 2, vx: -this.face * (20 + Math.random() * 40), vy: -(10 + Math.random() * 20), r: 3 + Math.random() * 4, t: 0, life: .45 + Math.random() * .25 });
  }

  // --- draw ---------------------------------------------------------------
  /** Draw one visual (sheet frame or reaction image) anchored at the feet. */
  drawVisual(c, name, frame, t) {
    const box = this.box, S = this.SHEETS[name]; if (!S) return;
    const sheet = Assets.img(S.key), fw = sheet.width / S.frames, fh = sheet.height, fi = Math.min(S.frames - 1, Math.floor(frame));
    const dh = box.ph / S.body * (S.scale || 1), dw = dh * fw / fh;   // box.ph = body height
    c.drawImage(sheet, fi * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  }

  draw(c, t, magnetActive, shieldActive) {
    const box = this.box, gy = this.groundY, lift = this.bob + this.hop;
    for (const d of this.dust) { c.save(); c.globalAlpha = (1 - d.t / d.life) * .35; c.fillStyle = '#e8d9b5'; c.beginPath(); c.arc(d.x, d.y, d.r * (1 + d.t * 2), 0, 6.28); c.fill(); c.restore(); }

    const baseAlpha = (this.inv > 0 && Math.floor(this.inv * 12) % 2 === 0) ? .55 : 1;
    // shadow — shrinks and fades a little as the puppy lifts off
    const k = Math.min(1, lift / (box.pw * .3));
    c.save(); c.globalAlpha = .28 - k * .10; c.fillStyle = '#143c0a'; c.beginPath(); c.ellipse(box.cx, gy + 2, box.pw * (.36 - k * .08), box.pw * (.08 - k * .02), 0, 0, 6.28); c.fill(); c.restore();

    const sideView = this.anim === 'run' || (this.blend > 0 && this.prevAnim === 'run');
    const frontView = this.anim === 'dizzy' && this.blend === 0;
    // turn pivot: width follows a V (1 → .45 → 1) over turnT and the facing swaps once, at the bottom of the V.
    // The puppy is solid and single on every frame (no ghost, no two heads) and never collapses to a line (no blink);
    // height rises a little as width drops so the volume feels preserved.
    const tt = this.turnT, MINW = .45;
    const wOf = u => 1 - (1 - MINW) * Math.sin(u * Math.PI);                 // 1 at u=0/1, MINW at u=.5
    const passes = (tt < 1 && !frontView) ? [[tt < .5 ? this.prevFace : this.face, 1, wOf(tt)]] : [[frontView ? 1 : this.face, 1, 1]];
    for (const [fx, a, wx] of passes) {
      c.save(); c.translate(box.cx, gy - lift);
      c.rotate(sideView ? this.lean * .6 : 0);
      c.scale(fx * wx * this.squash, (2 - this.squash) * (1 + (1 - wx) * .10));
      // cross-dissolve between animations: alphas sum to 1 → no double exposure
      const e = this.blend * this.blend * (3 - 2 * this.blend);           // smoothstep
      if (this.blend > 0 && this.prevAnim) { c.globalAlpha = baseAlpha * a * e; this.drawVisual(c, this.prevAnim, this.prevFrame, t); }
      c.globalAlpha = baseAlpha * a * (this.blend > 0 ? 1 - e : 1);
      this.drawVisual(c, this.anim, this.frame, t);
      c.restore();
    }
    c.globalAlpha = 1;

    if (shieldActive) { c.save(); const R = box.pw * .62 + Math.sin(t * 4) * 3; const g = c.createRadialGradient(box.cx, box.cy, R * .55, box.cx, box.cy, R); g.addColorStop(0, '#7fe3ff00'); g.addColorStop(.85, '#7fe3ff55'); g.addColorStop(1, '#ffffffaa');
      c.fillStyle = g; c.beginPath(); c.ellipse(box.cx, box.cy, R, R * 1.08, 0, 0, 6.28); c.fill(); c.globalAlpha = .7; c.strokeStyle = '#dff6ff'; c.lineWidth = 2; c.stroke(); c.restore(); }
    if (magnetActive) { c.save(); c.globalAlpha = .16 + Math.sin(t * 8) * .05; c.fillStyle = '#7fe3ff'; c.beginPath(); c.arc(box.cx, box.cy, this.W * .20 + Math.sin(t * 5) * 5, 0, 6.28); c.fill(); c.restore(); }
  }
}
