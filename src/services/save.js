/**
 * BONK! — Save v2: one versioned document in localStorage
 * ---------------------------------------------------------------
 * Key:  CONFIG.STORAGE_PREFIX + 'save'   (e.g. "bonk_save")
 * Why:  a single JSON blob with a schema version is what cloud save (Phase 5) syncs,
 *       and migrations run in one place instead of every feature inventing keys.
 *
 * Shape (SCHEMA = 2):
 * {
 *   v: 2, createdAt, updatedAt,
 *   best: 0,                                   // all-time best score
 *   coins: 0,                                  // wallet (see Wallet)
 *   levels: { [id]: { best, cleared, stars:[b,b,b], plays } },
 *   settings: { sound, vib, tilt, music },
 *   ftue: { done: false },                     // first-time-user experience shown?
 *   shop: { owned: ['classic'], equipped: 'classic' },
 *   daily: { streak: 0, last: null },          // reserved: daily bonus (Phase 4)
 *   stats: { runs, wins, losses, bones, playSec },
 *   profile: { uid, name, country },          // leaderboard identity (anonymous; Firebase Auth uid later)
 *   lb: { latest, best, serverBest, lastWindow, lastSyncAt, rank:{world,country} }   // see src/services/leaderboard.js
 * }
 *
 * Guarantees
 *   • load() never throws: corrupt JSON → tries the backup copy → else fresh doc (+ 'save:corrupt' event)
 *   • write() is debounced (one localStorage write per frame at most) and keeps a backup of the previous doc
 *   • migrate() upgrades old layouts: v1 = separate bonk_best / bonk_coins / bonk_levels / bonk_set_* keys
 *   • every field access goes through get()/update() so the doc can be swapped by cloud sync later
 */
