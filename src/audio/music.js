/**
 * BONK! — Background music (procedural Web Audio, no files)
 * ---------------------------------------------------------------
 * A tiny look-ahead sequencer plays a soft, cheerful 8-bar loop: warm pad chords, a kalimba-style
 * lead in the major pentatonic (no wrong notes → never grating), a round bass and a whisper of shaker.
 * The lead alternates two phrases (A A B A) and thins out every other pass so the loop breathes.
 *
 *   Music.play(theme, time)   – (re)start for a location; key/tempo change on the next bar
 *   Music.setTime(time)       – morning / evening / night / rain: night & rain are darker + sparser
 *   Music.duck(on)            – pause menu: drop to 35 %
 *   Music.stop(fade)          – fade out (level clear / game over) – the jingles play alone
 *   Music.setVolume(0..1) / setEnabled(bool)
 *
 * Shares SFX's AudioContext (SFX.context()), so the browser's one user-gesture unlock covers both.
 */
const Music = (() => {
  const BPM = 92, LOOP_BARS = 8, LOOKAHEAD = .12, TICK = 40;
  // Chord roots + qualities over C (semitones from the key root); the lead scale is C-major pentatonic.
  const CHORDS = [[0, 'M7'], [9, 'm7'], [5, 'M7'], [7, '6'], [0, 'M7'], [4, 'm7'], [5, 'M7'], [7, 'sus']];
  const QUAL = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '6': [0, 4, 7, 9], sus: [0, 5, 7, 10] };
  const PENTA = [0, 2, 4, 7, 9];                                       // scale degrees → semitones (index 5+ = next octave)
  // Lead phrases: per bar a list of [eighth-note step 0..7, pentatonic index, length in eighths]. Composed, not random.
  const PHRASE_A = [
    [[0, 5, 1], [2, 6, 1], [3, 7, 2], [6, 5, 2]],
    [[0, 4, 1], [2, 3, 1], [4, 4, 2], [6, 2, 2]],
    [[0, 3, 1], [1, 4, 1], [2, 5, 2], [4, 4, 1], [6, 3, 2]],
    [[0, 2, 2], [3, 3, 1], [5, 1, 3]],
    [[0, 5, 1], [2, 6, 1], [3, 8, 2], [6, 7, 2]],
    [[0, 7, 1], [2, 5, 1], [4, 6, 2], [6, 4, 2]],
    [[0, 5, 1], [1, 4, 1], [2, 3, 2], [4, 4, 1], [6, 5, 2]],
    [[0, 6, 3], [4, 5, 4]],
  ];
  const PHRASE_B = [
    [[0, 7, 2], [3, 6, 1], [4, 5, 3]],
    [[1, 4, 1], [2, 5, 1], [3, 4, 1], [4, 3, 3]],
    [[0, 5, 1], [2, 5, 1], [3, 6, 1], [4, 7, 3]],
    [[0, 6, 1], [1, 5, 1], [2, 4, 4]],
    [[0, 3, 1], [2, 4, 1], [3, 5, 1], [4, 6, 3]],
    [[0, 5, 2], [3, 7, 1], [4, 6, 2], [6, 5, 2]],
    [[0, 4, 1], [1, 5, 1], [2, 6, 1], [3, 5, 1], [4, 4, 3]],
    [[0, 3, 2], [3, 5, 5]],
  ];
  // Per-location colour: key (semitones from C), tempo, shaker, swing, lead brightness.
  const THEMES = {
    home:   { key: 0,  bpm: 88,  shaker: 0,   swing: .5,  bright: 2200, gain: .75 },
    meadow: { key: 0,  bpm: 92,  shaker: 0,   swing: .5,  bright: 2400, gain: 1 },
    park:   { key: 2,  bpm: 100, shaker: .5,  swing: .5,  bright: 2800, gain: 1 },
    forest: { key: -5, bpm: 84,  shaker: 0,   swing: .5,  bright: 1900, gain: 1 },
    beach:  { key: 4,  bpm: 96,  shaker: .6,  swing: .58, bright: 2600, gain: 1 },
  };
  const TIMES = { morning: { density: 1, cut: 1, pad: 1 }, evening: { density: .85, cut: .8, pad: 1.15 }, night: { density: .6, cut: .55, pad: 1.3 }, rain: { density: .7, cut: .65, pad: 1.2 } };

  let ctx = null, out = null, padBus = null, padLP = null, leadLP = null;
  let timer = null, nextBar = 0, bar = 0, loopN = 0, want = null, cur = null, timeName = 'morning';
  let enabled = true, volume = 1, ducked = false, playing = false;
  const BASE = .3;
  const target = () => enabled && playing ? BASE * volume * (cur ? cur.gain : 1) * (ducked ? .35 : 1) : 0;
  const applyGain = (dur = .4) => { if (!out) return; const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(target(), t + dur); };

  function ensure() {
    if (ctx) return ctx;
    ctx = SFX.context(); out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    padLP = ctx.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 900; padLP.Q.value = .5; padLP.connect(out);
    padBus = ctx.createGain(); padBus.gain.value = 1; padBus.connect(padLP);
    leadLP = ctx.createBiquadFilter(); leadLP.type = 'lowpass'; leadLP.frequency.value = 2400; leadLP.connect(out);
    return ctx;
  }
  const hz = semi => 261.63 * Math.pow(2, semi / 12);                  // C4 = 0
  const pentaSemi = i => PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);

  // ---- instruments ---------------------------------------------------------------
  function pluck(semi, t, vel, len) {                                   // kalimba: sine body + soft inharmonic ping, quick decay
    const f = hz(semi), body = ctx.createOscillator(), ping = ctx.createOscillator(), g = ctx.createGain(), pg = ctx.createGain();
    body.type = 'sine'; body.frequency.value = f; ping.type = 'sine'; ping.frequency.value = f * 3.94;
    const dur = Math.min(1.1, .35 + len * .12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    pg.gain.setValueAtTime(vel * .18, t); pg.gain.exponentialRampToValueAtTime(.0005, t + .09);
    body.connect(g); ping.connect(pg); g.connect(leadLP); pg.connect(leadLP);
    body.start(t); ping.start(t); body.stop(t + dur + .05); ping.stop(t + .12);
  }
  function pad(semis, t, dur, vel) {                                    // two detuned triangles per note, slow swell
    for (const s of semis) for (const det of [-5, 5]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(s - 12); o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .6); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .7);   // long release overlaps the next chord: no gap on the bar line
      o.connect(g); g.connect(padBus); o.start(t); o.stop(t + dur + .75);
    }
  }
  function bass(semi, t, dur, vel) {                                    // round sine bass with a touch of second harmonic
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(semi - 24); o2.type = 'triangle'; o2.frequency.value = hz(semi - 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .04); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    g2.gain.value = .12; o2.connect(g2); g2.connect(g); o.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
  }
  function shaker(t, vel) {                                             // filtered noise whisper
    const n = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * .06, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; const g = ctx.createGain(); g.gain.value = vel;
    n.buffer = buf; n.connect(hp); hp.connect(g); g.connect(out); n.start(t);
  }

  // ---- sequencer -----------------------------------------------------------------
  function scheduleBar(t0) {
    if (want && want !== cur) { cur = want; applyGain(.6); }             // key / tempo changes land on a bar line
    const T = cur, tm = TIMES[timeName] || TIMES.morning, beat = 60 / T.bpm, barLen = beat * 4, eighth = beat / 2;
    const i = bar % LOOP_BARS, [root, q] = CHORDS[i], chord = QUAL[q].map(s => root + s + T.key);
    padLP.frequency.setTargetAtTime(700 * tm.cut + 300, t0, .5); leadLP.frequency.setTargetAtTime(T.bright * tm.cut, t0, .5);
    pad(chord, t0, barLen, .018 * tm.pad);
    bass(root + T.key, t0, beat * 1.6, .16); if (i % 2 === 1) bass(root + T.key, t0 + beat * 2.5, beat * 1.2, .11);
    if (T.shaker > 0) for (let b = 0; b < 4; b++) { shaker(t0 + b * beat + eighth, .02 * T.shaker); if (b === 1 || b === 3) shaker(t0 + b * beat, .012 * T.shaker); }
    const phrase = (loopN % 4 === 2 ? PHRASE_B : PHRASE_A)[i], thin = loopN % 2 === 1;
    phrase.forEach(([step, idx, len], k) => {
      if (thin && k % 3 === 1) return;                                  // every other pass drops a third of the notes: room to breathe
      if (tm.density < 1 && ((i * 7 + k * 3) % 10) / 10 >= tm.density) return;
      const sw = step % 2 ? (T.swing - .5) * eighth * 2 : 0, t = t0 + step * eighth + sw + (Math.random() - .5) * .012;
      pluck(pentaSemi(idx) + T.key, t, .24 * (.85 + Math.random() * .3), len);
    });
    nextBar = t0 + barLen; bar++; if (bar % LOOP_BARS === 0) loopN++;
  }
  function tick() { while (nextBar < ctx.currentTime + LOOKAHEAD) scheduleBar(Math.max(nextBar, ctx.currentTime + .02)); }
  let armed = false;
  const live = () => ctx.state === 'running' || !(ctx instanceof AudioContext);   // an OfflineAudioContext (tools) reports 'suspended' while rendering
  function run() {
    if (timer || !enabled) return; ensure();
    if (!live()) {                                                     // before the first tap the context is suspended: start on resume (or on the first pointer)
      ctx.resume().then(() => { if (playing && !timer) run(); }).catch(() => {});
      if (!armed) { armed = true; document.addEventListener('pointerdown', () => { armed = false; if (playing) run(); }, { once: true }); }
      return;
    }
    nextBar = ctx.currentTime + .05; bar = 0; loopN = 0; cur = want; timer = setInterval(tick, TICK); applyGain(1.2);
  }
  function halt() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) { halt(); out.gain.setValueAtTime(0, ctx.currentTime); } else if (playing) run(); });

  return {
    play(theme = 'home', time = 'morning') { want = THEMES[theme] || THEMES.meadow; timeName = time; playing = true; ducked = false; if (timer) applyGain(.6); else run(); },
    setTime(time) { timeName = time; },
    duck(on) { ducked = !!on; applyGain(.3); },
    stop(fade = 1) { if (!playing) return; playing = false; applyGain(fade); setTimeout(() => { if (!playing) halt(); }, fade * 1000 + 100); },
    setVolume(v) { volume = Math.max(0, Math.min(1, +v || 0)); applyGain(.1); },
    setEnabled(v) { enabled = !!v; if (!enabled) { applyGain(.2); setTimeout(() => { if (!enabled) halt(); }, 300); } else if (playing) run(); },
    get volume() { return volume; },
  };
})();
