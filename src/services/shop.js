/**
 * BONK! — Shop catalogue + mock store + entitlements (Phase 4 — everything runs on mocks)
 * ---------------------------------------------------------------
 * Products
 *   skins   – cosmetic only (PHASE2_PLAN: breeds/skins never carry stats). Bought with coins or ₹ (mock IAP).
 *   remove_ads – one-time; suppresses interstitials (Ads.js reads Shop.owns('remove_ads')).
 *   club    – subscription card: benefits + price shown; on web = "Coming on Android" (never purchasable here).
 * Store adapter: `Shop.setStore(adapter)` — Phase 5/6 swap the mock for Razorpay / Play Billing; entitlements then
 * come from the server. Shape: buy(product) → Promise<'ok'|'cancel'|'fail'>, restore() → Promise<string[]>.
 * Save: shop = { owned: [...ids], equipped: 'skinId', iap: [...ids] }
 */
const Shop = (() => {
  const SKINS = [
    { id: 'classic', name: 'Classic Beagle', emoji: '🐶', price: 0,   cur: 'free',  desc: 'The original good boy.' },
    { id: 'bandana', name: 'Red Bandana',    emoji: '🧣', price: 300, cur: 'coins', desc: 'Adventure-ready neckwear.' },
    { id: 'party',   name: 'Party Pup',      emoji: '🎉', price: 600, cur: 'coins', desc: 'Every catch is a celebration.' },
    { id: 'shades',  name: 'Cool Pup',       emoji: '😎', price: 79,  cur: 'inr',   desc: 'Too cool for rocks.', sku: 'skin_shades' },
    { id: 'crown',   name: 'Golden Bonk',    emoji: '👑', price: 0,   cur: 'club',  desc: 'Bonk Club exclusive.' },
  ];
  const IAP = {
    remove_ads: { id: 'remove_ads', name: 'Remove Ads', price: 149, desc: 'No interstitials, ever. Rewarded bonuses stay optional.' },
    club:       { id: 'club', name: 'Bonk Club', price: 99, per: 'month', trial: 7, benefits: ['No ads', '+50 coins every day', 'Golden Bonk crown', 'Club badge on the leaderboard'], note: 'No gameplay advantage — ever.' },
  };
  const doc = () => Save.get('shop', { owned: ['classic'], equipped: 'classic', iap: [] });
  const owns = id => doc().owned.includes(id) || (doc().iap || []).includes(id);
  const equipped = () => { const e = doc().equipped; return owns(e) ? e : 'classic'; };
  const skin = id => SKINS.find(s => s.id === id);
  const enabled = () => Flags.get('shop_enabled');

  // --- mock store: a 900 ms "payment sheet" that always succeeds (QA: ?mockpay=cancel|fail) -------------------
  const mockStore = {
    name: 'mock',
    buy: product => new Promise(res => setTimeout(() => { const q = new URLSearchParams(location.search).get('mockpay'); res(q === 'cancel' ? 'cancel' : q === 'fail' ? 'fail' : 'ok'); }, 900)),
    restore: () => new Promise(res => setTimeout(() => res(Save.get('shop.iap', [])), 600)),
  };
  let store = mockStore;

  function grant(id, how) { Save.update(d => { d.shop = d.shop || { owned: ['classic'], equipped: 'classic', iap: [] }; if (!d.shop.owned.includes(id)) d.shop.owned.push(id); if (how === 'iap' && !(d.shop.iap || (d.shop.iap = [])).includes(id)) d.shop.iap.push(id); }); Events.emit('shop', { id, how }); }

  /** Buy a skin with coins (sync) or an IAP product via the store adapter (async). Returns 'ok'|'short'|'cancel'|'fail'|'owned'|'locked'. */
  async function buy(id) {
    if (owns(id)) return 'owned';
    const sk = skin(id);
    if (sk && sk.cur === 'coins') { if (!Wallet.spend(sk.price, 'skin:' + id)) return 'short'; grant(id, 'coins'); Analytics.track('purchase', { id, cur: 'coins', price: sk.price }); return 'ok'; }
    if (sk && sk.cur === 'club') return 'locked';
    const product = sk ? { id, sku: sk.sku, price: sk.price } : IAP[id]; if (!product) return 'fail';
    Analytics.track('iap_start', { id, store: store.name });
    const r = await store.buy(product);
    if (r === 'ok') { grant(id, 'iap'); Analytics.track('purchase', { id, cur: 'inr', price: product.price, store: store.name }); }
    else Analytics.track('iap_' + r, { id });
    return r;
  }
  function equip(id) { if (!owns(id)) return false; Save.set('shop.equipped', id); Rig.setSkin(id); Events.emit('skin', { id }); Analytics.track('equip', { id }); return true; }
  async function restore() { const ids = await store.restore(); ids.forEach(id => grant(id, 'iap')); Analytics.track('restore', { n: ids.length }); return ids; }
  /** QA / support: take an entitlement away (mock store only) — verifies the ad layer re-enables. */
  function revoke(id) { Save.update(d => { d.shop.owned = d.shop.owned.filter(x => x !== id); d.shop.iap = (d.shop.iap || []).filter(x => x !== id); if (d.shop.equipped === id) d.shop.equipped = 'classic'; }); Rig.setSkin(equipped()); Events.emit('shop', { id, how: 'revoke' }); }

  function init() { Rig.setSkin(equipped()); }
  return { SKINS, IAP, owns, equipped, skin, buy, equip, restore, revoke, init, enabled, setStore: a => { store = a; }, get storeName() { return store.name; } };
})();
