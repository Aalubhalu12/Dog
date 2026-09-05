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
      score: carry ? carry.score : 0, coins: carry ? carry.coins : 0, bones: carry ? carry.bones : 0,
      lives: carry ? carry.lives : L.hearts, mult: 1, powers: { magnet: 0, star: 0 },
      spawner: new Spawner(L), cleared: false, over: false, lastHit: null,
    };
  }

  // --- flow ----------------------------------------------------------------
  function start(levelIdx = 0, carry = null) {
    S = newState(levelIdx, carry); Goals.init(S); puppy.reset(); running = false; paused = false;
    S.startedAt = performance.now(); S.ended = false;
    Analytics.track('level_start', { id: S.level.id, idx: levelIdx, carry: !!carry, plays: (Store.levelProgress()[S.level.id] || {}).plays || 0 });
    Store.bumpStat('runs');
    Input.reset(); FX.clear(); BG.setTheme(S.level.theme);
    Ambient.setDensity(S.level.ambient); Ambient.reset();   // background life grows level by level
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

  // --- update --------------------------------------------------------------
  function update(dt) {
    if (!running || paused || S.over) return;
    S.time += dt;
    puppy.update(dt);
    for (const k in S.powers) if (S.powers[k] > 0) { S.powers[k] -= dt; if (S.powers[k] <= 0) { S.powers[k] = 0; if (k === 'star') S.mult = 1; } }
    S.spawner.update(dt, S.time, puppy, S.powers, onCatch);
    FX.update(dt);
    hooks.onHUD && hooks.onHUD(S);
    if (!S.cleared && S.score >= S.level.target) { S.cleared = true; onLevelClear(); }
  }

  function onCatch(it) {
    const d = it.def, box = puppy.box, tx = it.x, ty = box.y - 10;
    if (d.kind !== 'hazard') {
      puppy.squash = 1.18; if (d.pose) puppy.setPose(d.pose, d.poseTime);
      if (d.kind === 'score') { const v = d.score * S.mult; S.score += v; S.bones++; FX.pop(tx, ty, d.popText.replace('{v}', v), d.popClass); if (Math.random() < .5) FX.pop(tx, ty - 40, 'YAY!', 'bad'); FX.vibrate(15); }
      if (d.kind === 'coin')  { S.coins += d.coins; Store.addCoins(d.coins); FX.pop(tx, ty, d.popText, d.popClass); }
      if (d.kind === 'power') { S.powers[d.power] = d.dur; if (POWERS[d.power].multiplier) S.mult = POWERS[d.power].multiplier; FX.banner(d.banner); FX.vibrate(20); }
      FX.burst(tx, ty, d.particles, d.kind === 'coin' ? 6 : 12, d.kind === 'power' ? 1.3 : 1); SFX.play(d.sfx);
      Goals.event(S, 'catch', it);
      // puppy voice: a soft yip on bones, an occasional one on coins, a content wuff on power-ups — rate-limited so it never chatters
      if (puppy.voiceCd <= 0) {
        if (d.kind === 'power') { setTimeout(SFX.wuff, 120); puppy.voiceCd = .8; }
        else if (d.kind === 'score' || Math.random() < .25) { setTimeout(SFX.yip, 60); puppy.voiceCd = .55; }
      }
    } else {
      if (puppy.inv > 0) return;
      S.lives--; S.lastHit = d.hit; Goals.event(S, 'hit', it); puppy.inv = CONFIG.PUPPY.INVINCIBLE_TIME; puppy.vx *= .2; puppy.stun = d.stun; puppy.setPose(d.pose, d.poseTime);
      FX.banner(d.banner); FX.burst(tx, ty, d.particles, 18, 1.5); FX.flash(); FX.shake(); SFX.play(d.sfx); SFX.heart();
      FX.vibrate(d.hit === 'bonk' ? [40, 30, 60] : [60, 40, 60, 40, 80]);
      hooks.onLifeLost && hooks.onLifeLost(S);
      if (S.lives <= 0) { S.over = true; setTimeout(onGameOver, 1100); }
    }
  }
  function onLevelClear() {
    SFX.win(); FX.vibrate([30, 30, 30, 30, 80]); FX.banner('LEVEL CLEAR!');
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
    Analytics.track('level_end', { id: S.level.id, result, score: S.score, stars: S.stars || Goals.stars(S), starsN: (S.stars || []).filter(Boolean).length, coins: S.coins, bones: S.bones, duration, heartsLost: S.heartsLost || 0 });
    Store.bumpStat(result === 'win' ? 'wins' : result === 'lose' ? 'losses' : 'quits'); Store.bumpStat('bones', S.bones); Store.bumpStat('playSec', duration);
  }

  // --- draw ----------------------------------------------------------------
  function draw(c, t) { if (!S) return; puppy.draw(c, t, S.powers.magnet > 0); S.spawner.draw(c, t); FX.draw(c); }

  return {
    init(h) { hooks = h; }, start, update, draw, continueNext,
    pause() { if (S && !S.over) paused = true; },
    resume() { paused = false; if (cdResume) { const r = cdResume; cdResume = null; r(); } },
    stop() { if (S && !S.ended && !S.over) { Analytics.track('quit', { id: S.level.id, at: Math.round(S.time), score: S.score }); endRun('quit'); } running = false; paused = false; S = null; clearTimeout(cdTimer); cdTimer = null; cdResume = null; FX.clear(); hooks.onCountdown && hooks.onCountdown(null); },
    get active() { return running; }, get inProgress() { return !!S && !S.over; }, get paused() { return paused; }, get state() { return S; }, get puppy() { return puppy; },
  };
})();
