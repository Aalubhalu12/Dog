// Contract test for the `leaderboard` Cloud Function with an in-memory Firestore stub.
//   node --test firebase/functions/test/
// Verifies: bounded queries only (no full-collection get), response shape == client MockAPI shape,
// 7-above/me/5-below, top-10 dedupe, write only on improvement, World/Country separation.
const test = require('node:test'), assert = require('node:assert'), Module = require('module');
const store = { lb_world: new Map(), lb_country: new Map() }, log = [];
class Q { constructor(col, f = [], o = [], l = 0) { Object.assign(this, { col, f, o, l }); }
  where(k, op, v) { return new Q(this.col, [...this.f, [k, op, v]], this.o, this.l); }
  orderBy(k, d = 'asc') { return new Q(this.col, this.f, [...this.o, [k, d]], this.l); }
  limit(n) { return new Q(this.col, this.f, this.o, n); }
  _rows() { let r = [...store[this.col].values()]; for (const [k, op, v] of this.f) r = r.filter(x => op === '==' ? x[k] === v : op === '>' ? x[k] > v : x[k] < v);
    for (const [k, d] of [...this.o].reverse()) r.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (d === 'desc' ? -1 : 1)); return r; }
  count() { return { get: async () => { log.push({ col: this.col, agg: true }); return { data: () => ({ count: this._rows().length }) }; } }; }
  async get() { if (!this.l) throw new Error('UNBOUNDED QUERY on ' + this.col); const rows = this._rows().slice(0, this.l); log.push({ col: this.col, limit: this.l, got: rows.length }); return { docs: rows.map(d => ({ data: () => d })) }; }
  doc(id) { const col = this.col; return { async get() { const d = store[col].get(id); return { data: () => d }; }, async set(d) { store[col].set(id, { ...d, at: store[col].get(id)?.at ?? Date.now() }); } }; } }
const stubs = {
  'firebase-functions/v2/https': { onRequest: (opts, fn) => fn },
  'firebase-admin/app': { initializeApp() {} },
  'firebase-admin/firestore': { getFirestore: () => ({ collection: c => new Q(c) }), FieldValue: { serverTimestamp: () => Date.now() } },
};
const orig = Module._load; Module._load = (req, ...a) => stubs[req] || orig(req, ...a);
const { leaderboard } = require('../leaderboard.js');
const call = async body => { let out, code = 200; const res = { status(c) { code = c; return res; }, send(x) { out = x; }, json(x) { out = x; }, set() { return res; } }; await leaderboard({ method: 'POST', body }, res); return { code, out }; };
const seed = (n, cc, max) => { for (let i = 1; i <= n; i++) { const d = { uid: `b${cc}${i}`, name: `Bot ${i}`, country: cc, score: max - i * 10, at: i }; store.lb_world.set(d.uid, d); store.lb_country.set(`${cc}_${d.uid}`, d); } };
seed(500, 'IN', 9000); seed(500, 'US', 9500);

test('mid-pack player: bounded queries, 7 above + me + 5 below, world vs country', async () => {
  log.length = 0;
  const { out } = await call({ uid: 'me', name: 'Tester', country: 'IN', score: 5005 });   // world: 400 US + 400 IN above ... 
  assert.equal(out.world.top.length, 10); assert.ok(out.world.top.every(r => r.country === 'US'));
  assert.ok(out.world.rank > 10); assert.equal(out.world.around.length, 13);
  assert.equal(out.world.around[7].uid, 'me'); assert.equal(out.world.around[7].rank, out.world.rank);
  assert.deepEqual(out.world.around.map(r => r.rank), Array.from({ length: 13 }, (_, i) => out.world.rank - 7 + i));
  for (let i = 0; i < 12; i++) assert.ok(out.world.around[i].score >= out.world.around[i + 1].score);
  assert.equal(out.country.code, 'IN'); assert.ok(out.country.top.every(r => r.country === 'IN') && out.country.around.every(r => r.country === 'IN'));
  assert.notEqual(out.country.rank, out.world.rank);
  assert.ok(log.every(q => q.agg || q.limit <= 10), 'every doc query has limit ≤ 10');
  assert.ok(log.filter(q => !q.agg).reduce((s, q) => s + q.got, 0) <= 2 * (10 + 7 + 5), 'total docs read ≤ 44');
  assert.equal(store.lb_world.get('me').score, 5005, 'written');
});
test('score 0 is read-only; lower score does not overwrite; higher does', async () => {
  const s0 = store.lb_world.get('me').score;
  await call({ uid: 'me', name: 'Tester', country: 'IN', score: 0 }); assert.equal(store.lb_world.get('me').score, s0);
  await call({ uid: 'me', name: 'Tester', country: 'IN', score: 100 }); assert.equal(store.lb_world.get('me').score, s0);
  const { out } = await call({ uid: 'me', name: 'Tester', country: 'IN', score: 5006 }); assert.equal(store.lb_world.get('me').score, 5006); assert.equal(out.world.around[7].score, 5006);
});
test('player inside top 10: no around slice, no duplicate', async () => {
  const { out } = await call({ uid: 'me', name: 'Tester', country: 'IN', score: 9485 });
  assert.equal(out.world.rank, 2); assert.equal(out.world.around.length, 0); assert.equal(out.world.top.filter(r => r.uid === 'me').length, 1);
  assert.equal(out.country.rank, 1);
});
test('validation', async () => {
  assert.equal((await call({ uid: '', score: 5 })).code, 400);
  const { out } = await call({ uid: 'x<y', name: '<script>bad</script>', country: 'zz1', score: -5 });
  assert.equal(out.country.code, 'XX'); assert.equal(out.world.rank, 0);
});
