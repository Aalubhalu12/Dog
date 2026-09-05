/**
 * BONK! — Analytics: local ring buffer + pluggable sinks
 * ---------------------------------------------------------------
 *   Analytics.track('level_start', { id: 2 })
 *   Analytics.addSink(fn)          // Phase 5: fn = (name, props) => firebase.analytics().logEvent(name, props)
 *   Analytics.export()             // JSON string of the buffered events (Settings → "Export log")
 *   Analytics.summary()            // quick funnel numbers for playtests
 *
 * Every event carries: ev (name), t (ms since epoch), s (session id), sid (seconds since session start), ver — these reserved keys override props.
 * The last MAX events persist in localStorage (key <prefix>alog) so a playtest log survives reloads.
 *
 * Event catalogue (keep in sync with docs/LAUNCH_PLAN.md §3.4):
 *   session_start · level_start{id,idx,plays} · level_end{id,result,score,stars,starsN,coins,bones,duration,heartsLost,combo?}
 *   retry{id} · continue{from,to} · quit{id,at} · pause · ftue_step{step} · daily_claim · ad_shown · ad_reward
 *   shop_open · purchase · skin_equip · coins_earned · coins_spent · setting{key,value} · error{msg}
 */
const Analytics = (() => {
  const MAX = 500, KEY = () => CONFIG.STORAGE_PREFIX + 'alog';
  const sinks = []; let buf = [], session = Math.random().toString(36).slice(2, 8), t0 = Date.now(), debug = false;

  try { buf = JSON.parse(localStorage.getItem(KEY()) || '[]'); if (!Array.isArray(buf) || (buf.length && !buf[0].ev)) buf = []; /* drop pre-0.9.5 logs */ } catch (e) { buf = []; }
  let persistTimer = null;
  const persist = () => { persistTimer = null; try { localStorage.setItem(KEY(), JSON.stringify(buf.slice(-MAX))); } catch (e) {} };

  function track(name, props = {}) {
    const ev = { ...props, ev: name, t: Date.now(), s: session, sid: Math.round((Date.now() - t0) / 1000), ver: CONFIG.VERSION };   // reserved keys win over props
    buf.push(ev); if (buf.length > MAX) buf = buf.slice(-MAX);
    if (!persistTimer) persistTimer = setTimeout(persist, 250);
    if (debug) console.log('[analytics]', name, props);
    for (const s of sinks) { try { s(name, props, ev); } catch (e) { console.warn('[analytics sink]', e); } }
    return ev;
  }
  function addSink(fn) { sinks.push(fn); return () => { const i = sinks.indexOf(fn); if (i >= 0) sinks.splice(i, 1); }; }
  function events(filter) { return filter ? buf.filter(e => e.ev === filter) : buf.slice(); }
  function clear() { buf = []; persist(); }
  function exportJSON() { return JSON.stringify({ exportedAt: new Date().toISOString(), version: CONFIG.VERSION, session, events: buf }, null, 0); }

  /** Numbers you want after a playtest: starts/ends per level, win rate, retries, avg duration. */
  function summary() {
    const by = {}; const L = id => by[id] || (by[id] = { starts: 0, wins: 0, losses: 0, retries: 0, dur: 0, ends: 0, stars: 0 });
    for (const e of buf) {
      if (e.ev === 'level_start') L(e.id).starts++;
      if (e.ev === 'level_end') { const l = L(e.id); l.ends++; l.dur += e.duration || 0; l.stars += e.starsN || 0; e.result === 'win' ? l.wins++ : l.losses++; }
      if (e.ev === 'retry') L(e.id).retries++;
    }
    for (const id in by) { const l = by[id]; l.winRate = l.ends ? +(l.wins / l.ends).toFixed(2) : 0; l.avgDuration = l.ends ? Math.round(l.dur / l.ends) : 0; l.avgStars = l.ends ? +(l.stars / l.ends).toFixed(2) : 0; delete l.dur; }
    return { sessions: new Set(buf.map(e => e.s)).size, events: buf.length, levels: by };
  }

  // global JS errors → log (Phase 5 forwards to Crashlytics / GA4)
  if (typeof window !== 'undefined') {
    window.addEventListener('error', e => track('error', { msg: String(e.message).slice(0, 160), src: String(e.filename || '').split('/').pop(), line: e.lineno }));
    window.addEventListener('unhandledrejection', e => track('error', { msg: String(e.reason && e.reason.message || e.reason).slice(0, 160) }));
  }

  return { track, addSink, events, clear, export: exportJSON, summary, get session() { return session; }, set debug(v) { debug = !!v; } };
})();