const Save = (() => {
  const SCHEMA = 2;
  const KEY = () => CONFIG.STORAGE_PREFIX + 'save';
  const BAK = () => CONFIG.STORAGE_PREFIX + 'save_bak';
  let doc = null, dirty = false, flushTimer = null, generation = 0, persisted = false;   // generation bumps whenever the doc object is swapped (load/reset/replace)

  const fresh = () => ({
    v: SCHEMA, createdAt: Date.now(), updatedAt: Date.now(),
    best: 0, coins: 0, levels: {},
    settings: { sound: true, vib: true, tilt: true, music: true },
    ftue: { done: false },
    shop: { owned: ['classic'], equipped: 'classic' },
    daily: { streak: 0, last: null },
    stats: { runs: 0, wins: 0, losses: 0, bones: 0, playSec: 0 },
    profile: { uid: '', name: '', country: '' },
    lb: { latest: 0, best: 0, serverBest: 0, lastWindow: null, lastSyncAt: 0, rank: { world: 0, country: 0 } },
  });

  /** Deep-fill missing fields from a template (new fields added in later versions get defaults). */
  function fill(target, tpl) {
    for (const k in tpl) {
      if (target[k] == null) target[k] = Array.isArray(tpl[k]) ? tpl[k].slice() : (typeof tpl[k] === 'object' && tpl[k] ? fill({}, tpl[k]) : tpl[k]);
      else if (typeof tpl[k] === 'object' && tpl[k] && !Array.isArray(tpl[k]) && typeof target[k] === 'object') fill(target[k], tpl[k]);
    }
    return target;
  }

  function parse(raw) { if (!raw) return null; try { const d = JSON.parse(raw); return d && typeof d === 'object' && typeof d.v === 'number' ? d : null; } catch (e) { return null; } }

  // --- migrations ----------------------------------------------------------
  const MIGRATIONS = {
    /** v1 → v2: gather the old scattered keys into the document. */
    1: (d) => {
      const P = CONFIG.STORAGE_PREFIX, g = (k, def) => { try { const v = localStorage.getItem(P + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
      d.best = g('best', d.best || 0); d.coins = g('coins', d.coins || 0);
      const lv = g('levels', {}); for (const id in lv) d.levels[id] = { best: lv[id].best || 0, cleared: !!lv[id].cleared, stars: lv[id].stars || [false, false, false], plays: 0 };
      d.settings = { sound: g('set_sound', true), vib: g('set_vib', true), tilt: g('set_tilt', true), music: true };
      d.v = 2; return d;
    },
  };
  function hasLegacy() { const P = CONFIG.STORAGE_PREFIX; return ['best', 'coins', 'levels', 'set_sound', 'set_vib', 'set_tilt'].some(k => localStorage.getItem(P + k) != null); }
  function clearLegacy() { const P = CONFIG.STORAGE_PREFIX; ['best', 'coins', 'levels', 'set_sound', 'set_vib', 'set_tilt'].forEach(k => localStorage.removeItem(P + k)); }

  function migrate(d) {
    let from = d.v;
    while (d.v < SCHEMA) { const m = MIGRATIONS[d.v]; if (!m) { d.v = SCHEMA; break; } d = m(d); }
    fill(d, fresh());
    if (from !== d.v) { d.migratedFrom = from; console.info(`[Save] migrated v${from} → v${d.v}`); }
    return d;
  }

  // --- load / write --------------------------------------------------------
  function load() {
    let d = parse(localStorage.getItem(KEY())), source = 'main';
    if (!d) { d = parse(localStorage.getItem(BAK())); source = d ? 'backup' : null; }
    if (!d && localStorage.getItem(KEY()) != null) { console.warn('[Save] corrupt save, backup unusable — starting fresh'); Events.emit('save:corrupt', {}); }
    if (!d) {
      d = fresh(); source = 'fresh';
      if (hasLegacy()) { d.v = 1; d = migrate(d); source = 'legacy'; }
    } else d = migrate(d);
    doc = d; generation++; persisted = source === 'main' || source === 'backup';   // doc is known to exist in storage
    if (source !== 'main') write(true);             // persist the recovered / migrated doc immediately
    if (hasLegacy()) clearLegacy();                 // old keys are now inside the doc (backup copy holds the pre-migration state)
    Events.emit('save:loaded', { source, doc });
    return doc;
  }

  function write(now = false) {
    dirty = true;
    if (now) return flush();
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  }
  function flush() {
    flushTimer = null; if (!dirty || !doc) return;
    dirty = false;
    try {
      const prev = localStorage.getItem(KEY());
      // Storage was wiped externally (QA "clear site data", tests) after we persisted: don't resurrect the old doc.
      if (persisted && prev == null && localStorage.getItem(BAK()) == null) { generation++; return; }
      doc.updatedAt = Date.now(); const json = JSON.stringify(doc);
      localStorage.setItem(BAK(), parse(prev) ? prev : json);   // backup = last known-good document (never a corrupt one)
      localStorage.setItem(KEY(), json); persisted = true;
    } catch (e) { console.warn('[Save] write failed', e); }
    Events.emit('save:written', { doc });
  }
  // never lose the last few ms of play when the tab dies
  if (typeof window !== 'undefined') { window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); }); }

  // --- access --------------------------------------------------------------
  /** Save.get('levels.3.best', 0) */
  function get(path, def) { if (!doc) load(); let o = doc; for (const p of path.split('.')) { if (o == null || typeof o !== 'object') return def; o = o[p]; } return o == null ? def : o; }
  function set(path, value) { if (!doc) load(); const ps = path.split('.'), last = ps.pop(); let o = doc; for (const p of ps) { if (o[p] == null || typeof o[p] !== 'object') o[p] = {}; o = o[p]; } o[last] = value; write(); return value; }
  /** Save.update(d => { d.coins += 5; }) — mutate the doc in one place, one write. */
  function update(fn) { if (!doc) load(); fn(doc); write(); return doc; }

  function reset() { doc = fresh(); generation++; persisted = false; clearLegacy(); localStorage.removeItem(BAK()); write(true); Events.emit('save:reset', { doc }); }
  /** Replace the whole document (cloud restore). Runs migrations on the incoming doc. */
  function replace(d) { doc = migrate(fill(d, {})); generation++; write(true); Events.emit('save:loaded', { source: 'replace', doc }); }

  return { load, get, set, update, reset, replace, flush, get doc() { return doc || load(); }, get generation() { return generation; } };
})();
