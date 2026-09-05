/**
 * BONK! — Play scene: wires Game events to HUD/Modals and handles buttons
 */
const PlayScene = (() => {
  const $ = s => document.querySelector(s);
  let app;

  const pause = () => { if (!Game.inProgress || Game.paused) return; Game.pause(); Modals.open('#modalPause'); };
  const togglePause = (onlyPause) => { if (Modals.isOpen('#modalPause')) { if (!onlyPause) { Modals.close('#modalPause'); Game.resume(); } } else pause(); };

  function bind(a) {
    app = a;
    Game.init({
      onStart: S => HUD.reset(S),
      onCountdown: HUD.countdown,
      onHUD: HUD.update,
      onLifeLost: S => HUD.hearts(S, true),
      onLevelClear: Modals.levelClear,
      onGameOver: Modals.gameOver,
    });
    Input.setActiveCheck(() => Game.active && !Game.paused);
    Input.setPauseHandler(togglePause);
    $('#btnPause').onclick = () => { SFX.click(); pause(); };
    $('#btnResume').onclick = () => { SFX.click(); Modals.close('#modalPause'); Game.resume(); };
    $('#btnRestart').onclick = () => { SFX.click(); Modals.close('#modalPause'); Game.start(Game.state.levelIdx); };
    $('#btnQuit').onclick = () => { SFX.click(); app.goMenu(); };
    $('#btnAgain').onclick = () => { SFX.click(); Modals.close('#modalOver'); Game.start(Game.state.levelIdx); };
    $('#btnHome').onclick = () => { SFX.click(); app.goMenu(); };
    $('#btnContinue').onclick = () => { SFX.click(); Modals.close('#modalWin'); Game.continueNext(); };
    $('#btnWinHome').onclick = () => { SFX.click(); app.goMenu(); };
    $('#btnWinMap').onclick = () => { SFX.click(); app.goMap(); };
    $('#btnWinRetry').onclick = () => { SFX.click(); Modals.close('#modalWin'); Game.start(Game.state.levelIdx); };
    $('#btnOverMap').onclick = () => { SFX.click(); app.goMap(); };
    $('#btnPauseMap').onclick = () => { SFX.click(); app.goMap(); };
  }
  return { bind,
    enter(levelIdx) { BG.setAmp(CONFIG.PARALLAX.GAME_AMP); Game.start(levelIdx); },
    exit() { Game.stop(); },
    frame(now, dt, simOnly, renderDt) { if (dt > 0) Game.update(dt); if (!simOnly) BG.draw(now, renderDt || 1 / 60, { overlay: (c, t) => Game.draw(c, t) }); } };
})();
