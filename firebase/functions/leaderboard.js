/**
 * BONK! — Cloud Function `leaderboard` (Firestore, Node 20)
 * ---------------------------------------------------------------
 * POST { uid, name, country, score }  →  { world:{top,rank,total,around}, country:{code,top,rank,total,around} }
 * Same shape as the client's MockAPI (src/net/leaderboard.js). Client calls this only inside its daily sync windows.
 *
 * Data model — ONE small document per player, two collections (World and Country are kept separate):
 *   lb_world/{uid}            { uid, name, country, score, at }
 *   lb_country/{cc}_{uid}     { uid, name, country, score, at }       (partitioned by country code)
 * Indexes (firestore.indexes.json): lb_world(score desc), lb_country(country asc, score desc).
 *
 * Every query is bounded — the full collection is NEVER read:
 *   top10   : orderBy(score desc).limit(10)                         → 10 reads
 *   rank    : count() of score > mine (aggregation over the index)   → 1 aggregation read per 1000 index entries
 *   above   : score > mine, orderBy(score asc).limit(7)  (reversed)  → ≤7 reads
 *   below   : score < mine, orderBy(score desc).limit(5)             → ≤5 reads
 *   total   : count() of the collection                              → aggregation
 * If the player is inside the Top 10 the around-slice is skipped (no duplicates, minimal payload).
 * Write: only when incoming score > stored score (score:0 = read-only request).
 */
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();
const TOP = 10, ABOVE = 7, BELOW = 5;
const clean = s => String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 20);
const cc = s => /^[A-Z]{2}$/.test(String(s || '').toUpperCase()) ? String(s).toUpperCase() : 'XX';
const row = d => ({ uid: d.uid, name: d.name, score: d.score, country: d.country });

async function board(col, me, filter) {
  const myScore = me.score;
  const base = filter ? col.where('country', '==', filter) : col;
  const [topSnap, gtAgg, totalAgg] = await Promise.all([
    base.orderBy('score', 'desc').orderBy('at', 'asc').limit(TOP).get(),
    base.where('score', '>', myScore).count().get(),
    base.count().get(),
  ]);
  const rank = myScore > 0 ? gtAgg.data().count + 1 : 0, total = totalAgg.data().count;
  const top = topSnap.docs.map((d, i) => ({ rank: i + 1, ...row(d.data()) }));
  let around = [];
  if (rank > TOP) {
    const [up, down] = await Promise.all([
      base.where('score', '>', myScore).orderBy('score', 'asc').limit(ABOVE).get(),
      base.where('score', '<', myScore).orderBy('score', 'desc').limit(BELOW).get(),
    ]);
    const above = up.docs.map(d => row(d.data())).reverse().map((r, i, a) => ({ rank: rank - (a.length - i), ...r }));
    const below = down.docs.map((d, i) => ({ rank: rank + 1 + i, ...row(d.data()) }));
    around = [...above, { rank, ...me }, ...below];
  }
  return { top, rank, total, around };
}

exports.leaderboard = onRequest({ region: 'asia-south1', cors: true, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const uid = String(req.body.uid || '').slice(0, 40), name = clean(req.body.name) || 'Puppy', country = cc(req.body.country);
  const incoming = Math.max(0, Math.min(1e7, req.body.score | 0));
  if (!uid) return res.status(400).json({ error: 'uid required' });

  const wRef = db.collection('lb_world').doc(uid), cRef = db.collection('lb_country').doc(`${country}_${uid}`);
  const cur = (await wRef.get()).data();
  let score = cur ? cur.score : 0;
  if (incoming > score) {                          // one write per board, only on a real improvement
    score = incoming; const doc = { uid, name, country, score, at: FieldValue.serverTimestamp() };
    await Promise.all([wRef.set(doc), cRef.set(doc)]);
  }
  const me = { uid, name: cur ? cur.name : name, score, country };
  const [world, ctry] = await Promise.all([
    board(db.collection('lb_world'), me, null),
    board(db.collection('lb_country'), me, country),
  ]);
  res.set('Cache-Control', 'no-store').json({ world, country: { code: country, ...ctry } });
});
