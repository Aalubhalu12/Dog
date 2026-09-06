/**
 * BONK! — Store: progress / settings facade over Save (v2 document)
 * ---------------------------------------------------------------
 * Callers keep using Store.* — the data lives in one versioned document
 * (see save.js). Coins go through Wallet (wallet.js) so every change is
 * bounded, logged and emits events for the UI. Spending arrives with the shop (Phase 4) via Wallet.spend.
 */
const Store = {
  // --- best score ------------------------------------------------------------
  best()        { return Save.get('best', 0); },
  setBest(v)    { if (v > Store.best()) { Save.set('best', v); Events.emit('best', { best: v }); return true; } return false; },

  // --- coins (delegates to Wallet) ----------------------------------------------
  coins()       { return Wallet.coins(); },
  addCoins(n = 1, reason = 'run') { return Wallet.add(n, reason); },

  // --- per-level progress: { [levelId]: { best, cleared, stars:[b,b,b], plays } } -----------
  levelProgress()            { return Save.get('levels', {}); },
  levelBest(id)              { return (Store.levelProgress()[id] || {}).best || 0; },
  isCleared(id)              { return !!(Store.levelProgress()[id] || {}).cleared; },
  levelStars(id)             { return (Store.levelProgress()[id] || {}).stars || [false, false, false]; },
  totalStars()               { const p = Store.levelProgress(); let n = 0; for (const k in p) n += (p[k].stars || []).filter(Boolean).length; return n; },
  /** Merge a run into progress; stars are sticky (once earned, kept). Returns the newly earned star indices. */
  recordLevel(id, score, cleared, stars = [false, false, false]) {
    let gained = [];
    Save.update(d => {
      const cur = d.levels[id] || { best: 0, cleared: false, stars: [false, false, false], plays: 0 };
      const prev = cur.stars || [false, false, false], merged = prev.map((v, i) => v || !!stars[i]);
      d.levels[id] = { best: Math.max(cur.best, score), cleared: cur.cleared || cleared, stars: merged, plays: (cur.plays || 0) + 1 };
      gained = merged.map((v, i) => v && !prev[i] ? i : -1).filter(i => i >= 0);
    });
    Events.emit('progress', { id, score, cleared, stars, gained });
    return gained;
  },
  highestUnlocked() { const p = Store.levelProgress(); let n = 1; while (p[n] && p[n].cleared) n++; return n; },

  // --- settings ------------------------------------------------------------------
  setting(k, d = true) { const v = Save.get('settings.' + k); return v == null ? d : v; },
  setSetting(k, v)     { Save.set('settings.' + k, v); Events.emit('setting', { key: k, value: v }); },

  // --- misc flags ----------------------------------------------------------------
  ftueDone()    { return !!Save.get('ftue.done', false); },
  setFtueDone(v = true) { Save.set('ftue.done', v); },
  bumpStat(k, n = 1) { Save.update(d => { d.stats[k] = (d.stats[k] || 0) + n; }); },

  /** Wipe everything (Settings → Reset progress). */
  resetAll()    { Save.reset(); Events.emit('coins', { coins: 0, delta: 0, reason: 'reset' }); },
};
