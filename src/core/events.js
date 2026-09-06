/**
 * BONK! — Tiny event bus (pub/sub)
 * ---------------------------------------------------------------
 *   Events.on('coins', ({ coins, delta, reason }) => …)   → returns an unsubscribe fn
 *   Events.emit('coins', payload)
 * Used to decouple systems: Wallet → HUD/menu counters, Save → cloud sync (later),
 * Analytics sinks, etc. Handlers never throw into the emitter.
 */
const Events = (() => {
  const map = new Map();
  function on(name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); return () => off(name, fn); }
  function off(name, fn) { const s = map.get(name); if (s) s.delete(fn); }
  function emit(name, payload) { const s = map.get(name); if (!s) return; for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error(`[Events:${name}]`, e); } } }
  return { on, off, emit };
})();
