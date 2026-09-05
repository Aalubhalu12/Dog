/**
 * BONK! — Leaderboard: local-first scores, cached server view, limited daily sync
 * ---------------------------------------------------------------
 * Rules (see docs/LEADERBOARD.md)
 *   • Every run's score is saved LOCALLY at once (Save doc → lb.latest / lb.best). No network per match.
 *   • The server is contacted only inside the daily SYNC WINDOWS (CONFIG.LEADERBOARD.SYNC_WINDOWS_PER_DAY,
 *     e.g. 2 → 00:00–11:59 and 12:00–23:59). One sync per window, max — triggered when a window is open
 *     and we haven't used it yet (boot, run end, opening the board).
 *   • A sync uploads the player's BEST score only if it beats what the server already has, and always
 *     returns the minimal view: World Top 10, Country Top 10, my rank, 7 above + me + 5 below (per board).
 *     If I am in the Top 10 the "around" slice is omitted (no duplicates).
 *   • The last server response is cached (localStorage <prefix>lb_cache). The board opens from cache
 *     instantly; my own row always shows my LOCAL best, so my score feels live even between syncs.
 *
 * Adapters — same request/response shape, chosen by CONFIG.LEADERBOARD.ENDPOINT:
 *   MockAPI   — deterministic simulated population (no server yet; Firebase is Phase 5)
 *   HttpAPI   — POST {uid,name,country,score} → Cloud Function `leaderboard` (firebase/functions/leaderboard.js)
 *
 * Request : { uid, name, country, score }            (score = local best; server keeps max)
 * Response: { world:   { top: [row×10], rank, total, around: [row×≤13] },
 *             country: { code, top: [row×10], rank, total, around: [row×≤13] } }
 *   row = { rank, uid, name, score, country }         around = 7 above … me … 5 below (empty if rank ≤ 10)
 */
