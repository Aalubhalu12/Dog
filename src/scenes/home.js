/**
 * BONK! — HOME scene: logo + "Select Level" board (single screen, per mockup). Also the level map.
 * ---------------------------------------------------------------
 * Layout (matches the level-select mockup):
 *   hero      – puppy + hanging wooden "Select Level" sign
 *   grid      – 5 × 2 tiles per page: yellow = cleared (with stars),
 *               blue = current/unlocked, grey + lock = locked
 *   pager     – ‹ dots ›  (pages appear automatically as LEVELS grows)
 *   card      – thumbnail + goal / target / lives for the selected level
 *   PLAY      – starts the selected level
 *
 * Levels come from LEVELS (levels.js), progress from Store.
 * Tiles beyond LEVELS.length on the last page are shown as
 * "coming soon" locks so the grid always looks full.
 */
const HomeScene = (() => {
  const PER_PAGE = 10, COLS = 5;
  let app, page = 0, selected = 0, picked = false;   // picked = player tapped a tile this session (else default to current level)

  const pageCount = () => Math.max(1, Math.ceil(LEVELS.length / PER_PAGE));
  const unlocked   = () => Store.highestUnlocked();

  function tileHTML(i) {
    const L = LEVELS[i];
    if (!L) return `<button class="tile locked soon" disabled><span class="n">${i + 1}</span><img class="lk" src="${Assets.url('lock')}" alt=""></button>`;
    const st = Store.levelStars(L.id), locked = L.id > unlocked(), current = L.id === unlocked(), cleared = Store.isCleared(L.id);
    const cls = locked ? 'locked' : cleared ? 'done' : 'current';
    const stars = locked ? `<img class="lk" src="${Assets.url('lock')}" alt="">`
                         : `<div class="st">${[0, 1, 2].map(k => `<img src="${Assets.url(st[k] ? 'star_gold' : 'star_grey')}" alt="">`).join('')}</div>`;
    return `<button class="tile ${cls}${i === selected ? ' selected' : ''}" data-i="${i}" style="animation-delay:${(i % PER_PAGE) * 40}ms"><span class="n">${L.id}</span>${stars}</button>`;
  }

  function renderGrid() {
    const grid = $('#lsGrid'), start = page * PER_PAGE;
    grid.innerHTML = Array.from({ length: PER_PAGE }, (_, k) => tileHTML(start + k)).join('');
    grid.querySelectorAll('.tile[data-i]').forEach(el => el.onclick = () => {
      const i = +el.dataset.i; SFX.click();
      if (LEVELS[i].id > unlocked()) { Modals.toast('🔒 Clear the previous level first'); restartAnimation(el, 'nudge'); return; }
      picked = true; select(i);
    });
    $('#lsDots').innerHTML = Array.from({ length: Math.max(4, pageCount()) }, (_, p) => `<i class="${p === page ? 'on' : ''}">${p === page ? '🐾' : ''}</i>`).join('');   // 4 dots like the mockup
    $('#lsPrev').disabled = page === 0; $('#lsNext').disabled = page >= pageCount() - 1;
    $('#lsThumb') && ($('#lsThumb').style.visibility = 'visible');
  }

  /** Compact goal text for the card's middle row (mockup: "Time: 60 seconds"). */
  const goalRow = L => { const g = L.goal || {}; return ({ bonesIn: `${g.count} bones in ${g.seconds}s`, coins: `Coins: ${g.count}`, noBomb: 'No bombs hit', combo: `Combo ×${g.mult}`, nearMiss: `Near misses: ${g.count}`, goldBones: `Gold bones: ${g.count}`, power: `Power-ups: ${g.count}` })[g.type] || Goals.label(L); };
  function select(i) {
    selected = i; const L = LEVELS[i], st = Store.levelStars(L.id), locked = L.id > unlocked();
    $('#lsGrid').querySelectorAll('.tile').forEach(t => t.classList.toggle('selected', +t.dataset.i === i));
    $('#lsTitle').textContent = `Level ${L.id}`;
    const th = $('#lsThumb'); th.src = `assets/images/levels/thumb_${L.id}.webp`; th.onerror = () => { th.onerror = null; th.src = 'assets/images/levels/thumb_1.webp'; };
    th.parentElement.classList.toggle('locked', locked);
    // three rows exactly like the mockup card: bones goal · time/goal · lives
    $('#lsInfo').innerHTML = [
      `<li class="${st[0] ? 'ok' : ''}"><img src="${Assets.url('bone')}" alt=""><span class="t">Score <b>${L.target.toLocaleString()}</b></span></li>`,
      `<li class="${st[2] ? 'ok' : ''}"><span class="ic">🕒</span><span class="t" title="${Goals.label(L)}">${goalRow(L)}</span></li>`,
      `<li class="${st[1] ? 'ok' : ''}"><img src="${Assets.url('heart')}" alt=""><span class="t">Lives: <b>${L.hearts}</b></span></li>`,
    ].join('');
    $('#lsPlay').disabled = locked;
  }

  function render() {
    const cur = Math.min(unlocked(), LEVELS.length) - 1;
    if (!picked || selected < 0 || selected >= LEVELS.length || LEVELS[selected].id > unlocked()) selected = cur;   // home opens on the level to continue
    page = Math.floor(selected / PER_PAGE);
    renderGrid(); select(selected);
    $('#mapCoins').textContent = Store.coins().toLocaleString();
  }

  function bind(a) {
    app = a;
    $('#lsPlay').onclick  = () => { SFX.unlock(); SFX.click(); app.goPlay(selected); };
    $('#btnHow').onclick = () => { SFX.click(); Modals.open('#modalHow'); };
    $('#btnSettings').onclick = () => { SFX.click(); Modals.open('#modalSettings'); };
    $('#btnShop').onclick = () => { SFX.click(); Modals.toast('🛍️ Shop coming soon!'); };
    $('#btnBoard').onclick = () => { SFX.click(); Modals.leaderboard(); };
    $('#lsPrev').onclick  = () => { SFX.click(); page = Math.max(0, page - 1); renderGrid(); };
    $('#lsNext').onclick  = () => { SFX.click(); page = Math.min(pageCount() - 1, page + 1); renderGrid(); };
    // tap the puppy: a little happy hop + yip (pure delight, no function)
    $('#hmDog').onpointerdown = () => { restartAnimation($('#hmDog .hm-dog-body')); SFX.unlock(); SFX.yip(); };
    // swipe between pages
    let sx = null; const wrap = $('#lsGrid');
    wrap.addEventListener('pointerdown', e => sx = e.clientX);
    wrap.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) { page = Math.max(0, Math.min(pageCount() - 1, page + (dx < 0 ? 1 : -1))); renderGrid(); } });
  }

  return {
    bind,
    enter() { render(); },
    exit() {},
    frame() {},   // home is a painted plate (assets/images/home/plate.webp) + DOM — nothing to draw on the canvas
  };
})();
