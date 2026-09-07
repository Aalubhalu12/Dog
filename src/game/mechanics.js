/**
 * BONK! — Level mechanics (Phase 3): Wind · Squirrel · Hazard waves
 * ---------------------------------------------------------------
 * Enabled per level through `modifiers` in data/levels/*.json — every mechanic is OFF unless the
 * level asks for it, so L1–5 are byte-for-byte unchanged.
 *
 *   Wind      { wind: 0..1 }   Gusts every 7–13 s: a 2.5–4 s push that drifts falling items sideways
 *                              (light items more than heavy ones). Telegraphed 0.8 s early by the leaves
 *                              streaming, the tree frame swaying and a soft "whoosh" — the player can read
 *                              it before it matters. Never moves the puppy.
 *   Squirrel  { squirrel: true } A cheeky squirrel darts out from behind the fence, grabs any BONE that
 *                              hits the ground and scampers off with it. Visual only — the miss already
 *                              broke the combo. Pure character, zero difficulty.
 *   Waves     { waves: { every, count, gap, mix } }  Every `every` s a "⚠ INCOMING!" warning, then `count`
 *                              hazards `gap` s apart sweeping across the lane with a puppy-sized gap (1.25 × his
 *                              width) carved out at a random spot ("find the gap"). Rocks; `mix` adds bombs. Regular spawning pauses during
 *                              the wave so it reads as a pattern, never a wall. Rocks ignore wind, so the gap holds.
 *
 * Public: Mechanics.start(level) · update(dt, S) · windX (px/s drift factor for Spawner) · drawBehind(c,t)
 *         drawFront(c,t) · onGround(item) · spawnPaused
 */
