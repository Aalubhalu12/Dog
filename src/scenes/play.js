/**
 * BONK! — Play scene: wires Game events to HUD/Modals and handles buttons
 */
const PlayScene = (() => {
  let app;

  let retryArmed = 0;
  const armInstantRetry = () => { retryArmed = performance.now(); };
  const pause = () => { if (!Game.inProgress || Game.paused) return; Game.pause(); Music.duck(true); Modals.open('#modalPause'); Analytics.track('pause', { id: Game.state.level.id, at: Math.round(Game.state.time) }); };
  const togglePause = (onlyPause) => { if (Modals.isOpen('#modalPause')) { if (!onlyPause) { Modals.close('#modalPause'); Game.resume(); } } else pause(); };

  function bind(a) {
    app = a;
    Game.init({
      onStart: S => HUD.reset(S),
      onCountdown: HUD.countdown,
      onHUD: HUD.update,
      onLifeLost: S => HUD.hearts(S, true),
      onLevelClear: Modals.levelClear,
      onGameOver: S => { Modals.gameOver(S); armInstantRetry(); Ads.interstitial('game_over', { levelId: S.level.id, stars: (S.stars || []).filter(Boolean).length }); },
      onCombo: HUD.combo,
    });
    // Instant retry: on the game-over card, press R / Enter / Space (desktop) — the TRY AGAIN button is already the primary tap target.
    window.addEventListener('keydown', e => { if (Modals.isOpen('#modalOver') && ['r', 'R', 'Enter', ' '].includes(e.key)) { e.preventDefault(); $('#btnAgain').click(); } });
    Input.setActiveCheck(() => Game.active && !Game.paused);
    Input.setPauseHandler(togglePause);
    $('#btnPause').onclick = () => { SFX.click(); pause(); };
    $('#btnResume').onclick = () => { SFX.click(); Modals.close('#modalPause'); Music.duck(false); Game.resume(); };
    $('#btnRestart').onclick = () => { SFX.click(); Modals.close('#modalPause'); Analytics.track('retry', { id: Game.state.level.id, from: 'pause' }); Game.start(Game.state.levelIdx); };
    $('#btnQuit').onclick = () => { SFX.click(); app.goHome(); };
    $('#btnRevive').onclick = async () => { SFX.click(); const b = $('#btnRevive'); b.disabled = true; const ok = await Ads.rewarded('revive'); b.disabled = false; if (!ok) { Modals.toast('No reward — ad skipped'); return; } Modals.close('#modalOver'); Game.revive(); };
    $('#btnDouble').onclick = async () => { SFX.click(); const S = Game.state; const b = $('#btnDouble'); b.disabled = true; const ok = await Ads.rewarded('double_coins'); b.disabled = false; if (!ok || !S) { Modals.toast('No reward — ad skipped'); return; } S.doubled = true; Store.addCoins(S.coins, 'double'); S.coins *= 2; $('#wCoins').textContent = S.coins; b.hidden = true; SFX.goldbone(); Modals.toast(`🪙 Coins doubled → ${S.coins}`); };
    $('#btnAgain').onclick = () => { SFX.click(); Modals.close('#modalOver'); Analytics.track('retry', { id: Game.state.level.id, from: 'gameover' }); Game.start(Game.state.levelIdx); };
    $('#btnHome').onclick = () => { SFX.click(); app.goHome(); };
    $('#btnContinue').onclick = () => { SFX.click(); Modals.close('#modalWin'); if (Game.state.remix) { app.goHome(); return; } Analytics.track('continue', { from: Game.state.level.id }); Game.continueNext(); };
    $('#btnWinHome').onclick = () => { SFX.click(); app.goHome(); };
    $('#btnWinMap').onclick = () => { SFX.click(); app.goHome(); };
    $('#btnWinRetry').onclick = () => { SFX.click(); Modals.close('#modalWin'); Analytics.track('retry', { id: Game.state.level.id, from: 'win' }); Game.start(Game.state.levelIdx); };
    $('#btnOverMap').onclick = () => { SFX.click(); app.goHome(); };
    $('#btnPauseMap').onclick = () => { SFX.click(); app.goHome(); };
  }
  return { bind,
    pause,
    enter(levelIdx) { BG.setAmp(CONFIG.PARALLAX.GAME_AMP); Game.start(levelIdx); FTUE.start(levelIdx); },
    exit() { Game.stop(); FTUE.stop(); },
    frame(now, dt, simOnly, renderDt) { if (dt > 0) { Game.update(dt); FTUE.update(dt); } if (!simOnly) { if (Game.state) HUD.update(Game.state); BG.draw(now, renderDt || 1 / 60, { overlay: (c, t) => Game.draw(c, t), lightX: Game.puppy.box.cx }); } } };
})();
