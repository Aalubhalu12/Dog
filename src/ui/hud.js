/**
 * BONK! — In-game HUD binding (score, hearts, powers, progress, countdown)
 */
const HUD = (() => {
  const $ = s => document.querySelector(s);
  const el = { score: $('#hScore'), best: $('#hBest'), coins: $('#hCoins'), hearts: $('#hearts'), level: $('#hLevel'),
               power: $('#powerbar'), progress: $('#levelProgress'), hint: $('#hint'), cd: $('#countdown'), cdNum: $('#countNum'),
               chip: $('#goalChip'), goalText: $('#goalText'), goalBar: $('#goalBar'), ctlL: $('#ctlL'), ctlR: $('#ctlR'), stage: $('#stage'),
               combo: $('#combo'), comboPaws: $('#comboPaws'), comboMult: $('#comboMult') };
  let comboKey = '';
  let zones = null, zoneW = 0;
  let goalState = '';
  let lastPower = '';

  function hearts(S, animLost) {
    el.hearts.innerHTML = '';
    for (let i = 0; i < S.level.hearts; i++) {
      const im = document.createElement('img'); im.src = Assets.url(i < S.lives ? 'heart' : 'heart_empty');
      if (animLost && i === S.lives) im.classList.add('lost'); el.hearts.appendChild(im);
    }
  }
  function update(S) {
    el.score.textContent = S.score.toLocaleString(); el.coins.textContent = S.coins.toLocaleString();
    el.best.textContent = Math.max(S.score, Store.best()).toLocaleString();
    el.level.textContent = `LEVEL ${S.level.id}`;
    el.progress.style.width = (S.cleared ? 100 : Math.min(100, S.score / S.level.target * 100)) + '%';
    let html = '';
    for (const k in S.powers) if (S.powers[k] > 0) { const P = POWERS[k];
      html += k === 'shield' ? `<div class="power shield"><img src="${Assets.url('shield')}">🛡</div>`
                             : `<div class="power"><i style="width:${S.powers[k] / ITEMS[P.icon].dur * 100}%"></i><img src="${Assets.url(P.icon)}">${P.label}${S.powers[k].toFixed(0)}s</div>`; }
    if (html !== lastPower) { el.power.innerHTML = html; lastPower = html; }
    if (Input.any || (S && S.time > 4)) el.hint.style.opacity = 0;   // hide on first input or after 4 s
    // arrow buttons go translucent while the puppy runs underneath them (canvas is below the DOM)
    if (!zones || zoneW !== el.stage.clientWidth) { zoneW = el.stage.clientWidth; const sr = el.stage.getBoundingClientRect();
      zones = [el.ctlL, el.ctlR].map(b => { const r = b.getBoundingClientRect(); return [(r.left - sr.left) / sr.width, (r.right - sr.left) / sr.width]; }); }
    const bx = Game.puppy.box, x0 = (bx.cx - bx.pw * .5) / BG.W, x1 = (bx.cx + bx.pw * .5) / BG.W;
    el.ctlL.classList.toggle('ghost', x0 < zones[0][1] && x1 > zones[0][0]);
    el.ctlR.classList.toggle('ghost', x0 < zones[1][1] && x1 > zones[1][0]);
    // goal chip: live progress, then done/failed state; fades out 3 s after resolving
    if (S.goal) {
      const done = !S.goal.def.survive && S.goal.def.done(S, S.goal.st, S.goal.cfg), failed = !done && Goals.failed(S);
      el.goalBar.style.width = (Goals.progress(S) * 100) + '%';
      const st = done ? 'done' : failed ? 'failed' : 'live';
      if (st !== goalState) { goalState = st; el.chip.classList.toggle('done', done); el.chip.classList.toggle('failed', failed); el.chip.classList.remove('hide');
        el.chip.querySelector('img').src = Assets.url(done ? 'star_gold' : 'star_grey');
        if (done) { el.goalText.textContent = 'Goal complete!'; FX.pop(BG.W / 2, BG.H * .30, '⭐ GOAL!', 'bad'); }
        if (done || failed) setTimeout(() => el.chip.classList.add('hide'), 3000); }
    }
  }
  /** Combo paw-chain: STEP paws fill up, then the multiplier steps; hidden while the chain is empty. */
  function combo(S, ev) {
    const C = S.combo, K = CONFIG.COMBO, on = C.n > 0;
    el.combo.classList.toggle('on', on); el.combo.classList.toggle('max', C.mult >= K.MAX);
    const filled = C.n === 0 ? 0 : C.mult >= K.MAX ? K.STEP : (C.n % K.STEP === 0 ? K.STEP : C.n % K.STEP);
    const key = `${C.mult}:${filled}`;
    if (key !== comboKey) { comboKey = key;
      let h = ''; for (let i = 0; i < K.STEP; i++) h += `<i class="${i < filled ? 'on' : ''}"></i>`; el.comboPaws.innerHTML = h;
      el.comboMult.textContent = '×' + C.mult; }
    if (ev === 'add' && (C.n % K.STEP === 0 || C.mult >= K.MAX)) { el.combo.classList.remove('pulse'); void el.combo.offsetWidth; el.combo.classList.add('pulse'); }
  }
  function reset(S) {
    comboKey = ''; el.combo.classList.remove('on', 'max', 'pulse'); combo(S);
    hearts(S); el.hint.style.opacity = (S && S.levelIdx > 0) || !Store.ftueDone() ? 0 : 1; lastPower = null; goalState = ''; zones = null;
    el.chip.classList.remove('done', 'failed', 'hide'); el.chip.style.display = S.goal ? '' : 'none';
    if (S.goal) { el.goalText.textContent = Goals.label(S.level); el.chip.querySelector('img').src = Assets.url('star_grey'); el.goalBar.style.width = '0%'; }
    update(S);
  }
  function countdown(txt) {
    if (txt == null) { el.cd.classList.remove('on'); return; }
    el.cd.classList.add('on'); el.cdNum.textContent = txt; el.cdNum.style.animation = 'none'; void el.cdNum.offsetWidth; el.cdNum.style.animation = '';
  }
  return { update, hearts, reset, countdown, combo };
})();