const Mechanics = (() => {
  let L = null, M = {}, W = 0, H = 0;
  // --- wind state ---
  let wind = { on: false, str: 0, dir: 1, t: 0, next: 0, tele: 0, cur: 0 };
  // --- squirrel state ---
  let sq = null;                                   // { x, y, dir, phase: 'in'|'grab'|'out', t, bone:{x,y} }
  let sqCd = 0;
  // --- waves state ---
  let wave = { next: 0, warn: 0, left: 0, gapT: 0, xs: [], i: 0, active: false };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const stats = { gusts: 0, grabs: 0, waves: 0 };        // per-run counters (analytics + tools/sim_levels.py)

  function start(level) {
    L = level; M = level.modifiers || {}; W = BG.W; H = BG.H; stats.gusts = stats.grabs = stats.waves = 0;
    wind = { on: false, str: M.wind || 0, dir: Math.random() < .5 ? -1 : 1, t: 0, next: M.wind ? rnd(6, 9) : Infinity, tele: 0, cur: 0 };
    sq = null; sqCd = 0;
    const wv = M.waves; wave = { next: wv ? Math.max(wv.every * .6, (level.safeTime || 0) + 6) : Infinity, warn: 0, left: 0, gapT: 0, xs: [], i: 0, active: false };
  }

  // ---------------------------------------------------------------- wind
  function updateWind(dt) {
    if (!wind.str) return;
    wind.next -= dt;
    if (!wind.on && wind.next <= 0) {                                   // gust begins with a telegraph
      wind.on = true; wind.t = rnd(2.5, 4); wind.tele = .8; wind.dir = Math.random() < .5 ? -1 : 1;
      wind.next = wind.t + rnd(7, 13); stats.gusts++; SFX.whoosh(); FX.gustHint(wind.dir);
    }
    if (wind.on) {
      wind.tele -= dt; wind.t -= dt;
      const ramp = wind.tele > 0 ? 1 - wind.tele / .8 : Math.min(1, wind.t / .6);   // in over .8 s, out over .6 s
      wind.cur += (wind.dir * wind.str * Math.max(0, ramp) - wind.cur) * Math.min(1, dt * 6);
      if (wind.t <= 0) wind.on = false;
    } else wind.cur += (0 - wind.cur) * Math.min(1, dt * 4);
  }

  // ---------------------------------------------------------------- squirrel
  /** Spawner tells us a good item reached the ground. */
  function onGround(it) {
    if (!M.squirrel || sq || sqCd > 0 || it.type !== 'bone' && it.type !== 'goldbone') return;
    const fromLeft = it.x < W * .5;
    sq = { phase: 'in', t: 0, dir: fromLeft ? 1 : -1, x: fromLeft ? -W * .06 : W * 1.06, y: H * CONFIG.PUPPY.GROUND_Y + 2,
           bone: { x: it.x, y: H * CONFIG.PUPPY.GROUND_Y - 2, type: it.type, rot: rnd(-.5, .5) }, hop: 0, gold: it.type === 'goldbone' };
    sqCd = 6; stats.grabs++;
  }
  function updateSquirrel(dt) {
    sqCd -= dt; if (!sq) return;
    sq.t += dt; const speed = W * 1.1;
    if (sq.phase === 'in') {
      const dx = sq.bone.x - sq.x; sq.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      sq.hop = Math.abs(Math.sin(sq.t * 14)) * H * .012;
      if (Math.abs(dx) < 2) { sq.phase = 'grab'; sq.t = 0; SFX.squeak(); }
    } else if (sq.phase === 'grab') {
      sq.hop = 0;
      if (sq.t > .35) { sq.phase = 'out'; sq.t = 0; sq.dir = -sq.dir; FX.pop(sq.x, sq.y - H * .07, sq.gold ? 'MINE! ✨' : 'MINE!', 'lost');
        const p = Game.puppy; if (p && Math.abs(p.box.cx - sq.x) < W * .45) { p.surprised(); FX.pop(p.box.cx, p.box.y - H * .02, 'HEY!', 'lost'); } }
    } else {
      sq.x += sq.dir * speed * 1.15 * dt; sq.hop = Math.abs(Math.sin(sq.t * 16)) * H * .014;
      if (sq.x < -W * .1 || sq.x > W * 1.1) sq = null;
    }
  }
  function drawSquirrel(c, t) {
    if (!sq) return;
    const im = Assets.img('squirrel'), h = H * .075, w = h * im.width / im.height;
    const face = sq.phase === 'out' ? sq.dir : (sq.bone.x >= sq.x ? 1 : -1);
    // the bone on the grass (until grabbed) — then in the squirrel's paws
    const b = Assets.img(sq.bone.type), bs = W * ITEMS[sq.bone.type].size * .8, bh = bs * b.height / b.width;
    c.save();
    if (sq.phase === 'in') { c.translate(sq.bone.x, sq.bone.y); c.rotate(sq.bone.rot); c.drawImage(b, -bs / 2, -bh * .8, bs, bh); }
    c.restore();
    c.save(); c.translate(sq.x, sq.y - sq.hop);
    c.globalAlpha = .25; c.fillStyle = '#143c0a'; c.beginPath(); c.ellipse(0, 2 + sq.hop * .3, w * .32, w * .07, 0, 0, 6.28); c.fill(); c.globalAlpha = 1;
    c.scale(face, 1);
    const squash = sq.phase === 'grab' ? 1 + Math.sin(sq.t / .35 * Math.PI) * .12 : 1;   // a happy little bounce as it grabs
    c.scale(1 / squash, squash);
    c.drawImage(im, -w / 2, -h, w, h);
    if (sq.phase !== 'in') { c.rotate(-.6); c.drawImage(b, w * .05, -h * .62, bs * .9, bh * .9); }
    c.restore();
  }

  // ---------------------------------------------------------------- waves
  function updateWaves(dt, S) {
    const wv = M.waves; if (!wv) return;
    if (!wave.active) {
      wave.next -= dt;
      if (wave.next <= 0) {
        // Lay the wave out ONCE: `count` hazards spread across the lane with a gap carved out that the puppy actually
        // fits through (1.25 × his width — on a phone the naive "one lane of count+1" left a 34 px slot for an 80 px dog).
        const p = Game.puppy, size = W * ITEMS.rock.size, lo = W * .05 + size / 2, hi = W - lo, hole = Math.min((hi - lo) * .5, p.width * 1.25);
        const hx = lo + hole / 2 + Math.random() * (hi - lo - hole), leftW = hx - hole / 2 - lo, tot = hi - lo - hole;
        const xs = []; for (let i = 0; i < wv.count; i++) { const u = (i + .5) / wv.count * tot; xs.push(u < leftW ? lo + u : hx + hole / 2 + (u - leftW)); }
        if (Math.random() < .5) xs.reverse();                                          // sweep direction
        wave.xs = xs.map(x => (x - lo) / (hi - lo)); wave.i = 0;
        wave.active = true; wave.warn = 1.1; wave.left = wv.count; wave.gapT = 0; stats.waves++; FX.banner('⚠ INCOMING!', 'warn'); SFX.alarm(); FX.vibrate([30, 40, 30]);
      }
      return;
    }
    if (wave.warn > 0) { wave.warn -= dt; return; }
    wave.gapT -= dt;
    if (wave.gapT <= 0 && wave.left > 0) {
      const type = wv.mix && wave.i % 2 === 1 ? 'bomb' : 'rock';
      S.spawner.spawnAt(type, wave.xs[wave.i++], S.time, 1.08);
      wave.left--; wave.gapT = wv.gap;
    }
    if (wave.left <= 0 && wave.gapT <= -.4) { wave.active = false; wave.next = wv.every; }
  }

  function update(dt, S) { W = BG.W; H = BG.H; updateWind(dt); updateSquirrel(dt); updateWaves(dt, S); }

  return {
    start, update, onGround, stats,
    drawFront: drawSquirrel,
    /** -1..1 current gust strength (signed) — Spawner drifts items by this; BG streams leaves by it. */
    get windX() { return wind.cur; },
    get windTelegraph() { return wind.on && wind.tele > 0; },
    get spawnPaused() { return wave.active; },
    get active() { return !!L && !!(M.wind || M.squirrel || M.waves); },
  };
})();