const Leaderboard = (() => {
  const CFG = () => CONFIG.LEADERBOARD || {};
  const CACHE_KEY = () => CONFIG.STORAGE_PREFIX + 'lb_cache';
  const ABOVE = 7, BELOW = 5, TOP = 10;
  let api = null, cache = null, inflight = null, calls = 0;

  // ---- identity ------------------------------------------------------------
  const rid = () => Math.random().toString(36).slice(2, 10);
  function profile() {
    let p = Save.get('profile', null);
    if (!p || !p.uid) { p = { uid: rid() + rid(), name: '', country: detectCountry() }; Save.set('profile', p); }
    if (!p.name) { p.name = 'Puppy ' + p.uid.slice(-4).toUpperCase(); Save.set('profile.name', p.name); }
    if (!p.country) { p.country = detectCountry(); Save.set('profile.country', p.country); }
    return p;
  }
  const TZ2CC = { 'Asia/Calcutta': 'IN', 'Asia/Kolkata': 'IN', 'Europe/London': 'GB', 'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US', 'Asia/Tokyo': 'JP', 'Asia/Jakarta': 'ID', 'America/Sao_Paulo': 'BR', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Asia/Manila': 'PH', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK', 'Australia/Sydney': 'AU', 'Asia/Dubai': 'AE', 'Asia/Singapore': 'SG', 'Europe/Moscow': 'RU', 'Asia/Seoul': 'KR', 'America/Mexico_City': 'MX' };
  function detectCountry() {
    try { const m = /[-_]([A-Za-z]{2})\b/.exec(navigator.language || ''); if (m) return m[1].toUpperCase(); } catch (e) {}
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ2CC[tz]) return TZ2CC[tz]; } catch (e) {}
    return 'XX';
  }
  const flag = cc => (!cc || cc === 'XX') ? '🌐' : String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));

  // ---- local record (immediate, no network) --------------------------------
  function record(score) {
    score = Math.max(0, score | 0); if (!score) return;
    Save.update(d => { d.lb.latest = score; if (score > d.lb.best) d.lb.best = score; });
    Events.emit('lb:local', { latest: score, best: Save.get('lb.best', 0) });
  }
  const best = () => Math.max(Save.get('lb.best', 0), Store.best());

  // ---- sync windows ----------------------------------------------------------
  function windowKey(now = new Date()) {
    const n = Math.max(1, CFG().SYNC_WINDOWS_PER_DAY || 2), h = 24 / n;
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}:${Math.floor(now.getHours() / h)}`;
  }
  const windowUsed = () => Save.get('lb.lastWindow', null) === windowKey();
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

  /** Sync if a window is open and unused. Resolves to the cached view (fresh or old). Never throws. */
  function syncIfDue(reason = 'auto') {
    if (!Flags.get('leaderboard_enabled') || windowUsed() || !online()) return Promise.resolve(getCache());
    return sync(reason);
  }
  /** Force a sync now (QA / tests). One in-flight request at a time. */
  function sync(reason = 'manual') {
    if (inflight) return inflight;
    const p = profile(), score = best(), serverBest = Save.get('lb.serverBest', 0);
    const req = { uid: p.uid, name: p.name, country: p.country, score: score > serverBest ? score : 0 };   // 0 = read-only, don't write
    calls++;
    const gen = Save.generation;          // if the save is reset/replaced while we're in flight, drop the result (don't resurrect a wiped doc)
    inflight = adapter().fetch(req).then(res => {
      if (!res || !res.world) throw new Error('bad response');
      if (Save.generation !== gen) return getCache();
      cache = { at: Date.now(), uid: p.uid, ...res }; setCache(cache);
      Save.update(d => { d.lb.lastWindow = windowKey(); d.lb.lastSyncAt = Date.now(); if (req.score) d.lb.serverBest = Math.max(d.lb.serverBest || 0, req.score);
        d.lb.rank = { world: res.world.rank || 0, country: res.country.rank || 0 }; });
      Analytics.track('lb_sync', { reason, uploaded: !!req.score, worldRank: res.world.rank, countryRank: res.country.rank });
      Events.emit('lb:synced', { cache });
      return cache;
    }).catch(e => { console.warn('[Leaderboard] sync failed', e); return getCache(); }).finally(() => { inflight = null; });
    return inflight;
  }

  // ---- cache -----------------------------------------------------------------
  function getCache() { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(CACHE_KEY()) || 'null'); } catch (e) { cache = null; } return cache; }
  function setCache(c) { try { localStorage.setItem(CACHE_KEY(), JSON.stringify(c)); } catch (e) {} }
  function clearCache() { cache = null; try { localStorage.removeItem(CACHE_KEY()); } catch (e) {} }

  /**
   * View model for the UI: everything the board needs, from cache + local best, synchronously.
   * My row always carries my LOCAL best (feels instant); rank comes from the last sync (or null = never synced).
   */
  function view(board = 'world') {
    const p = profile(), c = getCache(), b = c && c.uid === p.uid ? c[board] : null, my = best();
    const me = { rank: b && b.rank ? b.rank : null, uid: p.uid, name: p.name, score: my, country: p.country, me: true };
    const rows = r => ({ ...r, me: r.uid === p.uid, score: r.uid === p.uid ? my : r.score });
    const top = (b ? b.top : []).map(rows), around = (b ? b.around || [] : []).map(rows);
    const inTop = top.some(r => r.me);
    if (!inTop && !around.some(r => r.me)) around.push(me);       // never synced / not in slice → still show me
    around.sort((a, b2) => (a.rank || 1e12) - (b2.rank || 1e12));
    return { board, me, top, around: inTop ? [] : around, inTop, total: b ? b.total : null, country: p.country, flag: flag(board === 'country' ? p.country : null), synced: !!b };
  }

  // ---- adapters ----------------------------------------------------------------
  function adapter() { if (api) return api; api = CFG().ENDPOINT ? HttpAPI(CFG().ENDPOINT) : MockAPI(); return api; }
  function setAdapter(a) { api = a; }

  /** Real backend: Cloud Function `leaderboard` (firebase/functions/leaderboard.js). */
  function HttpAPI(url) {
    return { name: 'http', fetch: req => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }) };
  }

  /**
   * Mock backend: a deterministic simulated population so the whole flow (rank, neighbours, top 10)
   * works before Firebase exists. Score at rank r follows a power curve; rank(score) is its inverse.
   * The player is inserted at the correct position; ties resolve above (older score wins).
   */
  function MockAPI(opts = {}) {
    const LAT = opts.latency == null ? 350 : opts.latency;
    const POP = { world: { n: 48213, max: 9600, k: 3.2, seed: 11 }, country: { n: 3187, max: 8400, k: 3.0, seed: 47 } };
    const ADJ = ['Fluffy', 'Zoomy', 'Sleepy', 'Barky', 'Happy', 'Muddy', 'Snowy', 'Tiny', 'Wiggly', 'Sunny', 'Bouncy', 'Fuzzy'], NOUN = ['Beagle', 'Corgi', 'Pug', 'Husky', 'Poodle', 'Shiba', 'Lab', 'Collie', 'Boxer', 'Dane', 'Spitz', 'Akita'];
    const CCS = ['IN', 'US', 'BR', 'ID', 'GB', 'DE', 'JP', 'MX', 'PH', 'FR', 'KR', 'TR'];
    const h = (a, b) => { let x = (a * 374761393 + b * 668265263) >>> 0; x = ((x ^ (x >>> 13)) * 1274126177) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
    const scoreAt = (P, r) => Math.floor(P.max * Math.pow(Math.max(0, 1 - (r - 1) / P.n), P.k));   // non-increasing in r
    const rankOf = (P, s) => { let lo = 1, hi = P.n + 1; while (lo < hi) { const m = (lo + hi) >> 1; if (scoreAt(P, m) >= s) lo = m + 1; else hi = m; } return lo; };   // 1 + #bots with score ≥ s (ties: older wins)
    const bot = (P, r, cc) => ({ rank: r, uid: 'bot-' + P.seed + '-' + r, name: ADJ[h(P.seed, r) % 12] + ' ' + NOUN[h(r, P.seed) % 12], score: scoreAt(P, r), country: cc || CCS[h(P.seed + 1, r) % 12] });
    function board(P, req, cc) {
      const my = Math.max(req.score, req._known || 0), ranked = my > 0, myRank = ranked ? rankOf(P, my) : 0;   // score 0 = unranked (same as the Cloud Function)
      const me = { rank: myRank, uid: req.uid, name: req.name, score: my, country: req.country };
      const rowAt = r => ranked && r === myRank ? me : { ...bot(P, ranked && r > myRank ? r - 1 : r, cc), rank: r };   // bots after me shift down one place
      const top = []; for (let r = 1; r <= TOP; r++) top.push(rowAt(r));
      const around = [];
      if (ranked && myRank > TOP) { const lo = Math.max(TOP + 1, myRank - ABOVE), hi = Math.min(P.n + 1, myRank + BELOW); for (let r = lo; r <= hi; r++) around.push(rowAt(r)); }
      return { top, rank: myRank, total: P.n + (ranked ? 1 : 0), around };
    }
    const known = {};   // server-side memory of this uid's best (persists for the session only — real server keeps it in Firestore)
    return { name: 'mock', fetch: req => new Promise(res => setTimeout(() => {
      known[req.uid] = Math.max(known[req.uid] || 0, req.score | 0);
      const r = { ...req, _known: known[req.uid] };
      res({ world: board(POP.world, r), country: { code: req.country, ...board(POP.country, r, req.country) } });
    }, LAT)) };
  }

  // ---- wiring -------------------------------------------------------------------
  function init() {
    Events.on('progress', ({ score }) => { record(score); syncIfDue('run_end'); });   // every run: local first, server only if a window is open
    Events.on('save:reset', () => { clearCache(); api = null; });
    if (typeof window !== 'undefined') window.addEventListener('online', () => syncIfDue('online'));
    syncIfDue('boot');
  }

  return { init, record, best, view, syncIfDue, sync, windowKey, windowUsed, getCache, clearCache, profile, flag, setAdapter, MockAPI, HttpAPI, get calls() { return calls; }, get adapterName() { return adapter().name; } };
})();
