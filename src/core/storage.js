/**
 * BONK! — Persistent storage (localStorage wrapper)
 * Keys are namespaced with CONFIG.STORAGE_PREFIX.
 */
const Store = {
  get(k, d) { try { const v = localStorage.getItem(CONFIG.STORAGE_PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(CONFIG.STORAGE_PREFIX + k, JSON.stringify(v)); } catch (e) {} },

  // --- convenience accessors -------------------------------------------
  best()        { return Store.get('best', 0); },
  setBest(v)    { if (v > Store.best()) { Store.set('best', v); return true; } return false; },
  coins()       { return Store.get('coins', 0); },
  addCoins(n=1) { Store.set('coins', Store.coins() + n); },
  spendCoins(n) { if (Store.coins() < n) return false; Store.set('coins', Store.coins() - n); return true; },

  /** Per-level progress: { [levelId]: { best, cleared, stars:[b,b,b] } } */
  levelProgress()            { return Store.get('levels', {}); },
  levelBest(id)              { return (Store.levelProgress()[id] || {}).best || 0; },
  isCleared(id)              { return !!(Store.levelProgress()[id] || {}).cleared; },
  levelStars(id)             { return (Store.levelProgress()[id] || {}).stars || [false, false, false]; },
  starCount(id)              { return Store.levelStars(id).filter(Boolean).length; },
  totalStars()               { const p = Store.levelProgress(); let n = 0; for (const k in p) n += (p[k].stars || []).filter(Boolean).length; return n; },
  /** Merge a run into progress; stars are sticky (once earned, kept). Returns the newly earned star indices. */
  recordLevel(id, score, cleared, stars = [false, false, false]) {
    const p = Store.levelProgress(); const cur = p[id] || { best: 0, cleared: false, stars: [false, false, false] };
    const prev = cur.stars || [false, false, false], merged = prev.map((v, i) => v || !!stars[i]);
    p[id] = { best: Math.max(cur.best, score), cleared: cur.cleared || cleared, stars: merged }; Store.set('levels', p);
    return merged.map((v, i) => v && !prev[i] ? i : -1).filter(i => i >= 0);
  },
  highestUnlocked() { const p = Store.levelProgress(); let n = 1; while (p[n] && p[n].cleared) n++; return n; },
  /** Level the PLAY button should open: furthest unlocked (capped to the last level). */
  continueLevelIdx() { return Math.min(Store.highestUnlocked(), LEVELS.length) - 1; },

  /** Settings */
  setting(k, d = true) { return Store.get('set_' + k, d); },
  setSetting(k, v)     { Store.set('set_' + k, v); },
};
