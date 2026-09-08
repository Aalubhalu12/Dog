/**
 * BONK! — In-game HUD binding (score, hearts, powers, progress, countdown)
 */
const HUD = (() => {
  const el = { score: $('#hScore'), best: $('#hBest'), coins: $('#hCoins'), hearts: $('#hearts'), level: $('#hLevel'),
               power: $('#powerbar'), progress: $('#levelProgress'), hint: $('#hint'), cd: $('#countdown'), cdNum: $('#countNum'),
               chip: $('#goalChip'), goalText: $('#goalText'), goalBar: $('#goalBar'), stage: $('#stage'),
               combo: $('#combo'), comboPaws: $('#comboPaws'), comboMult: $('#comboMult') };
  let comboKey = '';
  let goalState = '';
  let lastPower = '', lastScore = -1, lastCoins = -1, lastProg = '', lastLevel = '';

  function hearts(S, animLost) {
    el.hearts.innerHTML = '';
    for (let i = 0; i < S.level.hearts; i++) {
      const im = document.createElement('img'); im.src = Assets.url(i < S.lives ? 'heart' : 'heart_empty');
      if (animLost && i === S.lives) im.classList.add('lost'); el.hearts.appendChild(im);
    }
  }
  function update(S) {
    // DOM writes only on change — this runs every rendered frame and layout/style work is what stutters low-end phones
    if (S.score !== lastScore) { lastScore = S.score; el.score.textContent = S.score.toLocaleString(); el.best.textContent = Math.max(S.score, Store.best()).toLocaleString(); restartAnimation(el.score, 'bump'); }
    if (S.coins !== lastCoins) { lastCoins = S.coins; el.coins.textContent = S.coins.toLocaleString(); }
    const lv = `LV ${Game.stageLabel(S)} ${Game.stageIcon(S)}`; if (lv !== lastLevel) { lastLevel = lv; el.level.textContent = lv; }
    const pw = (Game.progress(S) * 100).toFixed(1) + '%'; if (pw !== lastProg) { lastProg = pw; el.progress.style.width = pw; }
    let html = '';
    for (const k in S.powers) if (S.powers[k] > 0) { const P = POWERS[k];
      html += k === 'shield' ? `<div class="power shield"><img src="${Assets.url('shield')}">🛡</div>`
                             : `<div class="power"><i style="width:${S.powers[k] / ITEMS[P.icon].dur * 100}%"></i><img src="${Assets.url(P.icon)}">${P.label}${S.powers[k].toFixed(0)}s</div>`; }
    if (html !== lastPower) { el.power.innerHTML = html; lastPower = html; }
    if (Input.any || (S && S.time > 4)) el.hint.style.opacity = 0;   // hide on first input or after 4 s
    // goal chip: live progress, then done/failed state; fades out 3 s after resolving
    if (S.goal) {
      const done = !S.goal.def.survive && S.goal.def.done(S, S.goal.st, S.goal.cfg), failed = !done && Goals.failed(S);
      el.goalBar.style.width = (Goals.progress(S) * 100) + '%';
      const st = done ? 'done' : failed ? 'failed' : 'live';
      if (st !== goalState) { goalState = st; el.chip.classList.toggle('done', done); el.chip.classList.toggle('failed', failed); el.chip.classList.remove('hide');
        el.chip.querySelector('img').src = Assets.url(done ? 'star_gold' : 'star_grey');
        if (done) { el.goalText.textContent = 'Goal ✓'; FX.pop(BG.W / 2, BG.H * .30, '⭐ GOAL!', 'bad'); }
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
    if (ev === 'add' && (C.n % K.STEP === 0 || C.mult >= K.MAX)) restartAnimation(el.combo, 'pulse');
  }
  function reset(S) {
    comboKey = ''; el.combo.classList.remove('on', 'max', 'pulse'); combo(S);
    hearts(S); el.hint.style.opacity = (S && S.levelIdx > 0) || !Store.ftueDone() ? 0 : 1; lastPower = null; lastScore = -1; lastCoins = -1; lastProg = ''; lastLevel = ''; goalState = '';
    el.chip.classList.remove('done', 'failed', 'hide'); el.chip.style.display = S.goal ? '' : 'none';
    if (S.goal) { el.goalText.textContent = Goals.short(S.level); el.chip.title = Goals.label(S.level); el.chip.querySelector('img').src = Assets.url('star_grey'); el.goalBar.style.width = '0%'; }
    update(S);
  }
  function countdown(txt) {
    if (txt == null) { el.cd.classList.remove('on'); return; }
    el.cd.classList.add('on'); el.cdNum.textContent = txt; restartAnimation(el.cdNum);
  }
  return { update, hearts, reset, countdown, combo };
})();
