/**
 * BONK! — Menu scene
 */
const MenuScene = (() => {
  const $ = s => document.querySelector(s);
  function refresh() {
    $('#best').textContent = Store.best().toLocaleString(); $('#coins').textContent = Store.coins().toLocaleString();
    const idx = Store.continueLevelIdx(), L = LEVELS[idx], allDone = Store.highestUnlocked() > LEVELS.length;
    $('#btnPlaySub').textContent = allDone ? `Level ${L.id} · replay` : `Level ${L.id} · ${L.name}`;
    $('#menuStars').textContent = `${Store.totalStars()}/${LEVELS.length * 3}`;
  }

  function drawPuppy(c, t, ax, ay) {
    const W = BG.W, H = BG.H, sheet = Assets.img('idle_sheet'), N = 24, fw = sheet.width / N, fh = sheet.height;
    const pw = Math.min(W * .30, H * .20), ph = pw * fh / fw;
    const fi = Math.floor(t * 12) % N;              // 24-frame breathing loop from the clip, 12 fps
    const breathe = 1;
    const x = W * .10 - ax * .6, gy = H * .91 - ay * .3;
    c.fillStyle = 'rgba(20,60,10,.28)'; c.beginPath(); c.ellipse(x + pw / 2, gy + 2, pw * .36, pw * .08, 0, 0, 6.28); c.fill();
    c.save(); c.translate(x + pw / 2, gy); c.scale(breathe, 2 - breathe);
    c.drawImage(sheet, fi * fw, 0, fw, fh, -pw / 2, -ph, pw, ph); c.restore();
  }

  function bind(app) {
    $('#btnPlay').onclick = () => { SFX.unlock(); SFX.click(); app.goPlay(Store.continueLevelIdx()); };
    $('#btnLevels').onclick = () => { SFX.unlock(); SFX.click(); app.go('map'); };
    $('#btnHow').onclick = () => { SFX.click(); Modals.open('#modalHow'); };
    $('#btnSettings').onclick = () => { SFX.click(); Modals.open('#modalSettings'); };
    $('#btnShop').onclick = () => { SFX.click(); Modals.toast('🛍️ Shop coming soon!'); };
  }
  return { bind, refresh, enter() { BG.setAmp(CONFIG.PARALLAX.MENU_AMP); Ambient.setDensity({ birds: .7, walkers: .5, cars: .4 }); Ambient.reset(); refresh(); },
           frame(now, dt, simOnly, renderDt) { if (!simOnly) BG.draw(now, renderDt || 1 / 60, { overlay: drawPuppy }); } };
})();
