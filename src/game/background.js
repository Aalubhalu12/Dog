/**
 * BONK! — Parallax background renderer (shared by menu + gameplay)
 * ---------------------------------------------------------------
 * Themes: a THEMES entry lists the parallax layers (back → front); BG.setTheme('name').
 * Layer images must be listed in assets.js. The sky, clouds, tree frame, road and the
 * fence/grass apron are shared by every location so the play lane never changes.
 *
 * Time of day / weather: BG.setTime(name) snaps/fades to a grade; BG.setTimeBlend(a, b, k)
 * holds the sky BETWEEN two grades (k = 0..1) — the game feeds it the act's progress, so the
 * light drifts continuously (morning slowly turns to evening during act 1, evening to night
 * during act 2) like a live time-lapse. Grades: morning · evening · night · rain.
 */
const BG = (() => {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const THEMES = {
    meadow: {
      sky: 'sky', clouds: ['cloud0', 'cloud1', 'cloud2'], frame: 'trees',
      layers: [
        { key: 'mountains', depth: 0.15, bottom: 0.60 },
        { key: 'village',   depth: 0.30, bottom: 0.80, water: 'water_mask' },
        { key: 'meadow',    depth: 0.42, bottom: 0.95, width: 1.30, mid: true },
        { key: 'foreground',depth: 0.55, bottom: 1.01, front: true, width: 1.55 },   // taller grass apron: fence sits behind the puppy, buttons on the grass below him
      ],
      frameWidth: 1.55,  // tree frame pushed outward → more open play area
      frameY: -0.02,
    },
    park: {              // city park: skyline far, bandstand / fountain / ice-cream cart mid, same lane
      sky: 'sky', clouds: ['cloud0', 'cloud1', 'cloud2'], frame: 'trees', birdsAfter: 'park_far',
      layers: [
        { key: 'park_far',  depth: 0.15, bottom: 0.56 },
        { key: 'park_mid',  depth: 0.30, bottom: 0.79, width: 1.05 },
        { key: 'foreground',depth: 0.55, bottom: 1.01, front: true, width: 1.55 },
      ],
      frameWidth: 1.55, frameY: -0.02,
    },
    beach: {             // seaside: sea + lighthouse far, umbrella / sandcastle / lifeguard hut mid
      sky: 'sky', clouds: ['cloud0', 'cloud1', 'cloud2'], frame: 'trees', birdsAfter: 'beach_far',
      layers: [
        { key: 'beach_far',  depth: 0.15, bottom: 0.50, width: 1.10 },
        { key: 'beach_mid',  depth: 0.30, bottom: 0.80, width: 1.02 },
        { key: 'foreground', depth: 0.55, bottom: 1.01, front: true, width: 1.55 },
      ],
      frameWidth: 1.55, frameY: -0.02,
    },
    forest: {            // deep forest clearing: tall pines far, campfire / log / stream mid
      sky: 'sky', clouds: ['cloud0', 'cloud1', 'cloud2'], frame: 'trees', birdsAfter: 'forest_far',
      layers: [
        { key: 'forest_far', depth: 0.15, bottom: 0.66, width: 1.08 },
        { key: 'forest_mid', depth: 0.30, bottom: 0.80, width: 1.02 },
        { key: 'foreground', depth: 0.55, bottom: 1.01, front: true, width: 1.55 },
      ],
      frameWidth: 1.55, frameY: -0.02,
    },
  };
  /** Time-of-day / weather grades. tint = multiply colour+alpha, glow = soft-light colour+alpha, sun = [x,y] fraction, sunA = sun alpha. */
  const TIMES = {
    morning: { tint: [255, 255, 255, 0],   glow: [255, 240, 200, .08], sun: [.78, .09], sunA: 1,  sky: null,           stars: 0, rain: 0, leaves: 1 },
    evening: { tint: [255, 170, 110, .30], glow: [255, 140, 60, .22],  sun: [.22, .26], sunA: 1,  sky: [255, 120, 60],  stars: 0, rain: 0, leaves: 1 },
    night:   { tint: [40, 60, 130, .58],   glow: [120, 160, 255, .10], sun: [.80, .10], sunA: .9, sky: [10, 20, 60],    stars: 1, rain: 0, leaves: .4, moon: true },
    rain:    { tint: [120, 140, 165, .42], glow: [180, 200, 220, .06], sun: [.78, .09], sunA: 0,  sky: [90, 105, 125],  stars: 0, rain: 1, leaves: .5 },
  };
  let timeCur = { ...TIMES.morning }, timeTarget = TIMES.morning, timeName = 'morning', rain = [], stars = null;
  /** Linear blend of two grades (arrays lerp, flags come from the dominant side). */
  function blendTimes(A, B, k) {
    const L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
    return { tint: L(A.tint, B.tint), glow: L(A.glow, B.glow), sun: L(A.sun, B.sun), sunA: A.sunA + (B.sunA - A.sunA) * k,
      stars: A.stars + (B.stars - A.stars) * k, rain: A.rain + (B.rain - A.rain) * k, leaves: A.leaves + (B.leaves - A.leaves) * k,
      sky: k < .5 ? A.sky : B.sky, skyMix: (A.sky ? 1 - k : 0) + (B.sky ? k : 0), moon: k < .5 ? A.moon : B.moon, moonA: (A.moon ? 1 - k : 0) + (B.moon ? k : 0) };
  }
  let theme = THEMES.meadow;
  let W = 0, H = 0, t0 = performance.now();
  let targetX = 0, targetY = 0, px = 0, py = 0, tiltEnabled = true, amp = 1, ambient = true;
  const clouds = [], leaves = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingQuality = 'high';
    leaves.length = 0; const n = Math.round(Math.max(10, W * H / 45000));
    while (leaves.length < n) leaves.push(newLeaf(true));
  }
  function newDrop() { return { x: Math.random() * (W + 80) - 40, y: -Math.random() * H, l: 10 + Math.random() * 12, v: H * (1.1 + Math.random() * .5) }; }
  function newLeaf(anywhere) {
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : -20, r: 3 + Math.random() * 5, rot: Math.random() * 6.28,
      vr: (Math.random() - .5) * 3, vy: 25 + Math.random() * 35, ph: Math.random() * 6.28, sw: 15 + Math.random() * 25,
      col: Math.random() < .6 ? ['#7ccb3f', '#5eb531', '#a4de55'][Math.floor(Math.random() * 3)] : ['#fff', '#ffd6e7', '#ffe27a'][Math.floor(Math.random() * 3)] };
  }
  function initClouds() {
    clouds.length = 0; const c = theme.clouds;
    const defs = [{ k: c[0], y: .06, s: .55, v: 9, d: .05 }, { k: c[1], y: .14, s: .40, v: 6, d: .03 }, { k: c[2], y: .24, s: .62, v: 11, d: .07 },
                  { k: c[0], y: .33, s: .35, v: 5, d: .02 }, { k: c[1], y: .42, s: .48, v: 8, d: .04 }];
    defs.forEach((d, i) => clouds.push({ ...d, x: (i / defs.length) * 1.3 - .15 }));
  }

  // --- parallax input ----------------------------------------------------
  window.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    targetY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  });
  function onTilt(e) {
    if (!tiltEnabled || e.gamma == null) return;
    targetX = Math.max(-30, Math.min(30, e.gamma)) / 30;
    targetY = Math.max(-20, Math.min(20, (e.beta || 45) - 45)) / 20;
  }
  function enableTilt() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')
      DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') window.addEventListener('deviceorientation', onTilt); }).catch(() => {});
    else window.addEventListener('deviceorientation', onTilt);
  }

  const img = k => Assets.img(k);
  const mix = (a, b, k) => a + (b - a) * k;
  /** Ease the current grade toward the target (called every frame). */
  function updateTime(dt) {
    const k = Math.min(1, dt / 1.2 * 1.8); const T = timeTarget, C = timeCur;
    for (const key of ['tint', 'glow', 'sun']) C[key] = C[key].map((v, i) => mix(v, T[key][i], k));
    C.sunA = mix(C.sunA, T.sunA, k); C.stars = mix(C.stars, T.stars, k); C.rain = mix(C.rain, T.rain, k); C.leaves = mix(C.leaves, T.leaves, k);
    C.skyA = mix(C.skyA || 0, T.skyMix != null ? T.skyMix : (T.sky ? 1 : 0), k); if (T.sky) C.sky = T.sky; C.moon = T.moon; C.moonA = mix(C.moonA || 0, T.moonA != null ? T.moonA : (T.moon ? 1 : 0), k);
    if (C.rain > .02) { const want = Math.round(W * H / 6000 * C.rain); while (rain.length < want) rain.push(newDrop()); if (rain.length > want) rain.length = want; } else rain.length = 0;
  }

  // --- animated water -----------------------------------------------------
  // The village painting already contains the lake; we lay a masked, slowly
  // moving ripple/glint pattern over it so the surface reads as living water.
  // Everything is soft and low-contrast (see WATER) — it should be felt, not noticed.
  const WATER = { ALPHA: .55, SPEED: .05, GLINTS: 16 };
  const wc = document.createElement('canvas'), wctx = wc.getContext('2d');
  let glints = null;
  function drawWater(L, dx, dy, t) {
    const mask = img(L.water); if (!mask || BG._noWater) return;
    const im = img(L.key), over = (L.width || 1) * (1.04 + .12 * L.depth), w = W * over, h = w * im.height / im.width;
    const x0 = (W - w) / 2 + dx, y0 = H * L.bottom - h + dy;
    // lake bbox inside the mask image (measured once) → keep the offscreen small
    if (!mask._bb) { const c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height; const g = c.getContext('2d'); g.drawImage(mask, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let minx = c.width, miny = c.height, maxx = 0, maxy = 0;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4] > 20) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      mask._bb = { x: minx / c.width, y: miny / c.height, w: (maxx - minx) / c.width, h: (maxy - miny) / c.height }; }
    const bb = mask._bb, bx = x0 + bb.x * w, by = y0 + bb.y * h, bw = bb.w * w, bh = bb.h * h;
    if (bw < 4 || bh < 4) return;
    const S = Math.min(2, DPR), cw = Math.ceil(bw * S), chh = Math.ceil(bh * S);
    if (wc.width !== cw || wc.height !== chh) { wc.width = cw; wc.height = chh; }
    if (!glints) glints = Array.from({ length: WATER.GLINTS }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, sp: .6 + Math.random() * .8, s: .6 + Math.random() * .8 }));
    const g = wctx; g.setTransform(S, 0, 0, S, 0, 0); g.clearRect(0, 0, bw, bh);

    // a) soft ripple bands drifting sideways; the two passes at different speeds interfere gently
    g.globalCompositeOperation = 'source-over';
    const band = Math.max(3, bh * .055);
    for (let pass = 0; pass < 2; pass++) {
      const sp = WATER.SPEED * (pass ? 1.6 : 1) * bw, ph = t * sp * (pass ? -1 : 1), amp = band * (pass ? .55 : .8);
      g.strokeStyle = pass ? 'rgba(255,255,255,.85)' : 'rgba(225,248,255,.9)'; g.lineWidth = pass ? 1.4 : 2.2; g.lineCap = 'round';
      for (let y = band * .5; y < bh; y += band * (pass ? 1.35 : 1)) {
        const persp = .55 + .45 * (y / bh);                     // farther rows shorter/finer
        g.globalAlpha = (.30 + .30 * Math.sin(y * .7 + t * .9 + pass)) * persp;
        g.beginPath();
        const seg = band * 2.6 * persp, gap = band * 1.7;
        for (let x = ((ph + y * 3.1) % (seg + gap)) - (seg + gap); x < bw; x += seg + gap) {
          const yy = y + Math.sin((x + ph) * .02 + y) * amp * .35;
          g.moveTo(x, yy); g.quadraticCurveTo(x + seg / 2, yy - amp * .5, x + seg, yy);
        }
        g.stroke();
      }
    }
    // b) sparse sun glints that breathe in and out
    g.globalCompositeOperation = 'lighter';
    for (const q of glints) {
      const a = Math.max(0, Math.sin(t * q.sp + q.ph)); if (a < .05) continue;
      const gx = ((q.x + t * WATER.SPEED * .5 * q.sp) % 1) * bw, gy = q.y * bh, r = band * q.s * (.6 + .4 * a);
      const rg = g.createRadialGradient(gx, gy, 0, gx, gy, r); rg.addColorStop(0, `rgba(255,255,240,${.8 * a})`); rg.addColorStop(1, 'rgba(255,255,240,0)');
      g.globalAlpha = 1; g.fillStyle = rg; g.beginPath(); g.ellipse(gx, gy, r * 1.6, r * .5, 0, 0, 6.28); g.fill();
    }
    // c) clip everything to the lake shape
    g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1;
    g.drawImage(mask, -bb.x * w, -bb.y * h, w, h);
    g.globalCompositeOperation = 'source-over';

    ctx.save(); ctx.globalAlpha = WATER.ALPHA; ctx.drawImage(wc, bx, by, bw, bh); ctx.restore();
  }

  function drawCover(im, dx, dy, depth, bottomFrac, widthMul) {
    const over = (widthMul || 1) * (1.04 + .12 * depth), w = W * over, h = w * im.height / im.width;
    ctx.drawImage(im, (W - w) / 2 + dx, H * bottomFrac - h + dy, w, h);
  }

  /**
   * Draw one frame.  hooks:
   *   behindFront(ctx,t)  – drawn before the front ground layer
   *   overlay(ctx,t)      – drawn after the tree frame (puppy + items live here)
   */
  function draw(now, dt, hooks = {}) {
    const t = (now - t0) / 1000;
    if (ambient) Ambient.update(dt);
    px += ((targetX + Math.sin(t * .35) * .18) - px) * Math.min(1, dt * 3.5);
    py += ((targetY + Math.cos(t * .27) * .10) - py) * Math.min(1, dt * 3.5);
    const AMP = W * .045 * amp;

    updateTime(dt); const TC = timeCur;
    const sky = img(theme.sky), sw = W * 1.06, sh = Math.max(H * 1.06, sw * sky.height / sky.width);
    ctx.drawImage(sky, (W - sw) / 2 - px * AMP * .05, (H - sh) / 2 - py * AMP * .05, sw, sh);
    if (TC.skyA > .01 && TC.sky) {                                            // sky grade: sunset orange / night blue / rain grey, strongest at the top
      const sg = ctx.createLinearGradient(0, 0, 0, H * .8); sg.addColorStop(0, `rgba(${TC.sky.join(',')},${(.85 * TC.skyA).toFixed(3)})`); sg.addColorStop(1, `rgba(${TC.sky.join(',')},${(.35 * TC.skyA).toFixed(3)})`);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    }
    if (TC.stars > .01) {                                                     // star field (night) — twinkles slowly
      if (!stars) stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * .5, r: .6 + Math.random() * 1.2, ph: Math.random() * 6.28 }));
      ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = TC.stars * (.35 + .65 * Math.abs(Math.sin(t * .7 + s.ph))); ctx.beginPath(); ctx.arc(s.x * W - px * AMP * .04, s.y * H, s.r, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1;
    }
    const sx = W * TC.sun[0] - px * AMP * .1, sy = H * TC.sun[1] - py * AMP * .1;
    if (TC.sunA > .01) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .42);
      if (TC.moonA > .5) { g.addColorStop(0, 'rgba(235,240,255,.95)'); g.addColorStop(.05, 'rgba(235,240,255,.9)'); g.addColorStop(.07, 'rgba(200,215,255,.25)'); g.addColorStop(1, 'rgba(180,200,255,0)'); }
      else { g.addColorStop(0, 'rgba(255,250,210,.85)'); g.addColorStop(.12, 'rgba(255,245,190,.45)'); g.addColorStop(1, 'rgba(255,240,180,0)'); }
      ctx.globalAlpha = TC.sunA; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }

    for (const c of clouds) {
      c.x += (c.v / W) * dt * 4; if (c.x > 1.15) c.x = -.35;
      const im = img(c.k), w = W * c.s, h = w * im.height / im.width;
      ctx.globalAlpha = .95 - TC.tint[3] * .5; ctx.drawImage(im, c.x * W - px * AMP * c.d * 3, c.y * H + Math.sin(t * .6 + c.y * 20) * 4 - py * AMP * c.d, w, h);
    }
    ctx.globalAlpha = 1;
    // Back layers. Birds are drawn right AFTER the mountains so they fly in front
    // of the peaks (not hidden behind them) but still behind the village/meadow.
    let birdsDrawn = false;
    for (const L of theme.layers) if (!L.front && !L.mid) {
      drawCover(img(L.key), -px * AMP * L.depth, -py * AMP * L.depth * .5, L.depth, L.bottom, L.width);
      if (L.water) drawWater(L, -px * AMP * L.depth, -py * AMP * L.depth * .5, t);
      if (ambient && !birdsDrawn && L.key === (theme.birdsAfter || 'mountains')) { Ambient.drawSky(ctx, t, px * AMP); birdsDrawn = true; }
    }
    if (ambient && !birdsDrawn) Ambient.drawSky(ctx, t, px * AMP);

    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = (.10 + Math.sin(t * .8) * .03) * TC.sunA * (TC.moon ? .4 : 1);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-.55 - i * .14 + Math.sin(t * .2 + i) * .03);
      const rg = ctx.createLinearGradient(0, 0, 0, H * 1.2); rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(W * .16, H * 1.2); ctx.lineTo(-W * .16, H * 1.2); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();

    for (const L of theme.layers) if (L.mid) drawCover(img(L.key), -px * AMP * L.depth, -py * AMP * L.depth * .5, L.depth, L.bottom, L.width);
    if (ambient) Ambient.drawRoad(ctx, t, px * AMP);
    hooks.behindFront && hooks.behindFront(ctx, t, px * AMP, py * AMP);
    for (const L of theme.layers) if (L.front) drawCover(img(L.key), -px * AMP * L.depth, -py * AMP * L.depth * .5, L.depth, L.bottom, L.width);

    const windX = typeof Mechanics !== 'undefined' ? Mechanics.windX : 0;
    const tr = img(theme.frame), tw = W * (theme.frameWidth || 1.10), th = tw * tr.height / tr.width;
    ctx.save(); ctx.translate(W / 2, 0); ctx.transform(1, 0, Math.sin(t * .9) * .006 + windX * .025 + (windX ? Math.sin(t * 7) * .004 * Math.abs(windX) : 0), 1, 0, 0);   // trees lean + flutter in a gust
    ctx.drawImage(tr, -tw / 2 - px * AMP * .85, (H - th) / 2 + H * (theme.frameY || 0) - py * AMP * .4, tw, th); ctx.restore();

    hooks.overlay && hooks.overlay(ctx, t, px * AMP, py * AMP);

    const leafN = Math.round(leaves.length * TC.leaves);
    for (let i = 0; i < leafN; i++) {
      const l = leaves[i]; l.y += l.vy * (1 + Math.abs(windX) * .4) * dt; l.rot += (l.vr + windX * 4) * dt; l.ph += dt;
      if (windX) { l.x += windX * W * .55 * dt; if (l.x < -30) l.x += W + 60; else if (l.x > W + 30) l.x -= W + 60; }
      if (l.y > H + 20) leaves[i] = newLeaf(false);
      ctx.save(); ctx.translate(l.x + Math.sin(l.ph * 1.3) * l.sw - px * AMP * .6, l.y); ctx.rotate(l.rot); ctx.fillStyle = l.col; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(0, 0, l.r, l.r * .55, 0, 0, 6.28); ctx.fill(); ctx.restore();
    }
    // --- time-of-day grade: multiply tint (shadows go blue at night / grey in rain) + soft warm glow (evening) ---
    if (TC.tint[3] > .01) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${TC.tint[0] | 0},${TC.tint[1] | 0},${TC.tint[2] | 0},${TC.tint[3].toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (TC.glow[3] > .01) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(${TC.glow[0] | 0},${TC.glow[1] | 0},${TC.glow[2] | 0},${TC.glow[3].toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (TC.moonA > .02) {                                                     // a little lantern light around the puppy so he stays readable at night
      const lx = hooks.lightX != null ? hooks.lightX : W / 2, ly = H * CONFIG.PUPPY.GROUND_Y - H * .06;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * .38); lg.addColorStop(0, `rgba(255,225,160,${(.22 * TC.moonA).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (rain.length) {                                                        // rain streaks, slight slant with the wind
      ctx.save(); ctx.strokeStyle = 'rgba(210,230,255,.55)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, TC.rain);
      const slant = W * .06 + windX * W * .25; ctx.beginPath();
      for (const d of rain) { d.y += d.v * dt; d.x += slant * dt * (d.v / H); if (d.y > H + 20) { d.y = -20 - Math.random() * 40; d.x = Math.random() * (W + 80) - 40; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - slant * .03, d.y - d.l); }
      ctx.stroke(); ctx.restore();
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(10,30,60,${(.35 + TC.tint[3] * .25).toFixed(3)})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  return {
    init() { resize(); initClouds(); window.addEventListener('resize', resize); enableTilt(); document.addEventListener('pointerdown', enableTilt, { once: true }); },
    draw, ctx,
    get W() { return W; }, get H() { return H; },
    setAmp(v) { amp = v; }, setTilt(v) { tiltEnabled = v; },
    setTheme(name) { theme = THEMES[name] || THEMES.meadow; initClouds(); },
    /** Cross-fade to a time-of-day / weather grade ('morning' | 'evening' | 'night' | 'rain'); snap = no fade (level start). */
    /** Hold the light between grade `a` and grade `b` at k (0..1). Eased by the same smoother as setTime. */
    setTimeBlend(a, b, k) { const A = TIMES[a] || TIMES.morning, B = TIMES[b] || A; timeTarget = blendTimes(A, B, Math.max(0, Math.min(1, k))); timeName = k < .5 ? a : b; },
    setTime(name, snap = false) { timeTarget = TIMES[name] || TIMES.morning; timeName = name in TIMES ? name : 'morning'; if (snap) { timeCur = { ...timeTarget, tint: [...timeTarget.tint], glow: [...timeTarget.glow], sun: [...timeTarget.sun], skyA: timeTarget.sky ? 1 : 0, sky: timeTarget.sky }; rain.length = 0; } },
    get time() { return timeName; }, THEMES, TIMES,
  };
})();
