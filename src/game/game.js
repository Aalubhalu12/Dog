/**
 * BONK! — Gameplay controller (one level run)
 * ---------------------------------------------------------------
 * Owns: score / lives / powers, the Puppy, the Spawner, and the
 * catch/hit rules. Emits events to the scene layer via `hooks`:
 *   onHUD(state) · onLifeLost(state) · onLevelClear(state) · onGameOver(state)
 */
const Game = (() => {
  let S = null, running = false, paused = false, hooks = {}, cdTimer = null, cdResume = null;
  const puppy = new Puppy();

  function newState(levelIdx, carry) {
    const L = getLevel(levelIdx);
    return {
      level: L, levelIdx, time: 0,
      score: carry ? carry.score : 0, base: carry ? carry.score : 0,   // score = run total (best/leaderboard); base = what was carried in → level progress = score - base
      coins: carry ? carry.coins : 0, bones: carry ? carry.bones : 0,
      lives: carry ? carry.lives : L.hearts, mult: 1, powers: { magnet: 0, star: 0, shield: 0 },
      combo: { n: 0, mult: 1, best: 0, bestMult: 1 }, nearMisses: 0, shieldSaves: 0, nearCd: 0,
      spawner: new Spawner(L), cleared: false, over: false, lastHit: null,
      stage: 0,                                                   // act index into L.stages (morning → evening → night)
    };
  }

  // --- flow ----------------------------------------------------------------
  function start(levelIdx = 0, carry = null) {
    S = newState(levelIdx, carry); Goals.init(S); puppy.reset(); running = false; paused = false;
    S.startedAt = performance.now(); S.ended = false;
    Analytics.track('level_start', { id: S.level.id, idx: levelIdx, carry: !!carry, plays: (Store.levelProgress()[S.level.id] || {}).plays || 0 });
    Store.bumpStat('runs');
    Input.reset(); FX.clear(); BG.setTheme(S.level.theme); BG.setTime(S.level.stages[0].time, true);
    Ambient.setDensity(stageAmbient(S)); Ambient.reset();   // background life grows level by level (and thins at night / in rain)
    Mechanics.start(S.level);                                // wind / squirrel / waves — only if the level asks
    hooks.onStart && hooks.onStart(S);
    countdown(() => { running = true; });
  }
  function countdown(done) {
    const seq = CONFIG.COUNTDOWN; let i = 0;
    const step = () => {
      if (paused) { cdResume = step; return; }                       // frozen while paused
      if (i >= seq.length) { cdTimer = null; hooks.onCountdown && hooks.onCountdown(null); done(); return; }
      hooks.onCountdown && hooks.onCountdown(seq[i]); i === seq.length - 1 ? SFX.go() : SFX.count();
      i++; cdTimer = setTimeout(step, i === seq.length ? 600 : 750);
    };
    step();
  }
  function continueNext() {
    const carry = { score: S.score, coins: S.coins, bones: S.bones, lives: Math.min(S.level.hearts, S.lives + 1) };
    start(Math.min(S.levelIdx + 1, LEVELS.length - 1), carry);
  }

  // --- acts: the level's 3 stages (time of day + pace) --------------------
  const STAGE_UI = { morning: ['☀️', 'MORNING'], evening: ['🌇', 'EVENING'], night: ['🌙', 'NIGHT'], rain: ['🌧️', 'RAIN'] };
  const stageAmbient = S => { const a = S.level.ambient, f = { night: .35, rain: .5 }[S.level.stages[S.stage].time] || 1; return { birds: a.birds * (f < 1 ? f * .5 : 1), walkers: a.walkers * f, cars: a.cars * Math.max(f, .6) }; };
  function advanceStage(i) {
    S.stage = i; const st = S.level.stages[i], [icon, name] = STAGE_UI[st.time] || ['', st.time.toUpperCase()];
    S.spawner.setStage(i, S.time); Ambient.setDensity(stageAmbient(S));
    FX.banner(`${S.level.id}.${i + 1}  ${icon} ${name}`, 'stage'); setTimeout(() => FX.pop(puppy.box.cx, puppy.box.y - 24, i === S.level.stages.length - 1 ? 'FULL SPEED!' : 'FASTER!', 'bad'), 700);
    SFX.stage(); FX.vibrate([15, 30, 15]); puppy.squash = 1.12; puppy.puffDust(3);
    Analytics.track('stage', { id: S.level.id, stage: i, time: st.time, at: Math.round(S.time) });
    hooks.onHUD && hooks.onHUD(S);
  }
  const stageIcon = S => (STAGE_UI[S.level.stages[S.stage].time] || [''])[0];
  const stageLabel = S => `${S.level.id}.${S.stage + 1}`;

  // --- update --------------------------------------------------------------
  function update(dt) {
    if (!running || paused || S.over) return;
    S.time += dt;
    puppy.update(dt);
    for (const k in S.powers) if (S.powers[k] > 0 && k !== 'shield') { S.powers[k] -= dt; if (S.powers[k] <= 0) { S.powers[k] = 0; if (k === 'star') S.mult = 1; } }
    if (S.nearCd > 0) S.nearCd -= dt;
    Mechanics.update(dt, S);
    // eyes: watch the nearest good thing that is still above him (or the hazard about to land on him)
    { let best = null, bd = 1e9; const b = puppy.box; for (const it of S.spawner.items) { if (it.dead || it.y > b.cy) continue; const w = it.def.kind === 'hazard' ? 1.6 : 1, d = (Math.abs(it.x - b.cx) + (b.cy - it.y) * .6) * w; if (d < bd) { bd = d; best = it; } } puppy.lookAt(best ? best.x : null, best ? best.y : null); }
    S.spawner.update(dt, S.time, puppy, S.powers, onCatch, onMiss, onNear, onDodge);
    FX.update(dt);
    const ls = S.score - S.base;                                   // this level's own score — carried score never shortens a level
    if (!S.cleared && ls >= S.level.target) { S.cleared = true; onLevelClear(); }
    else if (!S.cleared) {
      const n = S.level.stages.length, u = ls / S.level.target * n, want = Math.min(n - 1, Math.floor(u)); if (want > S.stage) advanceStage(want);
      // live weather: during act i the light drifts from act i's grade toward act i+1's (starts drifting after 35 % of the act)
      const st = S.level.stages, i = S.stage, k = Math.max(0, (u - i - .35) / .65);
      BG.setTimeBlend(st[i].time, st[Math.min(n - 1, i + 1)].time, i < n - 1 ? k : 0);
    }
  }

  // --- combo ------------------------------------------------------------------
  const comboOn = () => Flags.get('combo_enabled');
  function comboAdd() {
    if (!comboOn()) return;
    const C = S.combo, K = CONFIG.COMBO; C.n++;
    const mult = Math.min(K.MAX, 1 + Math.floor(C.n / K.STEP));
    if (mult > C.mult) { C.mult = mult; FX.banner(`COMBO ×${mult}!`); SFX.combo(mult + 3); FX.vibrate(25); Analytics.track('combo_step', { id: S.level.id, mult, n: C.n }); }
    else if (C.n > 1) SFX.combo(C.n % K.STEP);
    if (C.n > C.best) C.best = C.n; if (C.mult > C.bestMult) C.bestMult = C.mult;
    hooks.onCombo && hooks.onCombo(S, 'add');
  }
  function comboBreak(reason) {
    if (!comboOn()) return; const C = S.combo; if (C.n === 0) return;
    if (C.mult > 1) { FX.pop(puppy.box.cx, puppy.box.y - 30, 'COMBO LOST', 'lost'); Analytics.track('combo_break', { id: S.level.id, n: C.n, mult: C.mult, reason }); }
    C.n = 0; C.mult = 1; hooks.onCombo && hooks.onCombo(S, 'break');
  }
  function onMiss(it) { if (it.def.kind === 'score' && CONFIG.COMBO.MISS_RESETS) comboBreak('miss'); }
  function onDodge(it) { if (!S.over) { S.dodged = (S.dodged || 0) + 1; Goals.event(S, 'dodge', it); } }
  function onNear(it) {
    if (S.nearCd > 0 || S.over) return; S.nearCd = CONFIG.NEAR_MISS.COOLDOWN; S.nearMisses++;
    const box = puppy.box; FX.pop(box.cx, box.y - box.h * .9, 'PHEW!', 'phew'); SFX.phew(); FX.vibrate(10);
    if (CONFIG.NEAR_MISS.COINS) { S.coins += CONFIG.NEAR_MISS.COINS; Store.addCoins(CONFIG.NEAR_MISS.COINS); FX.pop(it.x, box.y - 10, '+1', 'coin'); }
    Goals.event(S, 'near', it);
  }

  function onCatch(it) {
    const d = it.def, box = puppy.box, tx = it.x, ty = box.y - 10;
    if (d.kind !== 'hazard') {
      puppy.squash = 1.18; if (d.pose) puppy.setPose(d.pose, d.poseTime);
      comboAdd(); const cm = S.combo.mult;
      if (d.kind === 'score') { const v = d.score * S.mult * cm; S.score += v; S.bones++; FX.pop(tx, ty, d.popText.replace('{v}', v), d.popClass); if (d.rare) { FX.burst(tx, ty, d.particles, 24, 1.6); FX.vibrate([20, 30, 20]); } else if (Math.random() < .5 && cm === 1) FX.pop(tx, ty - 40, 'YAY!', 'bad'); FX.vibrate(15); }
      if (d.kind === 'coin')  { S.coins += d.coins; Store.addCoins(d.coins); FX.pop(tx, ty, d.popText, d.popClass); }
      if (d.kind === 'power') { S.powers[d.power] = d.dur || 1; if (POWERS[d.power].multiplier) S.mult = POWERS[d.power].multiplier; FX.banner(d.banner); FX.vibrate(20); }
      FX.burst(tx, ty, d.particles, d.kind === 'coin' ? 6 : 12, d.kind === 'power' ? 1.3 : 1); SFX.play(d.sfx);
      Goals.event(S, 'catch', it);
      // puppy voice: a soft yip on bones, an occasional one on coins, a content wuff on power-ups — rate-limited so it never chatters
      if (puppy.voiceCd <= 0) {
        if (d.kind === 'power') { setTimeout(SFX.wuff, 120); puppy.voiceCd = .8; }
        else if (d.kind === 'score' || Math.random() < .25) { setTimeout(SFX.yip, 60); puppy.voiceCd = .55; }
      }
    } else {
      if (puppy.inv > 0) return;
      if (S.powers.shield > 0) {   // the biscuit takes the hit: no heart lost, no stun, combo survives
        S.powers.shield = 0; S.shieldSaves++; puppy.inv = .8; puppy.squash = 1.25;
        FX.banner('SHIELDED!'); FX.burst(tx, ty, ['#7fe3ff', '#fff', '#ffd23a'], 22, 1.6); SFX.shieldPop(); FX.vibrate([20, 20, 20]);
        Goals.event(S, 'shielded', it); Analytics.track('shield_save', { id: S.level.id }); return;
      }
      comboBreak('hit');
      S.lives--; S.lastHit = d.hit; Goals.event(S, 'hit', it); puppy.inv = CONFIG.PUPPY.INVINCIBLE_TIME; puppy.vx *= .2; puppy.stun = d.stun; puppy.setPose(d.pose, d.poseTime);
      FX.banner(d.banner); FX.burst(tx, ty, d.particles, 18, 1.5); FX.flash(); FX.shake(); SFX.play(d.sfx); SFX.heart();
      FX.vibrate(d.hit === 'bonk' ? [40, 30, 60] : [60, 40, 60, 40, 80]);
      hooks.onLifeLost && hooks.onLifeLost(S);
      if (S.lives <= 0) { S.over = true; setTimeout(onGameOver, 1100); }
    }
  }
  function onLevelClear() {
    SFX.win(); FX.vibrate([30, 30, 30, 30, 80]); FX.banner('LEVEL CLEAR!'); puppy.celebrate();
    FX.burst(puppy.box.cx, puppy.box.y, ['#ffd23a', '#ff7ab6', '#7fe3ff', '#8ef08a', '#fff'], 30, 1.8);
    S.stars = Goals.stars(S); S.newStars = Store.recordLevel(S.level.id, S.score, true, S.stars);
    Store.setBest(S.score); endRun('win');
    setTimeout(() => { paused = true; hooks.onLevelClear && hooks.onLevelClear(S); }, 1300);
  }
  function onGameOver() {
    running = false; SFX.over();
    S.isNewBest = S.score > 0 && Store.setBest(S.score); S.stars = Goals.stars(S); Store.recordLevel(S.level.id, S.score, false, S.stars); endRun('lose');
    hooks.onGameOver && hooks.onGameOver(S);
  }

  /** One level_end per run (win / lose / quit) + lifetime stats. */
  function endRun(result) {
    if (!S || S.ended) return; S.ended = true;
    const duration = Math.round((performance.now() - S.startedAt) / 1000);
    Analytics.track('level_end', { id: S.level.id, result, score: S.score, stars: S.stars || Goals.stars(S), starsN: (S.stars || []).filter(Boolean).length, coins: S.coins, bones: S.bones, duration, heartsLost: S.heartsLost || 0, comboBest: S.combo.best, comboMult: S.combo.bestMult, nearMisses: S.nearMisses, shieldSaves: S.shieldSaves, q: Perf.tier });
    Store.bumpStat(result === 'win' ? 'wins' : result === 'lose' ? 'losses' : 'quits'); Store.bumpStat('bones', S.bones); Store.bumpStat('playSec', duration);
  }

  // --- draw ----------------------------------------------------------------
  function draw(c, t) { if (!S) return; puppy.draw(c, t, S.powers.magnet > 0, S.powers.shield > 0); Mechanics.drawFront(c, t); S.spawner.draw(c, t); FX.draw(c); }

  return {
    init(h) { hooks = h; }, start, update, draw, continueNext,
    pause() { if (S && !S.over) paused = true; },
    resume() { paused = false; if (cdResume) { const r = cdResume; cdResume = null; r(); } },
    stop() { if (S && !S.ended && !S.over) { Analytics.track('quit', { id: S.level.id, at: Math.round(S.time), score: S.score }); endRun('quit'); } running = false; paused = false; S = null; clearTimeout(cdTimer); cdTimer = null; cdResume = null; FX.clear(); hooks.onCountdown && hooks.onCountdown(null); },
    get active() { return running; }, get inProgress() { return !!S && !S.over; }, get paused() { return paused; }, get state() { return S; }, get puppy() { return puppy; }, stageIcon, stageLabel,
    /** 0..1 progress of the current level (per-level score / target). */
    progress(S) { return S.cleared ? 1 : Math.min(1, (S.score - S.base) / S.level.target); },
  };
})();
