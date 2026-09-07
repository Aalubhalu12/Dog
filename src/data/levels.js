/**
 * BONK! — Levels: loaded from data/levels/*.json
 * ---------------------------------------------------------------
 * Add a level:  create data/levels/L04.json (copy L03.json), add its file
 * name to data/levels/index.json — nothing else changes. The level board,
 * HUD, star goals and clear flow all read from the LEVELS array.
 *
 * Fields (validated by Levels.validate — a bad file is reported in the console
 * and the level is skipped instead of breaking the game):
 *   id        – display number (1-based, unique, in order)
 *   name      – short title
 *   target    – score needed to clear the level                         ★1
 *   hearts    – lives at start (also the max)
 *   spawn     – [startInterval, endInterval] seconds between spawns
 *   speed     – [slow, fast] fall speed (stage heights / second): stage 1 of the level runs at `slow`,
 *               the last stage at `fast`, stages in between are spaced evenly (see `stages`)
 *   ramp      – seconds over which each stage eases from 90 % to 100 % of its own speed
 *   stages    – (optional) the level's 3 acts, each { time } with time ∈ morning|evening|night|rain.
 *               Act k begins when score reaches k/N of `target`: the light changes (BG.setTime), items
 *               fall faster (slow → medium → fast) and hazards pause 1.5 s so the change is never a cheap hit.
 *               Default: morning → evening → night.
 *   weights   – relative spawn chance per item key (must exist in ITEMS)
 *   safeTime  – seconds at the start with no hazards
 *   theme     – location (BG.THEMES: meadow · park · forest · beach), default 'meadow'
 *   ambient   – background life density { birds, walkers, cars } each 0..1
 *   goal      – the level-specific 3rd star, { type, ... } — type must exist in GOALS   ★3
 *   notes     – (optional) designer notes, ignored by the game
 *   modifiers – (optional) level mechanics, all off by default:
 *               wind: 0..1     gusts push falling items sideways (Wind system)
 *               squirrel: bool a squirrel steals bones that hit the ground (visual only)
 *               waves: { every, count, gap, mix? }  hazard bursts: every N s, `count` hazards `gap` s apart (mix = rocks+bombs)
 * ★2 is always "don't lose a heart".
 */
const LEVELS = [];                                   // filled by Levels.load() before the app starts

const Levels = (() => {
  const ROOT = 'data/levels/';
  const NUM = (v, lo, hi) => typeof v === 'number' && v >= lo && v <= hi;
  const PAIR = v => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && n > 0);
  const TIMES = ['morning', 'evening', 'night', 'rain'];                       // must match BG.TIMES
  const DEFAULT_STAGES = [{ time: 'morning' }, { time: 'evening' }, { time: 'night' }];

  /** Returns [] if valid, else a list of problems. */
  function validate(L) {
    const p = [];
    if (!Number.isInteger(L.id) || L.id < 1) p.push('id must be a positive integer');
    if (typeof L.name !== 'string' || !L.name) p.push('name missing');
    if (!NUM(L.target, 1, 1e7)) p.push('target must be a number ≥ 1');
    if (!Number.isInteger(L.hearts) || L.hearts < 1 || L.hearts > 9) p.push('hearts must be 1..9');
    if (!PAIR(L.spawn)) p.push('spawn must be [start, end] seconds');
    if (!PAIR(L.speed)) p.push('speed must be [start, end]');
    if (!NUM(L.ramp, 1, 600)) p.push('ramp must be 1..600 s');
    if (!NUM(L.safeTime, 0, 30)) p.push('safeTime must be 0..30 s');
    if (!L.weights || typeof L.weights !== 'object' || !Object.keys(L.weights).length) p.push('weights missing');
    else for (const k in L.weights) { if (!(k in ITEMS)) p.push(`weights: unknown item '${k}'`); if (!NUM(L.weights[k], 0, 1000)) p.push(`weights.${k} must be 0..1000`); }
    if (L.weights && !Object.keys(L.weights).some(k => ITEMS[k] && ITEMS[k].kind === 'score')) p.push('weights must include at least one score item (bone)');
    if (L.theme != null && typeof L.theme !== 'string') p.push('theme must be a string');
    if (L.stages != null) { if (!Array.isArray(L.stages) || L.stages.length < 1 || L.stages.length > 5 || !L.stages.every(s => s && TIMES.includes(s.time))) p.push(`stages must be 1..5 of { time: ${TIMES.join('|')} }`); }
    if (L.ambient) for (const k of ['birds', 'walkers', 'cars']) if (L.ambient[k] != null && !NUM(L.ambient[k], 0, 1)) p.push(`ambient.${k} must be 0..1`);
    if (L.goal) { if (!L.goal.type || !(L.goal.type in GOALS)) p.push(`goal.type '${L.goal && L.goal.type}' unknown (GOALS: ${Object.keys(GOALS).join(', ')})`); }
    const M = L.modifiers || {};
    if (M.wind != null && !NUM(M.wind, 0, 1)) p.push('modifiers.wind must be 0..1');
    if (M.squirrel != null && typeof M.squirrel !== 'boolean') p.push('modifiers.squirrel must be true/false');
    if (M.waves) { const w = M.waves; if (!NUM(w.every, 5, 120) || !Number.isInteger(w.count) || w.count < 2 || w.count > 8 || !NUM(w.gap, .15, 1.5)) p.push('modifiers.waves needs every 5..120, count 2..8, gap .15..1.5'); }
    return p;
  }

  function normalise(L) {
    return Object.freeze({ theme: 'meadow', ambient: { birds: 0, walkers: 0, cars: 0 }, safeTime: 0, modifiers: {}, stages: DEFAULT_STAGES, ...L, ambient: { birds: 0, walkers: 0, cars: 0, ...(L.ambient || {}) } });
  }

  const fetchJSON = async url => { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + CONFIG.VERSION, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`); return r.json(); };

  /** Load index + all level files. Resolves with LEVELS (also filled in place). */
  async function load() {
    const index = await fetchJSON(ROOT + 'index.json');
    const files = index.levels || [];
    const docs = await Promise.all(files.map(f => fetchJSON(ROOT + f).catch(e => ({ __error: String(e), __file: f }))));
    LEVELS.length = 0; let expect = 1;
    for (const d of docs) {
      if (d.__error) { console.error(`[Levels] ${d.__file}: ${d.__error}`); Analytics.track('error', { msg: 'level load ' + d.__file }); continue; }
      const problems = validate(d);
      if (problems.length) { console.error(`[Levels] ${d.name || '?'} (id ${d.id}) skipped:\n  - ${problems.join('\n  - ')}`); continue; }
      if (d.id !== expect) console.warn(`[Levels] expected id ${expect}, got ${d.id} — ids should be consecutive`);
      expect = d.id + 1; LEVELS.push(normalise(d));
    }
    if (!LEVELS.length) throw new Error('No valid levels — check data/levels/');
    Object.freeze(LEVELS.slice());  // (array itself stays mutable for hot-reload in dev tools)
    return LEVELS;
  }

  return { load, validate };
})();

/** Returns a level by index, clamped to the last level (endless replay of the hardest). */
function getLevel(index) { return LEVELS[Math.max(0, Math.min(index, LEVELS.length - 1))]; }
