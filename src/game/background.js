/**
 * BONK! — Parallax background renderer (shared by menu + gameplay)
 * ---------------------------------------------------------------
 * Future themes: add a THEMES entry with its own layer keys and call
 * BG.setTheme('name'). Layer images must be listed in assets.js.
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
  };
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

    const sky = img(theme.sky), sw = W * 1.06, sh = Math.max(H * 1.06, sw * sky.height / sky.width);
    ctx.drawImage(sky, (W - sw) / 2 - px * AMP * .05, (H - sh) / 2 - py * AMP * .05, sw, sh);

    const sx = W * .78 - px * AMP * .1, sy = H * .09 - py * AMP * .1;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .42);
    g.addColorStop(0, 'rgba(255,250,210,.85)'); g.addColorStop(.12, 'rgba(255,245,190,.45)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const c of clouds) {
      c.x += (c.v / W) * dt * 4; if (c.x > 1.15) c.x = -.35;
      const im = img(c.k), w = W * c.s, h = w * im.height / im.width;
      ctx.globalAlpha = .95; ctx.drawImage(im, c.x * W - px * AMP * c.d * 3, c.y * H + Math.sin(t * .6 + c.y * 20) * 4 - py * AMP * c.d, w, h);
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

    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .10 + Math.sin(t * .8) * .03;
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

    const tr = img(theme.frame), tw = W * (theme.frameWidth || 1.10), th = tw * tr.height / tr.width;
    ctx.save(); ctx.translate(W / 2, 0); ctx.transform(1, 0, Math.sin(t * .9) * .006, 1, 0, 0);
    ctx.drawImage(tr, -tw / 2 - px * AMP * .85, (H - th) / 2 + H * (theme.frameY || 0) - py * AMP * .4, tw, th); ctx.restore();

    hooks.overlay && hooks.overlay(ctx, t, px * AMP, py * AMP);

    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i]; l.y += l.vy * dt; l.rot += l.vr * dt; l.ph += dt;
      if (l.y > H + 20) leaves[i] = newLeaf(false);
      ctx.save(); ctx.translate(l.x + Math.sin(l.ph * 1.3) * l.sw - px * AMP * .6, l.y); ctx.rotate(l.rot); ctx.fillStyle = l.col; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(0, 0, l.r, l.r * .55, 0, 0, 6.28); ctx.fill(); ctx.restore();
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,30,60,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  return {
    init() { resize(); initClouds(); window.addEventListener('resize', resize); enableTilt(); document.addEventListener('pointerdown', enableTilt, { once: true }); },
    draw, ctx,
    get W() { return W; }, get H() { return H; },
    setAmp(v) { amp = v; }, setTilt(v) { tiltEnabled = v; },
    setTheme(name) { theme = THEMES[name] || THEMES.meadow; initClouds(); },
  };
})();
