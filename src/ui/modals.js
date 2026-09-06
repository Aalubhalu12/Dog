/**
 * BONK! — Modal dialogs (pause, game over, level clear, how-to, settings)
 * Add a modal: create a `.modal` element in index.html, then open('#id').
 */
const Modals = (() => {
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

  // ---- leaderboard: opens instantly from cache + local best; re-renders if a sync lands while open ----
  let lbBoard = 'world', lbUnsub = null;
  function leaderboard() {
    $('#lbCountryTab').textContent = `${Leaderboard.flag(Leaderboard.profile().country)} Country`;
    document.querySelectorAll('.lb-tab').forEach(b => { b.classList.toggle('on', b.dataset.board === lbBoard); b.onclick = () => { SFX.click(); lbBoard = b.dataset.board; document.querySelectorAll('.lb-tab').forEach(x => x.classList.toggle('on', x === b)); renderBoard(); }; });
    open('#modalBoard'); renderBoard();            // open first so the list has layout for the scroll-to-me
    if (lbUnsub) lbUnsub(); lbUnsub = Events.on('lb:synced', () => { if (isOpen('#modalBoard')) renderBoard(); });
    Leaderboard.syncIfDue('board');            // no-op unless a daily window is open and unused
    Analytics.track('lb_open', { board: lbBoard });
  }
  const lbRow = r => `<div class="lb-row${r.me ? ' me' : ''}${r.rank && r.rank <= 3 ? ' r' + r.rank : ''}"><span class="rk">${r.rank ? (r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank.toLocaleString()) : '—'}</span><span class="nm"><span>${Leaderboard.flag(r.country)} ${esc(r.name)}</span>${r.me ? '<em>YOU</em>' : ''}</span><b class="sc">${(r.score || 0).toLocaleString()}</b></div>`;
  const esc = t => String(t || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  function renderBoard() {
    const v = Leaderboard.view(lbBoard);
    $('#lbMe').innerHTML = `<span class="lb-you">${v.me.rank ? '#' + v.me.rank.toLocaleString() : '🐾'}</span><span class="lb-yl">${v.me.rank ? 'YOUR RANK' : 'PLAY TO RANK'}</span><b>${v.me.score.toLocaleString()}</b>`;
    let html = `<div class="lb-h">TOP 10</div>` + (v.top.length ? v.top.map(lbRow).join('') : `<div class="lb-dim">Top players appear after your first run</div>`);
    if (!v.inTop) html += `<div class="lb-gap">···</div><div class="lb-h">NEAR YOU</div>` + v.around.map(lbRow).join('');
    $('#lbList').innerHTML = html;
    const list = $('#lbList'), me = list.querySelector('.lb-row.me');       // mid-pack: land on my neighbourhood, top 10 stays one flick above
    list.scrollTop = me && !v.inTop ? Math.max(0, me.offsetTop - list.clientHeight * .55) : 0;
  }
  return { open, close, closeAll, isOpen, toast, gameOver, levelClear, leaderboard };
})();
