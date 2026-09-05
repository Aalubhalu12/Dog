/**
 * BONK! — FTUE (first-time user experience)
 * ---------------------------------------------------------------
 * Four tiny, event-driven hints in the first ~20 s of level 1, shown ONCE per save
 * (Save.ftue.done). No text walls, nothing blocks play; each step auto-clears when
 * the player does the thing (or after a timeout).
 *
 *   1. move   – "Drag or hold ◀ ▶ to run"  (until the puppy has moved a bit)
 *   2. catch  – "Catch the bones!"          (until first bone caught)
 *   3. dodge  – "Dodge the rocks!"          (shown when the first hazard spawns; until it's passed)
 *   4. combo  – "Keep catching for a COMBO" (after ~4 catches; until ×2 reached or 6 s)
 *
 * Re-enable for testing: Store.setFtueDone(false) or Settings → Reset progress.
 * Flag: ftue_enabled.
 */
const FTUE = (() => {
  const $ = s => document.querySelector(s);
  const el = { box: $('#ftue'), text: $('#ftueText') };
  const STEPS = {
    move:  { text: 'Drag or hold ◀ ▶ to run!', hand: true,  done: () => Math.abs(Game.puppy.x - .5) > .12 || Input.any, timeout: 8 },
    catch: { text: 'Catch the bones! 🦴',       hand: false, done: S => S.bones > 0, timeout: 10 },
    dodge: { text: 'Dodge the rocks! 🪨',       hand: false, done: S => hazardsPassed(S) > 0 || (S.heartsLost || 0) > 0, timeout: 7 },
    combo: { text: 'Keep catching for a COMBO 🐾', hand: false, done: S => S.combo.mult >= 2 || S.combo.n === 0 && sinceStep > 2, timeout: 6 },
  };
  let active = false, step = null, sinceStep = 0, queue = [], gap = 0, seenHazard = false;

  const hazardsPassed = S => S.hazardsPassed || 0;

  function start(levelIdx) {
    active = false; step = null; queue = []; hide();
    if (!Flags.get('ftue_enabled') || levelIdx !== 0 || Store.ftueDone()) return;
    active = true; queue = ['move', 'catch']; gap = 0; seenHazard = false;
    Analytics.track('ftue_start');
  }
  function show(name) {
    step = name; sinceStep = 0; const st = STEPS[name];
    el.text.textContent = st.text; el.box.classList.toggle('nohand', !st.hand); el.box.classList.add('on');
    Analytics.track('ftue_step', { step: name });
  }
  function hide() { el.box.classList.remove('on'); }

  function update(dt) {
    if (!active) return;
    const S = Game.state; if (!S || !Game.active || Game.paused) return;
    // count hazards that fell past the puppy (for the dodge step) and detect the first hazard spawn
    if (!S._ftuePrev) S._ftuePrev = new Set();
    let hz = false; for (const it of S.spawner.items) { if (it.def.kind === 'hazard') { hz = true; if (it.y > Game.puppy.box.y + Game.puppy.box.h && !S._ftuePrev.has(it)) { S._ftuePrev.add(it); S.hazardsPassed = (S.hazardsPassed || 0) + 1; } } }
    if (hz && !seenHazard) { seenHazard = true; if (!queue.includes('dodge') && step !== 'dodge') queue.unshift('dodge'); }
    if (S.bones >= 3 && !S._ftueCombo && Flags.get('combo_enabled')) { S._ftueCombo = true; queue.push('combo'); }

    if (step) {
      sinceStep += dt; const st = STEPS[step];
      if (st.done(S) || sinceStep > st.timeout) { hide(); step = null; gap = .8; }
    } else {
      gap -= dt;
      if (gap <= 0 && queue.length) show(queue.shift());
      else if (!queue.length && S.time > 20) finish();
    }
  }
  function finish() { if (!active) return; active = false; hide(); Store.setFtueDone(true); Analytics.track('ftue_done'); }
  function stop() { hide(); if (active && Game.state && Game.state.time > 12) finish(); active = false; step = null; }

  return { start, update, stop, get active() { return active; } };
})();
