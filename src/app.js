/**
 * BONK! — App bootstrap: load assets, register scenes, run the main loop
 * ---------------------------------------------------------------
 * Scenes implement { bind(app), enter(...args), exit(), frame(now, dt) }.
 * Add a scene: create src/scenes/<name>.js, register it in SCENES,
 * add its DOM in index.html with class="scene" id="scene<Name>".
 * Script load order (dependency order) is documented in index.html.
 */
(() => {
  const SCENES = { home: { obj: HomeScene, dom: 'sceneHome' }, play: { obj: PlayScene, dom: 'hud' } };   // home doubles as the level board
  let current = null;

  const app = {
    go(name, ...args) {
      if (current && SCENES[current].obj.exit) SCENES[current].obj.exit();
      Modals.closeAll(); current = name;
      document.querySelectorAll('.scene').forEach(s => s.classList.toggle('active', s.id === SCENES[name].dom));
      SCENES[name].obj.enter(...args);
    },
    goHome() { app.go('home'); },
    goPlay(levelIdx = 0) { app.go('play', levelIdx); },
  };

  // --- settings toggles ---------------------------------------------------
  function bindSettings() {
    // sound: master mute (🔊 button on home) + two volume sliders (sfx / music) that persist
    const syncSound = on => { $('#btnSound').textContent = on ? '🔊' : '🔇'; SFX.setEnabled(on); Music.setEnabled(on); };
    document.querySelectorAll('.toggle').forEach(tg => {
      const key = tg.dataset.setting; tg.classList.toggle('on', Store.setting(key));
      tg.onclick = () => { tg.classList.toggle('on'); const on = tg.classList.contains('on'); Store.setSetting(key, on); SFX.click(); if (key === 'tilt') BG.setTilt(on); };
    });
    const vol = (id, key, def, apply) => {
      const r = $('#' + id + 'Range'), lbl = $('#' + id + 'Val'), show = v => { lbl.textContent = Math.round(v * 100) + '%'; };
      const v0 = Store.setting(key, def); r.value = v0; apply(v0); show(v0);
      r.oninput = () => { apply(+r.value); show(+r.value); };
      r.onchange = () => { Store.setSetting(key, +r.value); if (key === 'sfxVol') SFX.bone(); };
    };
    vol('sfx', 'sfxVol', 1, v => SFX.setVolume(v)); vol('music', 'musicVol', .7, v => Music.setVolume(v));
    syncSound(Store.setting('sound')); BG.setTilt(Store.setting('tilt'));
    // controls: scheme segmented buttons + drag sensitivity slider
    const seg = document.querySelectorAll('#ctrlMode button'), slider = $('#sensRange'), sensRow = $('#sensRow');
    const syncCtrl = () => { const m = Input.mode; seg.forEach(b => b.classList.toggle('on', b.dataset.mode === m)); sensRow.style.display = m === 'drag' ? '' : 'none'; };
    seg.forEach(b => b.onclick = () => { SFX.click(); Input.setMode(b.dataset.mode); Store.setSetting('control', Input.mode); syncCtrl(); });
    slider.value = Input.sensitivity; $('#sensVal').textContent = Input.sensitivity.toFixed(1) + '×';
    slider.oninput = () => { Input.setSensitivity(slider.value); $('#sensVal').textContent = Input.sensitivity.toFixed(1) + '×'; };
    slider.onchange = () => { Store.setSetting('sens', Input.sensitivity); SFX.click(); };
    syncCtrl();
    // data actions
    $('#btnExportLog').onclick = () => {
      SFX.click(); const data = Analytics.export();
      try { const blob = new Blob([data], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bonk-log-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
      catch (e) { console.log(data); }
      if (navigator.clipboard) navigator.clipboard.writeText(data).catch(() => {});
      Modals.toast('📋 Log exported (also copied)'); console.table(Analytics.summary().levels);
    };
    $('#btnResetProgress').onclick = () => {
      SFX.click(); if (!confirm('Reset ALL progress, coins and stars? This cannot be undone.')) return;
      Store.resetAll(); Analytics.track('reset_progress'); Modals.closeAll(); app.goHome(); Modals.toast('Progress reset');
    };
    $('#btnSound').onclick = () => { const on = !Store.setting('sound'); Store.setSetting('sound', on); syncSound(on); SFX.unlock(); SFX.click(); if (on) Music.play('home'); };
  }

  // --- main loop ----------------------------------------------------------
  // Fixed-step simulation (120 Hz) behind a variable-rate render: a long frame (tab switch, GC pause,
  // 120 Hz → 60 Hz throttling) becomes several small physics steps instead of one visible jump.
  let last = performance.now(), acc = 0; const STEP = 1 / 120, MAX_FRAME = .1;
  function frame(now) {
    let dtReal = (now - last) / 1000; last = now;
    if (dtReal > MAX_FRAME) dtReal = MAX_FRAME;            // came back from background: don't fast-forward
    acc += dtReal;
    const scene = SCENES[current].obj;
    let steps = 0; while (acc >= STEP && steps < 12) { scene.frame(now, STEP, /*simOnly*/ true); acc -= STEP; steps++; }
    scene.frame(now, 0, /*simOnly*/ false, dtReal);         // render once (background/ambient use real frame dt)
    Perf.frame(performance.now() - now);                    // adaptive quality: how long did this frame take us?
    requestAnimationFrame(frame);
  }

  // --- boot: save → levels → assets → scenes -------------------------------
  Events.on('save:corrupt', () => setTimeout(() => Modals.toast('⚠️ Save was damaged — started fresh'), 1500));
  Events.on('save:loaded', ({ source }) => { if (source === 'backup') setTimeout(() => Modals.toast('♻️ Restored from backup save'), 1500); });
  Save.load();                                                       // migrates v1 keys, recovers backups
  Analytics.debug = Flags.get('analytics_debug');
  Analytics.track('session_start', { best: Store.best(), coins: Store.coins(), stars: Store.totalStars(), unlocked: Store.highestUnlocked() });

  const loadAll = Promise.all([
    Levels.load(),
    Assets.load(p => { $('#loadbar').style.width = (p * 100) + '%'; }),
  ]);
  loadAll.catch(err => { console.error(err); const l = $('#loader'); l.innerHTML = `<div style="color:#fff;font-weight:800;padding:24px;text-align:center">😿 Could not load the game.<br><small>${String(err.message || err)}</small><br><br><button onclick="location.reload()" style="font:inherit;padding:8px 20px;border-radius:12px;border:0">Retry</button></div>`; });
  loadAll.then(() => {
    BG.init();
    Input.bind({ dragSurface: $('#bg'), canvas: $('#bg') }); Input.setPuppyX(() => Game.puppy.x);
    Input.setMode(Store.setting('control', 'drag')); Input.setSensitivity(Store.setting('sens', CONFIG.PUPPY.DRAG_SENS));
    HomeScene.bind(app); PlayScene.bind(app); bindSettings();
    Leaderboard.init();                                              // local-first; syncs only inside daily windows
    $('#appVersion').textContent = 'v' + CONFIG.VERSION;
    app.go('home');
    $('#loader').classList.add('done');
    requestAnimationFrame(frame);
  });
})();
