/**
 * BONK! — Daily bonus ladder (7 days, soft streak)
 * ---------------------------------------------------------------
 * One claim per local calendar day. Missing a day steps the ladder back ONE rung (never to zero) — the
 * "soft streak" locked in PHASE2_PLAN. Day 7 pays the big bone; the ladder then wraps to day 1.
 *   Daily.status()  → { day (1..7), claimable, streak, next (ms until next claim), ladder: [{day, coins, big}] }
 *   Daily.claim()   → { day, coins } | null   (adds coins through Wallet, reason 'daily')
 * Save: daily = { streak, last }  — `last` is the local date key 'YYYY-MM-DD' of the last claim.
 * Phase 5 moves the clock server-side (claimDaily Cloud Function) — the shape stays the same.
 */
const Daily = (() => {
  const LADDER = [20, 30, 40, 60, 80, 100, 200];                        // coins per day (cosmetic economy only)
  const key = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  const msToMidnight = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; };

  /** Streak the player is standing on right now (after applying the soft step-back for missed days). */
  function current() {
    const d = Save.get('daily', { streak: 0, last: null }), today = key();
    if (!d.last) return { streak: 0, claimedToday: false };
    const gap = daysBetween(d.last, today);
    if (gap <= 0) return { streak: d.streak, claimedToday: true };
    if (gap === 1) return { streak: d.streak, claimedToday: false };
    return { streak: Math.max(0, d.streak - 1), claimedToday: false };   // missed ≥1 day → back one rung, not to zero
  }
  function status() {
    // `day` = the rung being shown: today's claim if still open, otherwise the one just claimed (so the popup shows the tick, not tomorrow)
    const c = current(), day = (c.claimedToday ? (c.streak - 1) % 7 : c.streak % 7) + 1;
    return { day, claimable: !c.claimedToday, streak: c.streak, next: c.claimedToday ? msToMidnight() : 0,
      ladder: LADDER.map((coins, i) => ({ day: i + 1, coins, big: i === 6, done: c.claimedToday ? i < day : i < day - 1, today: i === day - 1 })) };
  }
  function claim() {
    const c = current(); if (c.claimedToday) return null;
    const streak = c.streak + 1, day = (streak - 1) % 7 + 1, coins = LADDER[day - 1];
    Save.set('daily', { streak, last: key() }); Wallet.add(coins, 'daily');
    Analytics.track('daily_claim', { day, streak, coins }); Events.emit('daily', { day, streak, coins });
    return { day, streak, coins };
  }
  return { status, claim, LADDER };
})();
