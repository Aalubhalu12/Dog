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
    open('#modalOver');
  }
  const goalRows = S => [[S.stars[0], `Reach ${S.level.target.toLocaleString()} points`], [S.stars[1], `Don't lose a heart`], [S.stars[2], Goals.label(S.level)]]
    .map(([ok, t]) => `<li class="${ok ? 'ok' : ''}"><img src="${Assets.url(ok ? 'star_gold' : 'star_grey')}" alt="">${t}</li>`).join('');
  function levelClear(S) {
    const n = S.stars.filter(Boolean).length;
    $('#winTitle').textContent = n === 3 ? `Perfect! 🌟` : `Level ${S.level.id} Clear! 🎉`;
    $('#winStars').innerHTML = S.stars.map(ok => `<img class="${ok ? 'on' : ''}" src="${Assets.url(ok ? 'star_gold' : 'star_grey')}" alt="">`).join('');
    $('#winGoals').innerHTML = goalRows(S);
    $('#wScore').textContent = S.score.toLocaleString(); $('#wLives').textContent = S.lives; $('#wCoins').textContent = S.coins;
    const last = S.levelIdx >= LEVELS.length - 1; $('#btnContinue').querySelector('span').textContent = last ? '▶ ENDLESS MODE' : `▶ LEVEL ${S.level.id + 1}`;
    open('#modalWin');
    // star chimes in sync with the pop animation
    S.stars.forEach((ok, i) => { if (ok) setTimeout(() => SFX.star1(i), 300 + i * 300); });
  }
  return { open, close, closeAll, isOpen, toast, gameOver, levelClear };
})();
