/**
 * BONK! — Ambient life: birds in the sky, cars & villagers on the lane
 * ---------------------------------------------------------------
 * Purely decorative — nothing here affects gameplay. Everything is
 * drawn BEHIND the fence/ground layer so it never covers items or the
 * puppy. Densities are deliberately low (see AMBIENT_CFG) to keep the
 * play area calm.
 *
 * Extend: add a new "actor" type by pushing into `actors` with an
 * update/draw pair, or add more sprite variants to the arrays below.
 */
const Ambient = (() => {
  const CFG = {
    ROAD_Y: 0.735,          // road band centre (fraction of stage height) — sits behind the fence
    ROAD_H: 0.045,          // road band height (fraction of stage height)
    CAR_EVERY: [3.5, 8],    // seconds between cars (random range)
    WALKER_EVERY: [3.5, 8], // seconds between walkers
    BIRD_FLOCK_EVERY: [5, 10],
    MAX_CARS: 2, MAX_WALKERS: 3, MAX_BIRDS: 9,
    BIRD_BAND: [0.08, 0.40],// sky band for birds (crosses the peaks, drawn in front of mountains)
  };
  let W = 0, H = 0, cars = [], walkers = [], birds = [];
  let density = { birds: 1, walkers: 1, cars: 1 };   // per-level, set via setDensity()
  let tCar = 1.5, tWalker = 4, tBird = 3, primed = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const img = k => Assets.img(k);

  // ---- spawners -----------------------------------------------------------
  let lastCar = -1;
  function spawnCar(x0) {
    const dir = Math.random() < .5 ? 1 : -1;
    let ki = Math.floor(Math.random() * 3); if (ki === lastCar) ki = (ki + 1 + Math.floor(Math.random() * 2)) % 3; lastCar = ki; const k = 'car' + ki;
    const h = H * CFG.ROAD_H * 1.15, im = img(k), w = h * im.width / im.height;
    cars.push({ k, dir, w, h, x: x0 != null ? x0 * W : (dir > 0 ? -w : W + w), y: H * CFG.ROAD_Y + H * CFG.ROAD_H * .10, v: W * rnd(.10, .16) * dir, bob: Math.random() * 6 });
  }
  let lastWalker = -1;
  function spawnWalker(x0) {
    const dir = Math.random() < .5 ? 1 : -1;
    let ki = Math.floor(Math.random() * 2); if (ki === lastWalker) ki = 1 - ki; lastWalker = ki; const k = 'walker' + ki;
    // don't stack a new walker right behind one that's still near the same edge
    if (x0 == null && walkers.some(p => p.dir === dir && (dir > 0 ? p.x < W * .3 : p.x > W * .7))) return;
    const sheet = img(k), frames = 4, fw = sheet.width / frames, fh = sheet.height;
    const h = H * CFG.ROAD_H * 1.45, w = h * fw / fh;
    // walkers use the near edge of the road, so they overlap the road slightly (depth cue)
    walkers.push({ k, dir, w, h, fw, fh, frames, x: x0 != null ? x0 * W : (dir > 0 ? -w : W + w), y: H * CFG.ROAD_Y + H * CFG.ROAD_H * .38, v: W * rnd(.025, .04) * dir, f: Math.random() * frames, fps: 6 });
  }
  function spawnFlock(x0) {
    const dir = Math.random() < .5 ? 1 : -1, n = 2 + Math.floor(Math.random() * 3), y0 = H * rnd(CFG.BIRD_BAND[0], CFG.BIRD_BAND[1]);
    const sheet = img('bird_sheet'), fw = sheet.width / 3, fh = sheet.height, s = W * rnd(.045, .07);
    for (let i = 0; i < n; i++) {
      if (birds.length >= CFG.MAX_BIRDS) break;
      const edge = dir > 0 ? -s * (1 + i * 1.6) : W + s * (1 + i * 1.6);
      birds.push({ dir, w: s, h: s * fh / fw, fw, fh, x: x0 != null ? x0 * W + i * s * 1.6 * -dir : edge, y: y0 + i * s * .5 * (i % 2 ? 1 : -1),
                   v: W * rnd(.06, .09) * dir, f: Math.random() * 3, fps: rnd(7, 10), glide: 0, ph: Math.random() * 6.28 });
    }
  }

  // ---- update -------------------------------------------------------------
  function update(dt) {
    W = BG.W; H = BG.H; if (!W) return;
    if (!primed) { primed = true;
      if (density.walkers > 0) spawnWalker(rnd(.25, .45));
      if (density.cars > 0) spawnCar(rnd(.6, .8));
      if (density.birds > 0) spawnFlock(rnd(.3, .6)); }
    // interval scales inversely with density (0 disables entirely)
    const every = (rng, d) => d > 0 ? rnd(...rng) / d : Infinity;
    tCar -= dt; if (tCar <= 0) { if (cars.length < CFG.MAX_CARS) spawnCar(); tCar = every(CFG.CAR_EVERY, density.cars); }
    tWalker -= dt; if (tWalker <= 0) { if (walkers.length < CFG.MAX_WALKERS) spawnWalker(); tWalker = every(CFG.WALKER_EVERY, density.walkers); }
    tBird -= dt; if (tBird <= 0) { spawnFlock(); tBird = every(CFG.BIRD_FLOCK_EVERY, density.birds); }

    for (const c of cars) { c.x += c.v * dt; c.bob += dt * 18; }
    cars = cars.filter(c => c.x > -c.w * 2 && c.x < W + c.w * 2);
    for (const p of walkers) { p.x += p.v * dt; p.f = (p.f + dt * p.fps) % p.frames; }
    walkers = walkers.filter(p => p.x > -p.w * 2 && p.x < W + p.w * 2);
    for (const b of birds) {
      b.x += b.v * dt; b.ph += dt;
      // occasionally glide (hold wings level) for realism
      b.glide -= dt; if (b.glide <= 0 && Math.random() < dt * .25) b.glide = rnd(.6, 1.4);
      if (b.glide <= 0) b.f = (b.f + dt * b.fps) % 3;
      b.y += Math.sin(b.ph * 2.2) * 8 * dt;
    }
    birds = birds.filter(b => b.x > -b.w * 3 && b.x < W + b.w * 3);
  }

  // ---- draw (two passes: sky pass and road pass) --------------------------
  function drawSky(c, t, ax) {
    const sheet = img('bird_sheet');
    for (const b of birds) {
      const fi = b.glide > 0 ? 1 : Math.floor(b.f);
      c.save(); c.translate(b.x - ax * .12, b.y); c.scale(b.dir, 1); c.globalAlpha = .92;
      c.drawImage(sheet, fi * b.fw, 0, b.fw, b.fh, -b.w / 2, -b.h / 2, b.w, b.h); c.restore();
    }
  }
  function drawRoad(c, t, ax) {
    const road = img('road'), rw = W * 1.25, rh = H * CFG.ROAD_H * 1.6, ry = H * CFG.ROAD_Y - rh / 2;
    c.drawImage(road, (W - rw) / 2 - ax * .40, ry, rw, rh);
    // far-side walkers (moving left) draw before cars, near-side after — simple depth sort by y
    const all = [...cars.map(o => ({ o, kind: 'car' })), ...walkers.map(o => ({ o, kind: 'walker' }))].sort((a, b) => a.o.y - b.o.y);
    for (const { o, kind } of all) {
      c.save(); c.translate(o.x - ax * .40, o.y);
      // ground shadow
      c.fillStyle = 'rgba(20,40,10,.25)'; c.beginPath(); c.ellipse(0, 0, o.w * .42, o.h * .07, 0, 0, 6.28); c.fill();
      if (kind === 'car') { c.scale(o.dir, 1); c.drawImage(img(o.k), -o.w / 2, -o.h + Math.sin(o.bob) * 1, o.w, o.h); }
      else { c.scale(o.dir, 1); const fi = Math.floor(o.f); c.drawImage(img(o.k), fi * o.fw, 0, o.fw, o.fh, -o.w / 2, -o.h, o.w, o.h); }
      c.restore();
    }
  }
  function reset() { cars = []; walkers = []; birds = []; primed = false;
    tCar = density.cars > 0 ? 1.5 / density.cars : Infinity; tWalker = density.walkers > 0 ? 4 / density.walkers : Infinity; tBird = density.birds > 0 ? 3 / density.birds : Infinity; }
  /** Set per-level life density {birds, walkers, cars} (0..1). Call before reset(). */
  function setDensity(d) { density = { birds: 1, walkers: 1, cars: 1, ...(d || {}) }; }
  return { update, drawSky, drawRoad, reset, setDensity, CFG };
})();
