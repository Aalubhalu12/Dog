/**
 * BONK! — Level select scene ("Select Level" board)
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
const MapScene = (() => {
  const $ = s => document.querySelector(s);
  const PER_PAGE = 10, COLS = 5;
  let app, page = 0, selected = 0;

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
      if (LEVELS[i].id > unlocked()) { Modals.toast('🔒 Clear the previous level first'); el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); return; }
      select(i);
    });
    $('#lsDots').innerHTML = Array.from({ length: pageCount() }, (_, p) => `<i class="${p === page ? 'on' : ''}">${p === page ? '🐾' : ''}</i>`).join('');
    $('#lsPrev').disabled = page === 0; $('#lsNext').disabled = page >= pageCount() - 1;
  }

  function select(i) {
    selected = i; const L = LEVELS[i], st = Store.levelStars(L.id), locked = L.id > unlocked(), best = Store.levelBest(L.id);
    $('#lsGrid').querySelectorAll('.tile').forEach(t => t.classList.toggle('selected', +t.dataset.i === i));
    $('#lsTitle').textContent = `Level ${L.id}`;
    const th = $('#lsThumb'); th.src = `assets/images/levels/thumb_${L.id}.webp`; th.onerror = () => { th.onerror = null; th.src = 'assets/images/levels/thumb_1.webp'; };
    th.parentElement.classList.toggle('locked', locked);
    const star = k => `<span class="mini"><img src="${Assets.url(st[k] ? 'star_gold' : 'star_grey')}" alt=""></span>`;
    $('#lsInfo').innerHTML = [
      `<li class="${st[0] ? 'ok' : ''}"><img src="${Assets.url('bone')}" alt=""><span class="t">Score <b>${L.target.toLocaleString()}</b></span>${star(0)}</li>`,
      `<li class="${st[1] ? 'ok' : ''}"><img src="${Assets.url('heart')}" alt=""><span class="t">Lives <b>${L.hearts}</b> · lose none</span>${star(1)}</li>`,
      `<li class="${st[2] ? 'ok' : ''}"><span class="ic">🎯</span><span class="t" title="${Goals.label(L)}">${Goals.label(L)}</span>${star(2)}</li>`,
      best ? `<li><img src="${Assets.url('trophy')}" alt=""><span class="t">Best <b>${best.toLocaleString()}</b></span></li>` : `<li><span class="ic">🐾</span><span class="t">${L.name}</span></li>`,
    ].join('');
    $('#lsPlay').disabled = locked;
  }

  function render() {
    const cur = Math.min(unlocked(), LEVELS.length) - 1;
    if (selected < 0 || selected >= LEVELS.length || LEVELS[selected].id > unlocked()) selected = cur;
    page = Math.floor(selected / PER_PAGE);
    renderGrid(); select(selected);
    $('#mapStars').textContent = `${Store.totalStars()} / ${LEVELS.length * 3}`;
    $('#mapCoins').textContent = Store.coins().toLocaleString();
  }

  function bind(a) {
    app = a;
    $('#mapBack').onclick = () => { SFX.click(); app.goMenu(); };
    $('#lsPlay').onclick  = () => { SFX.click(); app.goPlay(selected); };
    $('#lsPrev').onclick  = () => { SFX.click(); page = Math.max(0, page - 1); renderGrid(); };
    $('#lsNext').onclick  = () => { SFX.click(); page = Math.min(pageCount() - 1, page + 1); renderGrid(); };
    // swipe between pages
    let sx = null; const wrap = $('#lsGrid');
    wrap.addEventListener('pointerdown', e => sx = e.clientX);
    wrap.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) { page = Math.max(0, Math.min(pageCount() - 1, page + (dx < 0 ? 1 : -1))); renderGrid(); } });
  }

  return {
    bind,
    enter() { BG.setAmp(CONFIG.PARALLAX.MENU_AMP); Ambient.setDensity({ birds: .7, walkers: .4, cars: .3 }); Ambient.reset(); render(); },
    exit() {},
    frame(now, dt, simOnly, renderDt) { if (!simOnly) BG.draw(now, renderDt || 1 / 60, {}); },
  };
})();
