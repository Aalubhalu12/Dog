/**
 * BONK! — Sound effects (procedural Web Audio, no files needed)
 * ---------------------------------------------------------------
 * To use recorded audio later: create assets/audio/, add a `sample(name)`
 * player here and keep the same public keys so game code doesn't change.
 */
const SFX = (() => {
  let ctx = null, master = null, enabled = true;
  const ensure = () => {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (f0, f1, dur, type = 'sine', vol = 1, delay = 0) => {
    if (!enabled) return; const c = ensure(); const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, vol = 0.6, lp = 1200) => {
    if (!enabled) return; const c = ensure(); const t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  };
  // ---- soft puppy voice ---------------------------------------------------
  // A tiny "vocal tract": pulse-ish source → two bandpass formants → gentle envelope.
  // Kept quiet (vol ≤ .5 of master) and rounded so it never becomes a yappy chihuahua.
  const voice = ({ f0 = 520, f1 = 380, dur = .18, formants = [900, 1900], vol = .35, delay = 0, breath = .35 } = {}) => {
    if (!enabled) return; const c = ensure(); const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const pre = c.createGain(); pre.gain.value = 2.2; o.connect(pre);
    const out = c.createGain(); out.gain.setValueAtTime(.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + .025); out.gain.setValueAtTime(vol, t + dur * .55); out.gain.exponentialRampToValueAtTime(.0001, t + dur);
    formants.forEach((fq, i) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = i ? 6 : 4; const g = c.createGain(); g.gain.value = i ? .6 : 1; pre.connect(bp); bp.connect(g); g.connect(out); });
    // a little breath under it softens the buzz
    if (breath > 0) { const n = c.createBufferSource(); const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1); n.buffer = buf; const lp = c.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 1500; lp.Q.value = .7; const g = c.createGain(); g.gain.value = breath * .25; n.connect(lp); lp.connect(g); g.connect(out); n.start(t); }
    // final low-pass keeps it soft & cute
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; out.connect(lp); lp.connect(master);
    o.start(t); o.stop(t + dur + .03);
  };
  const vary = (v, pct) => v * (1 + (Math.random() * 2 - 1) * pct);
  let lastStep = 0;

  const lib = {
    // — puppy voice —
    yip:     () => voice({ f0: vary(640, .08), f1: vary(880, .06), dur: .14, formants: [1000, 2100], vol: .55 }),                       // happy catch
    wuff:    () => { voice({ f0: vary(300, .08), f1: 200, dur: .16, formants: [600, 1400], vol: .6, breath: .5 }); },                 // content "wuff" (power-up / level start)
    whine:   () => voice({ f0: 700, f1: 520, dur: .42, formants: [1100, 2300], vol: .42, breath: .6 }),                                // bonk: soft whimper
    whimper: () => { voice({ f0: 620, f1: 700, dur: .22, formants: [1000, 2200], vol: .4, breath: .6 }); voice({ f0: 720, f1: 480, dur: .38, formants: [1000, 2200], vol: .4, breath: .6, delay: .26 }); }, // dizzy
    step:    (sp = 1) => { const now = performance.now(); if (now - lastStep < 80) return; lastStep = now; noise(.04, .09 + .07 * sp, 700); }, // paw pat on grass
    // — items —
    bone:  () => { tone(660, 990, .12, 'triangle', .8); tone(990, 1320, .16, 'triangle', .6, .09); },
    coin:  () => { tone(1568, 1568, .07, 'square', .35); tone(2093, 2093, .18, 'square', .35, .07); },
    magnet:() => { tone(300, 1200, .35, 'sawtooth', .35); tone(600, 1800, .35, 'sine', .3, .05); },
    star:  () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .14, 'triangle', .6, i * .07)); },
    bonk:  () => { noise(.18, .9, 700); tone(180, 60, .28, 'square', .8); setTimeout(lib.whine, 140); },
    bomb:  () => { noise(.45, 1, 400); tone(120, 30, .5, 'sawtooth', .9); tone(900, 200, .3, 'sine', .4, .05); setTimeout(lib.dizzy, 250); setTimeout(lib.whimper, 420); },
    dizzy: () => { for (let i = 0; i < 6; i++) tone(500 + (i % 2) * 200, 500 + ((i + 1) % 2) * 200, .12, 'sine', .3, i * .11); },
    heart: () => tone(200, 120, .3, 'sine', .7),
    goldbone: () => { [784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, .16, 'triangle', .55, i * .06)); tone(2093, 2637, .3, 'sine', .3, .25); },
    shield:   () => { tone(400, 900, .18, 'sine', .5); tone(900, 1400, .25, 'triangle', .4, .12); },
    shieldPop:() => { noise(.12, .5, 2500); tone(1200, 300, .22, 'triangle', .6); },
    combo:    (n = 1) => { const f = 660 * Math.pow(1.122, Math.min(n, 8)); tone(f, f * 1.25, .09, 'square', .22); },   // rises with the chain
    phew:     () => { noise(.16, .18, 900); tone(520, 700, .16, 'sine', .3, .04); },
    star1: (i = 0) => { const f = [784, 988, 1319][i] || 1319; tone(f, f, .22, 'triangle', .55); tone(f * 2, f * 2, .18, 'sine', .25, .02); },
    stage:  () => { tone(523, 523, .12, 'triangle', .35); tone(659, 659, .12, 'triangle', .35, .12); tone(784, 784, .22, 'triangle', .4, .24); },   // act change chime
    // — mechanics —
    whoosh: () => { noise(.9, .22, 900); noise(.6, .12, 2200); },                                                               // wind gust telegraph
    squeak: () => { tone(1500, 2100, .08, 'square', .18); tone(1900, 1400, .10, 'square', .16, .1); },                          // squirrel
    alarm:  () => { tone(660, 660, .11, 'square', .3); tone(880, 880, .14, 'square', .3, .16); },                                // hazard wave warning
    click: () => tone(800, 600, .06, 'square', .3),
    count: () => tone(880, 880, .1, 'square', .4),
    go:    () => { tone(880, 1320, .25, 'square', .5); setTimeout(lib.wuff, 180); },
    over:  () => [440, 415, 392, 330].forEach((f, i) => tone(f, f, .28, 'triangle', .6, i * .22)),
    win:   () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, .16, 'triangle', .6, i * .11)),
  };
  return {
    ...lib,
    play: k => lib[k] && lib[k](),
    unlock: () => { try { ensure(); } catch (e) {} },
    setEnabled: v => { enabled = v; },
  };
})();
