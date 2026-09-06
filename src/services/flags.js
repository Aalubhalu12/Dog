/**
 * BONK! — Feature flags & remote-tunable values
 * ---------------------------------------------------------------
 *   Flags.get('ads_enabled')          → value (default from DEFAULTS)
 *   Flags.set('ads_enabled', false)   → runtime override (also honoured from ?flag_ads_enabled=0 in the URL for QA)
 *   Flags.apply({ ... })              → bulk update — Phase 5 calls this with Remote Config values
 * Flags never gate core play: if a value is missing everything falls back to DEFAULTS.
 */
const Flags = (() => {
  const DEFAULTS = Object.freeze({
    ads_enabled: false,          // Phase 4 mock ads / Phase 6 real ads
    interstitial_every: 3,       // game-overs between interstitials
    interstitial_min_level: 3,   // never before this level
    shop_enabled: false,         // Phase 4
    club_enabled: false,         // subscription card
    remix_enabled: false,        // Daily Remix
    daily_bonus_enabled: false,
    ftue_enabled: true,
    combo_enabled: true,         // Phase 2
    leaderboard_enabled: true,   // local-first leaderboard with daily sync windows
    paws_enabled: false,         // energy system — stays OFF (PHASE2_PLAN)
    analytics_debug: false,
    min_version: '0.0.0',
  });
  const overrides = {};
  // QA overrides from the URL: ?flag_shop_enabled=1&flag_interstitial_every=5
  try { new URLSearchParams(location.search).forEach((v, k) => { if (k.startsWith('flag_')) overrides[k.slice(5)] = v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : isNaN(+v) ? v : +v; }); } catch (e) {}

  const get = k => (k in overrides ? overrides[k] : DEFAULTS[k]);
  const set = (k, v) => { overrides[k] = v; Events.emit('flag', { key: k, value: v }); };
  const apply = obj => { for (const k in obj) set(k, obj[k]); };
  return { get, set, apply };
})();
