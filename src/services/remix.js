/**
 * BONK! — Daily Remix: one seeded level per day with 1–2 modifiers, once-a-day coin reward, yesterday's ghost
 * ---------------------------------------------------------------
 *   Remix.today()        → { key, level (a normalised level object with id 'remix'), mods: [{id,name,icon,desc}], reward, best, ghost, claimed, next }
 *   Remix.record(S)      → after a Remix run: stores best-of-day; pays the reward once per day when the target is reached
 * Selection is deterministic from the date (everyone plays the same Remix — the leaderboard-able return reason from
 * PHASE2_PLAN). It never charges anything and never blocks — "timed" pressure is stars, not game-over.
 * The Remix reuses a real level's art/target/goal, then applies modifiers on a frozen copy (Levels stay untouched).
 */
const Remix = (() => {
  const MODS = {
    fast:    { id: 'fast',    name: 'Fast Fall',   icon: '💨', desc: 'Everything falls 25 % faster',    apply: L => ({ speed: L.speed.map(v => v * 1.25) }) },
    bones:   { id: 'bones',   name: 'Bone Rain',   icon: '🦴', desc: 'Twice the bones — and rocks',       apply: L => ({ weights: { ...L.weights, bone: L.weights.bone * 2, rock: (L.weights.rock || 10) * 1.6 } }) },
    nomag:   { id: 'nomag',   name: 'No Magnet',   icon: '🚫', desc: 'Magnets and shields stay home',    apply: L => ({ weights: { ...L.weights, magnet: 0, shield: 0 } }) },
    gold:    { id: 'gold',    name: 'Gold Rush',   icon: '✨', desc: 'Gold bones are 5× more common',    apply: L => ({ weights: { ...L.weights, goldbone: (L.weights.goldbone || 2) * 5 } }) },
    windy:   { id: 'windy',   name: 'Gusty',       icon: '🌬️', desc: 'Wind gusts push the puppy',        apply: L => ({ modifiers: { ...L.modifiers, wind: Math.max(.6, L.modifiers.wind || 0) } }) },
    night:   { id: 'night',   name: 'Night Shift', icon: '🌙', desc: 'The whole run at night',           apply: L => ({ stages: L.stages.map(() => ({ time: 'night' })) }) },
    oneheart:{ id: 'oneheart',name: 'One Heart',   icon: '💔', desc: 'Just one life — careful!',         apply: L => ({ hearts: 1 }) },
  };
  const key = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const msToMidnight = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; };
  const REWARD = 150;

  let cache = null;
  function today() {
    const k = key(); if (cache && cache.key === k) return withState(cache);
    const h = hash('remix:' + k), unlocked = Math.max(1, Math.min(LEVELS.length, Store.highestUnlocked()));
    const pool = LEVELS.slice(0, Math.max(3, unlocked));                        // only levels the player has reached (min 3) so the Remix never spoils a location
    const base = pool[h % pool.length];
    const ids = Object.keys(MODS), n = 1 + ((h >> 8) % 2), mods = [];
    for (let i = 0, j = (h >> 12) % ids.length; mods.length < n && i < ids.length; i++, j = (j + 3) % ids.length) {
      const m = MODS[ids[j]]; if (m.id === 'windy' && base.id < 6) continue; if (m.id === 'oneheart' && base.id < 3) continue; mods.push(m);
    }
    let L = { ...base }; for (const m of mods) Object.assign(L, m.apply(L));
    L = Object.freeze({ ...L, id: 'remix', name: `Remix · ${base.name}`, baseId: base.id, remix: true, target: Math.round(base.target * .75 / 50) * 50 });   // a touch shorter than the base level
    cache = { key: k, level: L, mods, base }; return withState(cache);
  }
  const withState = c => { const d = Save.get('remix', {}), mine = d.key === c.key ? d : { key: c.key, best: 0, claimed: false, plays: 0 }, ghost = d.prevBest || 0; return { ...c, reward: REWARD, best: mine.best, plays: mine.plays, claimed: !!mine.claimed, ghost, next: msToMidnight() }; };

  /** Called by Game at the end of a Remix run (win / lose / quit). Returns { reward } when the daily reward is paid now. */
  function record(S) {
    const k = key(); let paid = 0;
    Save.update(d => {
      let r = d.remix || {}; if (r.key !== k) r = { key: k, best: 0, claimed: false, plays: 0, prevBest: r.key ? r.best : (r.prevBest || 0) };
      r.best = Math.max(r.best || 0, S.score); r.plays = (r.plays || 0) + 1;
      if (!r.claimed && S.cleared) { r.claimed = true; paid = REWARD; }
      d.remix = r;
    });
    if (paid) { Wallet.add(paid, 'remix'); Analytics.track('remix_reward', { key: k, coins: paid }); }
    Analytics.track('remix_end', { key: k, base: S.level.baseId, score: S.score, cleared: !!S.cleared, mods: (cache ? cache.mods.map(m => m.id) : []) });
    return { reward: paid };
  }
  return { today, record, MODS, REWARD, enabled: () => Flags.get('remix_enabled') };
})();
