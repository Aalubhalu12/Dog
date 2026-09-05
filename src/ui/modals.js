/**
 * BONK! — Modal dialogs (pause, game over, level clear, how-to, settings)
 * Add a modal: create a `.modal` element in index.html, then open('#id').
 */
const Modals = (() => {
  const $ = s => document.querySelector(s);
  const STICKY = ['modalPause', 'modalOver', 'modalWin'];         // can't be dismissed by tapping outside
  const open = id => $(id).classList.add('open');
  const close = id => $(id).classList.remove('open');
  const closeAll = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
  const isOpen = id => $(id).classList.contains('open');

  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { SFX.click(); b.closest('.modal').classList.remove('open'); });
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m && !STICKY.includes(m.id)) m.classList.remove('open'); }));

  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600); }

  function gameOver(S) {
    $('#oScore').textContent = S.score.toLocaleString(); $('#oBones').textContent = S.bones; $('#oCoins').textContent = S.coins;
    $('#overBadge').innerHTML = S.isNewBest ? '<span class="newbest">🏆 NEW BEST!</span>' : '';
    $('#overPose').src = Assets.url(S.lastHit === 'bonk' ? 'puppy_bonk' : 'puppy_dizzy');
    $('#oExtra').innerHTML = extras(S) + `<span>🎯 ${Math.min(100, Math.round(S.score / S.level.target * 100))}% of ${S.level.target.toLocaleString()}</span>`;
    open('#modalOver');
  }
  const extras = S => {
    const out = [];
    if (S.combo && S.combo.bestMult > 1) out.push(`<span class="${S.combo.bestMult >= CONFIG.COMBO.MAX ? 'hot' : ''}">🔥 Best combo ×${S.combo.bestMult} (${S.combo.best})</span>`);
    if (S.nearMisses) out.push(`<span>😅 ${S.nearMisses} near miss${S.nearMisses > 1 ? 'es' : ''}</span>`);
    if (S.shieldSaves) out.push(`<span>🛡 ${S.shieldSaves} shield save${S.shieldSaves > 1 ? 's' : ''}</span>`);
    return out.join('');
  };
  const goalRows = S => [[S.stars[0], `Reach ${S.level.target.toLocaleString()} points`], [S.stars[1], `Don't lose a heart`], [S.stars[2], Goals.label(S.level)]]
    .map(([ok, t]) => `<li class="${ok ? 'ok' : ''}"><img src="${Assets.url(ok ? 'star_gold' : 'star_grey')}" alt="">${t}</li>`).join('');
  function levelClear(S) {
    const n = S.stars.filter(Boolean).length;
    $('#winTitle').textContent = n === 3 ? `Perfect! 🌟` : `Level ${S.level.id} Clear! 🎉`;
    $('#winStars').innerHTML = S.stars.map(ok => `<img class="${ok ? 'on' : ''}" src="${Assets.url(ok ? 'star_gold' : 'star_grey')}" alt="">`).join('');
    $('#winGoals').innerHTML = goalRows(S);
    $('#wScore').textContent = S.score.toLocaleString(); $('#wLives').textContent = S.lives; $('#wCoins').textContent = S.coins;
    $('#wExtra').innerHTML = extras(S);
    const last = S.levelIdx >= LEVELS.length - 1; $('#btnContinue').querySelector('span').textContent = last ? '▶ ENDLESS MODE' : `▶ LEVEL ${S.level.id + 1}`;
    open('#modalWin');
    // star chimes in sync with the pop animation
    S.stars.forEach((ok, i) => { if (ok) setTimeout(() => SFX.star1(i), 300 + i * 300); });
  }
  return { open, close, closeAll, isOpen, toast, gameOver, levelClear };
})();
