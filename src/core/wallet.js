/**
 * BONK! — Wallet (coins & later: other currencies)
 * ---------------------------------------------------------------
 *   Wallet.coins()                      → number
 *   Wallet.add(n, reason)               → new balance   (n clamped to 0..MAX_DELTA)
 *   Wallet.spend(n, reason)             → true/false    (never goes negative)
 *   Wallet.canAfford(n)
 * Every change: persisted in Save, emitted as Events 'coins' { coins, delta, reason },
 * and logged to Analytics ('coins_earned' / 'coins_spent') so the economy is measurable.
 * Bounds mirror the Firestore rule planned for Phase 5 (max +5000 per write).
 */
const Wallet = (() => {
  const MAX_DELTA = 5000, MAX_BALANCE = 9_999_999;
  const coins = () => Save.get('coins', 0) | 0;
  function add(n, reason = 'run') {
    n = Math.max(0, Math.min(MAX_DELTA, n | 0)); if (!n) return coins();
    const c = Math.min(MAX_BALANCE, coins() + n); Save.set('coins', c);
    Events.emit('coins', { coins: c, delta: n, reason });
    if (reason !== 'run') Analytics.track('coins_earned', { amount: n, reason, balance: c });   // in-run pickups are summarised in level_end
    return c;
  }
  function spend(n, reason = 'shop') {
    n = Math.max(0, n | 0); if (coins() < n) { Events.emit('coins:short', { need: n, have: coins(), reason }); return false; }
    const c = coins() - n; Save.set('coins', c);
    Events.emit('coins', { coins: c, delta: -n, reason }); Analytics.track('coins_spent', { amount: n, reason, balance: c });
    return true;
  }
  return { coins, add, spend, canAfford: n => coins() >= n, MAX_DELTA };
})();
