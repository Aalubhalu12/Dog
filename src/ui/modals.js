/**
 * BONK! — Modal dialogs (pause, game over, level clear, how-to, settings)
 * Add a modal: create a `.modal` element in index.html, then open('#id').
 */
const Modals = (() => {
  const STICKY = ['modalPause', 'modalOver', 'modalWin'];         // can't be dismissed by tapping outside / hardware back
  // Every open modal is a Nav layer: Android back / Escape closes the top-most one (sticky ones are result cards — back there = their primary button is the only way on)
  const open = id => { $(id).classList.add('open'); if (!STICKY.includes(id.slice(1))) Nav.push(id, () => close(id, true)); };
  const close = (id, fromBack) => { $(id).classList.remove('open'); if (!fromBack) Nav.pop(id); };
  const closeAll = () => document.querySelectorAll('.modal').forEach(m => close('#' + m.id));
  const isOpen = id => $(id).classList.contains('open');

  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { SFX.click(); close('#' + b.closest('.modal').id); });
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m && !STICKY.includes(m.id)) close('#' + m.id); }));

  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600); }

  function gameOver(S) {
    $('#oScore').textContent = S.score.toLocaleString(); $('#oBones').textContent = S.bones; $('#oCoins').textContent = S.coins;
    $('#overBadge').innerHTML = S.isNewBest ? '<span class="newbest">🏆 NEW BEST!</span>' : '';
    $('#overPose').src = Assets.url(S.lastHit === 'bonk' ? 'puppy_bonk' : 'puppy_dizzy');
    $('#oExtra').innerHTML = extras(S) + `<span>🎯 ${Math.round(Game.progress(S) * 100)}% of ${S.level.target.toLocaleString()}</span>`;
    $('#btnRevive').hidden = !(Ads.canReward() && !S.revived && Game.progress(S) >= .25);   // revive is offered once per run, and only once the run is worth saving
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
    const last = S.levelIdx >= LEVELS.length - 1; $('#btnContinue').querySelector('span').textContent = S.remix ? '🏠 DONE' : last ? '▶ ENDLESS MODE' : `▶ LEVEL ${S.level.id + 1}`;
    if (S.remix) { $('#winTitle').textContent = 'Remix done! 🎲'; if (S.remixReward) $('#wExtra').innerHTML += `<span class="hot">🎲 Daily reward +${S.remixReward}</span>`; }
    const dbl = $('#btnDouble'); dbl.hidden = !(Ads.canReward() && S.coins >= 5 && !S.doubled); $('#dblN').textContent = S.coins;
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
  // ---- daily bonus ladder ----
  function daily() {
    const st = Daily.status();
    $('#dailyHead').innerHTML = st.claimable ? `Day <b>${st.day}</b> of 7 — claim today's bone!` : `Claimed! Next bone in <b>${fmtLeft(st.next)}</b>`;
    $('#dailyLadder').innerHTML = st.ladder.map(r => `<div class="rung${r.done ? ' done' : ''}${r.today ? ' today' : ''}${r.big ? ' big' : ''}"><small>DAY ${r.day}</small><img src="${Assets.url(r.big ? 'goldbone' : 'bone')}" alt=""><b>+${r.coins}</b>${r.done ? '<i>✓</i>' : ''}</div>`).join('');
    const btn = $('#btnClaim'); btn.disabled = !st.claimable; btn.querySelector('span').textContent = st.claimable ? '🦴 CLAIM' : '✓ SEE YOU TOMORROW';
    open('#modalDaily');
  }
  const fmtLeft = ms => { const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return h ? `${h}h ${m}m` : `${m}m`; };
  // ---- profile ----
  function profile() {
    const p = Leaderboard.profile(), st = Save.get('stats', {}), lp = Store.levelProgress(), cleared = Object.values(lp).filter(l => l.cleared).length;
    $('#pfName').value = p.name; $('#pfCountry').textContent = `${Leaderboard.flag(p.country)} ${p.country || '—'}`;
    $('#pfStars').textContent = `${Store.totalStars()}/${LEVELS.length * 3}`; $('#pfBest').textContent = Store.best().toLocaleString(); $('#pfCoins').textContent = Store.coins().toLocaleString();
    const d = Daily.status();
    $('#pfExtra').innerHTML = `<span>🗺️ ${cleared}/${LEVELS.length} levels</span><span>🔥 ${d.streak}-day streak</span><span>🦴 ${(st.bones || 0).toLocaleString()} bones</span><span>⏱ ${Math.round((st.playSec || 0) / 60)} min played</span>`;
    open('#modalProfile');
  }
  // ---- shop: skins with a live rig preview (idle animation on a small canvas) ----
  let shopTab = 'skins', shopSel = null, shopRaf = 0, shopT = 0;
  function shop(tab) {
    shopTab = tab || shopTab; shopSel = shopSel || Shop.equipped();
    document.querySelectorAll('#modalShop .lb-tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === shopTab); b.onclick = () => { SFX.click(); shop(b.dataset.tab); }; });
    $('#paneSkins').hidden = shopTab !== 'skins'; $('#paneAds').hidden = shopTab !== 'ads'; $('#paneClub').hidden = shopTab !== 'club';
    $('#shopCoins').textContent = Store.coins().toLocaleString();
    if (shopTab === 'skins') renderSkins();
    if (shopTab === 'ads') { const own = Shop.owns('remove_ads'); const b = $('#btnRemoveAds'); b.disabled = own; b.querySelector('span').textContent = own ? '✓ OWNED' : `₹${Shop.IAP.remove_ads.price} · ONE-TIME`; }
    if (shopTab === 'club') $('#clubBenefits').innerHTML = Shop.IAP.club.benefits.map(b => `<li>✓ ${b}</li>`).join('');
    if (!isOpen('#modalShop')) { open('#modalShop'); Analytics.track('shop_open', { tab: shopTab }); startPreview(); }
  }
  const price = s => s.cur === 'free' ? 'FREE' : s.cur === 'coins' ? `🪙 ${s.price}` : s.cur === 'inr' ? `₹${s.price}` : '👑 CLUB';
  function renderSkins() {
    const eq = Shop.equipped(), sel = Shop.skin(shopSel);
    $('#skinGrid').innerHTML = Shop.SKINS.map(s => `<button class="skin${s.id === shopSel ? ' sel' : ''}${Shop.owns(s.id) ? ' own' : ''}" data-id="${s.id}"><span class="em">${s.emoji}</span><small>${Shop.owns(s.id) ? (s.id === eq ? 'EQUIPPED' : 'OWNED') : price(s)}</small></button>`).join('');
    document.querySelectorAll('#skinGrid .skin').forEach(b => b.onclick = () => { SFX.click(); shopSel = b.dataset.id; renderSkins(); });
    $('#skinName').textContent = sel.name; $('#skinDesc').textContent = sel.desc;
    const cta = $('#btnSkinCta'), own = Shop.owns(sel.id);
    cta.disabled = own && sel.id === eq || sel.cur === 'club'; cta.className = 'btn btn-primary skin-cta ' + (own ? 'btn-green' : sel.cur === 'club' ? '' : 'btn-gold');
    cta.querySelector('span').textContent = own ? (sel.id === eq ? '✓ EQUIPPED' : 'EQUIP') : sel.cur === 'club' ? '👑 BONK CLUB ONLY' : `BUY · ${price(sel)}`;
    cta.onclick = async () => {
      SFX.click();
      if (own) { Shop.equip(sel.id); SFX.yip(); toast(`${sel.emoji} ${sel.name} equipped`); renderSkins(); return; }
      cta.disabled = true; const r = await Shop.buy(sel.id); cta.disabled = false;
      if (r === 'ok') { Shop.equip(sel.id); SFX.goldbone(); FX.vibrate([20, 40, 20]); toast(`${sel.emoji} ${sel.name} is yours!`); $('#shopCoins').textContent = Store.coins().toLocaleString(); }
      else if (r === 'short') { SFX.bonk(); toast(`Need ${(sel.price - Store.coins()).toLocaleString()} more coins — play a level!`); }
      else if (r === 'cancel') toast('Payment cancelled'); else if (r === 'fail') toast('Payment failed — nothing was charged');
      renderSkins();
    };
  }
  function startPreview() {
    const cv = $('#skinCanvas'), c = cv.getContext('2d'); cancelAnimationFrame(shopRaf); let last = performance.now();
    const loop = now => {
      if (!isOpen('#modalShop')) { Rig.setSkin(Shop.equipped()); return; }
      const dt = Math.min(.05, (now - last) / 1000); last = now; shopT += dt;
      c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = '#e4f4d6'; c.beginPath(); c.ellipse(150, 222, 90, 12, 0, 0, 6.28); c.fill();
      Rig.setSkin(shopSel); Rig.update(dt, { state: 'idle', speed: 0, face: 1, lookX: Math.sin(shopT * .7) * .6, lookY: .2 }); Rig.draw(c, 150, 220, 200, 1, { state: 'idle', speed: 0 });
      shopRaf = requestAnimationFrame(loop);
    };
    shopRaf = requestAnimationFrame(loop);
  }
  // ---- daily remix ----
  function remix() {
    const R = Remix.today(), L = R.level;
    $('#rmxThumb').src = `assets/images/levels/thumb_${R.base.id}.webp`; $('#rmxName').textContent = L.name; $('#rmxSub').textContent = `${L.theme[0].toUpperCase() + L.theme.slice(1)} · target ${L.target.toLocaleString()} · ${L.hearts} ❤`;
    $('#rmxMods').innerHTML = R.mods.map(m => `<div class="mod"><span>${m.icon}</span><div><b>${m.name}</b><small>${m.desc}</small></div></div>`).join('');
    $('#rmxBest').textContent = R.best.toLocaleString(); $('#rmxGhost').textContent = R.ghost.toLocaleString();
    $('#rmxReward').textContent = R.claimed ? '✓' : `+${R.reward}`; $('#rmxRewardL').textContent = R.claimed ? 'CLAIMED' : 'CLEAR IT';
    $('#rmxNext').textContent = `New remix in ${fmtLeft(R.next)} · everyone plays the same one today`;
    open('#modalRemix'); Analytics.track('remix_open', { key: R.key, base: R.base.id });
  }
  return { open, close, closeAll, isOpen, toast, gameOver, levelClear, leaderboard, daily, profile, shop, remix };
})();
