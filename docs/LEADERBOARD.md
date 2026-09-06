# Leaderboard — local-first, cached, daily-window sync

**Code:** `src/services/leaderboard.js` (client) · `src/ui/modals.js → leaderboard()` (UI) · `firebase/functions/leaderboard.js` (server)
**Tests:** `python3 tools/test_leaderboard.py` (26 browser checks) · `node --test firebase/functions/test/` (function contract, 4 tests)

## Rules
| Rule | Where |
|---|---|
| Every run's score is stored **locally immediately** (`Save.lb.latest/best`) via the existing `progress` event | `Leaderboard.record()` |
| **No upload per match.** The server is contacted at most once per **sync window** (`CONFIG.LEADERBOARD.SYNC_WINDOWS_PER_DAY`, default 2 → 00:00–11:59, 12:00–23:59 local) | `syncIfDue()` / `windowKey()` |
| Sync triggers only when a window is open & unused: boot, run end, board open, coming back online | `init()` |
| Upload sends the player's **best** only if it beats the server's stored best (`score:0` = read-only request) | `sync()` |
| Server returns **World Top 10 + Country Top 10 + my rank + 7 above + me + 5 below** per board. Inside Top 10 → no around slice, no duplicates | mock + Cloud Function |
| Last response cached in `localStorage bonk_lb_cache`; board opens from cache **synchronously**; my row always shows my **local** best so it feels instant; a sync landing while open re-renders naturally | `view()`, `Modals.leaderboard()` |
| No "updated X ago"/sync text in the UI | — |
| Flag `leaderboard_enabled` (default on). Off → local recording still works, zero network | `flags.js` |
| Reset progress clears local lb + cache | `save:reset` |

## Server (Firebase — Phase 5 wiring)
`firebase/` holds the Cloud Function, `firestore.indexes.json`, `firestore.rules`, `firebase.json`.
- Collections `lb_world/{uid}` and `lb_country/{cc}_{uid}` — **one small doc per player**, World and Country separate.
- Per request: `top10` (limit 10), `rank` = `count()` aggregation of `score > mine`, `above` (limit 7, reversed), `below` (limit 5), `total` count. **≤ 44 document reads per request**, never a full-collection scan (test asserts every query has a limit).
- Writes: only when incoming score > stored (1 doc per board).
- Clients can't read/write the collections directly (rules deny all; function uses admin SDK) — prevents fake scores by direct writes. Per-request rate limiting and App Check are still TODO for launch.
- To go live: deploy (`firebase deploy --only functions,firestore`), then set `CONFIG.LEADERBOARD.ENDPOINT` to the function URL. Request/response shape is identical to the mock, no client changes.

## Mock (today)
No backend yet → `MockAPI`: deterministic simulated population (World 48 213, Country 3 187, power-curve scores), 350 ms latency, remembers this uid's best for the session. Same response shape as the function.

## Known limitations
- Player name is auto (`Puppy XXXX`), country from `navigator.language` / timezone (no geo-IP). Name editing & Firebase Auth uid come with Phase 5 Profile.
- Ties: server orders by score desc, then earliest `at` (older score ranks higher); rank counts `score > mine` so tied players share a rank number in the count but are listed in `at` order.
- Mock population is fixed; the real board obviously changes between syncs — rank updates on the next window, by design.
