/**
 * BONK! — Level goals → stars
 * ---------------------------------------------------------------
 * Three stars per level:
 *   ★1  reach the target score (this is what "clears" the level)
 *   ★2  finish without losing a heart
 *   ★3  the level's own goal (LEVELS[i].goal)
 * Timed goals are bonus challenges only — they never end the run.
 *
 * Add a goal type: add an entry to GOALS with
 *   label(cfg)            – short text for UI
 *   init(cfg)             – returns per-run tracking state
 *   on(event, S, st, cfg, item) – events: 'catch' · 'hit' · 'near' (near-miss) · 'shielded'
 *   done(S, st, cfg)      – true when achieved (checked at level clear)
 *   failed(S, st, cfg)    – optional: true when it can no longer be achieved (for live UI)
 *   survive               – optional flag: a "don't do X" goal; HUD never shows it as complete mid-run
 */
const GOALS = Object.freeze({
  bonesIn: {
    label: c => `${c.count} bones in first ${c.seconds}s`,
    init: () => ({ n: 0, hit: false }),
    on: (ev, S, st, c, it) => { if (ev === 'catch' && it.type === 'bone' && S.time <= c.seconds) { st.n++; if (st.n >= c.count) st.hit = true; } },
    done: (S, st) => st.hit,
    failed: (S, st, c) => !st.hit && S.time > c.seconds,
    progress: (S, st, c) => Math.min(1, st.n / c.count),
  },
  coins: {
    label: c => `Collect ${c.count} coins`,
    init: () => ({ n: 0 }),
    on: (ev, S, st, c, it) => { if (ev === 'catch' && it.type === 'coin') st.n += it.def.coins || 1; },
    done: (S, st, c) => st.n >= c.count,
    progress: (S, st, c) => Math.min(1, st.n / c.count),
  },
  noBomb: {
    label: () => `No bombs (never dizzy)`,
    survive: true,                       // "don't do X" goal: only counts as done when the level is cleared (HUD keeps it live)
    init: () => ({ ok: true }),
    on: (ev, S, st, c, it) => { if (ev === 'hit' && it.type === 'bomb') st.ok = false; },
    done: (S, st) => st.ok, failed: (S, st) => !st.ok,
    progress: (S, st) => st.ok ? 1 : 0,
  },
  combo: {
    label: c => `Reach combo ×${c.mult}`,
    init: () => ({ hit: false }),
    on: (ev, S, st, c) => { if (ev === 'catch' && S.combo && S.combo.mult >= c.mult) st.hit = true; },
    done: (S, st) => st.hit,
    progress: (S, st, c) => st.hit ? 1 : Math.min(1, ((S.combo && S.combo.mult) || 1) / c.mult),
  },
  nearMiss: {
    label: c => `${c.count} near misses (Phew!)`,
    init: () => ({ n: 0 }),
    on: (ev, S, st) => { if (ev === 'near') st.n++; },
    done: (S, st, c) => st.n >= c.count,
    progress: (S, st, c) => Math.min(1, st.n / c.count),
  },
  goldBones: {
    label: c => `Catch ${c.count} gold bone${c.count > 1 ? 's' : ''}`,
    init: () => ({ n: 0 }),
    on: (ev, S, st, c, it) => { if (ev === 'catch' && it.type === 'goldbone') st.n++; },
    done: (S, st, c) => st.n >= c.count,
    progress: (S, st, c) => Math.min(1, st.n / c.count),
  },
  power: {
    label: c => `Grab ${c.count} power-ups`,
    init: () => ({ n: 0 }),
    on: (ev, S, st, c, it) => { if (ev === 'catch' && it.def.kind === 'power') st.n++; },
    done: (S, st, c) => st.n >= c.count,
    progress: (S, st, c) => Math.min(1, st.n / c.count),
  },
});

const Goals = {
  /** Attach tracking to a fresh game state. */
  init(S) { const g = S.level.goal; S.goal = g ? { cfg: g, def: GOALS[g.type], st: GOALS[g.type].init(g) } : null; S.heartsLost = 0; },
  event(S, ev, it) { if (S.goal) S.goal.def.on(ev, S, S.goal.st, S.goal.cfg, it); if (ev === 'hit') S.heartsLost++; },
  /** Evaluate the three stars for the current run (call at level clear or game over). */
  stars(S) {
    return [
      S.cleared,
      S.cleared && S.heartsLost === 0,
      S.cleared && !!S.goal && S.goal.def.done(S, S.goal.st, S.goal.cfg),
    ];
  },
  label(L) { const g = L.goal; return g ? GOALS[g.type].label(g) : ''; },
  progress(S) { return S.goal ? S.goal.def.progress(S, S.goal.st, S.goal.cfg) : 0; },
  failed(S) { return !!(S.goal && S.goal.def.failed && S.goal.def.failed(S, S.goal.st, S.goal.cfg)); },
};
