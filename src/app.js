/**
 * BONK! — App bootstrap: load assets, register scenes, run the main loop
 * ---------------------------------------------------------------
 * Scenes implement { bind(app), enter(...args), exit(), frame(now, dt) }.
 * Add a scene: create src/scenes/<name>.js, register it in SCENES,
 * add its DOM in index.html with class="scene" id="scene<Name>".
 */
(() => {
  const $ = s => document.querySelector(s);
  const SCENES = { menu: { obj: MenuScene, dom: 'sceneMenu' }, map: { obj: MapScene, dom: 'sceneMap' }, play: { obj: PlayScene, dom: 'hud' } };
  let current = null;

  const app = {
    go(name, ...args) {
      if (current && SCENES[current].obj.exit) SCENES[current].obj.exit();
      Modals.closeAll(); current = name;
      document.querySelectorAll('.scene').forEach(s => s.classList.toggle('active', s.id === SCENES[name].dom));
      SCENES[name].obj.enter(...args);
    },
    goMenu() { app.go('menu'); },
    goPlay(levelIdx = 0) { app.go('play', levelIdx); },
    goMap() { app.go('map'); },
  };

  // --- settings toggles ---------------------------------------------------
  function bindSettings() {
    const syncSound = on => { $('#btnSound').textContent = on ? '🔊' : '🔇'; SFX.setEnabled(on); };
    document.querySelectorAll('.toggle').forEach(tg => {
      const key = tg.dataset.setting; tg.classList.toggle('on', Store.setting(key));
      tg.onclick = () => { tg.classList.toggle('on'); const on = tg.classList.contains('on'); Store.setSetting(key, on); SFX.click();
        if (key === 'tilt') BG.setTilt(on); if (key === 'sound') syncSound(on); };
    });
    syncSound(Store.setting('sound')); BG.setTilt(Store.setting('tilt'));
    $('#btnSound').onclick = () => { const tg = $('[data-setting="sound"]'); tg.classList.toggle('on'); const on = tg.classList.contains('on'); Store.setSetting('sound', on); syncSound(on); SFX.click(); };
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
    requestAnimationFrame(frame);
  }

  Assets.load(p => { $('#loadbar').style.width = (p * 100) + '%'; }).then(() => {
    BG.init();
    Input.bind({ leftBtn: $('#ctlL'), rightBtn: $('#ctlR'), dragSurface: $('#bg'), canvas: $('#bg') });
    MenuScene.bind(app); MapScene.bind(app); PlayScene.bind(app); bindSettings();
    $('#appVersion').textContent = 'v' + CONFIG.VERSION;
    app.go('menu');
    $('#loader').classList.add('done');
    requestAnimationFrame(frame);
  });
})();
