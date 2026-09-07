# BONK! — 7 Phases to Launch
_Created 2026-09-05 · starts from v0.8.2 · execution view of `LAUNCH_PLAN.md`_

Each phase = one shippable build with a version number, a test link, a "done when" list, and what I need from you.
Phases 1–4 are pure code (I can run them back-to-back). Phases 5–7 depend on accounts/keys and real-device testing.

```
P1 Foundation ─► P2 Core Fun ─► P3 Content ─► P4 Meta & Screens ─► P5 Backend ─► P6 Android+Money ─► P7 Launch
   v0.9.0          v0.9.5         v0.10         v0.11               v0.12          v1.0-rc            v1.0
   ~1 session      ~2 sessions    ~2 sessions   ~3 sessions         ~2 sessions    ~2–3 sessions      ~2 sessions + 14-day test
```

---

## Phase 1 — Foundation  (`v0.9.0`) ✅ DONE
**Goal:** data & save layer solid before anything is built on it.

Build
- Save v2: single `bonk_save` object with `schemaVersion`, migration from `bonk_levels` / `bonk_coins`, atomic write, corruption fallback
- Levels → JSON (`data/levels/L01.json` …): spawn table, speeds, hazards, goal, reward, ambient preset; loader + validator
- Wallet module (coins, stars) with bounded add/spend and change events
- Local analytics ring-buffer (`analytics.track(event, props)`), export from Settings, event list from LAUNCH_PLAN §3.4
- Feature-flag module (`flags.js`) reading local defaults now, Remote Config later
- Playwright regression script: menu / levels / game / pause / win / lose screenshots on 3 sizes

Done when
- [x] Old saves migrate with no loss (tested with seeded localStorage)
- [x] All 3 existing levels load from JSON and play identically
- [x] `Analytics.export()` returns the events of a full run
- [x] Regression script runs green in one command (`python3 tools/check.py`)

From you: nothing.

---

## Phase 2 — Core Fun (M1 mechanics)  (`v0.9.5`) ✅ DONE (code) — playtest #1 pending
**Goal:** the 60–90 s run is addictive on its own.

Build
- Combo ×1→×5 (consecutive catches), paw-chain HUD, any hit resets; multiplies bone score only
- Near-miss "Phew!" detection + small coin bonus + puppy voice
- Instant retry on lose; result screens show stars, coins earned, max combo, "new best"
- Golden bone (+50, rare) and shield biscuit (absorbs one hit) items
- FTUE: hint hand / catch / dodge cues in the first 20 s of L1, once per save
- Difficulty knobs exposed in level JSON (spawn rate curve, hazard ratio, fall speed)

Done when
- [x] Combo reaches ×5 (16 catches); a rock hit or dropped bone resets it visibly
- [x] FTUE shows once, never again; re-enabled via Settings → Reset progress
- [x] Zero console errors on 3 viewports
- [ ] **Playtest #1** (you + 3–5 friends): "would you replay?" ≥ 60 % yes

From you: 30 min playtest + feedback (which level, what felt unfair, was combo understood).

---

## Phase 3 — Content (levels 4–10)  (`v0.15` — 3 locations × 3 acts shipped 2026-09-07; music + playtest balance open)
**Goal:** the level board is full and the curve feels right.

Build
- Levels 4–10 in JSON with names, targets, 3-star goals, thumbnails
- New mechanics: wind gusts (L6+), thief squirrel (L8+), faster/mixed hazard waves (L9–10)
- Ambient life per level following the location rule (still behind the fence, subtle)
- Music loop (meadow) + SFX mix pass; music/SFX sliders
- Balance pass from Playtest #1 data

Done when
- [x] All 10 levels have 3 achievable stars (verified by `tools/sim_levels.py`; your play next)
- [ ] No level with > 25 % quit rate in playtest
- [x] Board shows 10 real tiles, page 2 empty/"more soon"

From you: optional music track (or I use a generated/royalty-free loop); Playtest #2 later in P4.

---

## Phase 4 — Meta & All Screens (M2-lite)  (`v0.11`)
**Goal:** every screen of the final game exists and is navigable; monetization flows run on mocks.

Build
- Daily bonus ladder (7 days, soft streak) + popup
- Daily Remix: seeded level + modifiers, ghost best, once-a-day reward, countdown
- Shop: Skins tab (5 skins as overlays, live preview on idle animation, equip), Remove Ads card, Bonk Club card (benefits, price, "coming on Android" on web)
- Profile: name, equipped skin, stars, coins, streak, sign-in placeholder, Restore
- Settings: music, SFX, vibration, EN/HI toggle, privacy/ToS links, consent, credits, version, reset progress, FTUE reset, analytics export
- Mock ad layer (fake rewarded/interstitial panels) with the real placement rules; mock store (buy/restore/revoke)
- Android hardware-back semantics (history stack), offline banner, rate-us prompt logic
- PWA: manifest, icons, service worker (offline play), install prompt

Done when
- [ ] Navigation map in LAUNCH_PLAN §2 fully reachable, no dead ends, back works everywhere
- [ ] Buy skin → equip → visible in game; Remove Ads (mock) suppresses interstitials; revoke restores them
- [ ] Installs as PWA and plays offline
- [ ] **Playtest #2** on the link: full flow from first launch to level 5 without confusion

From you: skin ideas/preferences (colours, hats), final names & prices, Playtest #2. **Start creating accounts now** (see P5/P6 lists) if not done.

---

## Phase 5 — Backend (Firebase)  (`v0.12`)
**Goal:** progress and entitlements live in the cloud; tuning without redeploy.

Build
- Firebase Auth: anonymous on first launch → Google link in Profile (merge rule: keep higher)
- Firestore cloud save (v2 blob, `updatedAt`, conflict policy) + security rules + rules unit tests
- Remote Config: flags, ad cadence, prices, level multipliers, min version; local fallback
- Analytics → GA4 (same events as the local buffer); JS error capture
- Cloud Functions: `claimDaily` (server time), `verifyRazorpayPayment`, `verifyPlayPurchase`, `playRtdn`; emulator tests
- Firebase Hosting deploy pipeline (`npm run deploy`), cache headers
- Razorpay web checkout for Remove Ads + paid skins (test mode)

Done when
- [ ] Uninstall/reinstall (clear storage) → sign in with Google → progress restored
- [ ] Entitlement written only by Functions; client write rejected by rules test
- [ ] Toggling `ads_enabled` in Remote Config changes the live app within a session
- [ ] Razorpay test purchase grants Remove Ads on web

From you: Firebase project (Blaze + ₹500 budget alert) with Auth/Firestore/RC/Analytics/Hosting/Functions enabled; web config; Razorpay test keys; a domain (optional).

---

## Phase 6 — Android + Real Money & Ads  (`v1.0-rc`)
**Goal:** real APK/AAB with AdMob, Play Billing and subscription.

Build
- Capacitor Android project: splash, adaptive icon, portrait lock, immersive, keep-awake, lifecycle → pause
- AdMob via plugin (test IDs), UMP consent, rewarded + interstitial wired to the mock layer's interface
- Google Play Billing: `remove_ads`, 2 paid skins, 2 coin packs, `bonk_club_monthly` (7-day trial) → Functions verification; Restore; RTDN for subscription state
- Crashlytics + Firebase Analytics native SDK
- Low-end performance pass (target 60 fps on a 2019 budget phone), APK size < 30 MB
- Internal testing track upload + fix native-only bugs

Done when
- [ ] Sandbox purchase, restore, refund-revoke, subscription trial→active→cancel all reflected in entitlements
- [ ] Test ads show; consent flow passes; Remove Ads / Club users see no interstitials
- [ ] Crash-free ≥ 99 % across internal testers, 60 fps on the low-end device

From you: Play Console account (ID verification), package name & studio name, `google-services.json`, AdMob app + 2 ad-unit IDs, SKUs created in Play Console with my IDs, 12–20 testers' Gmail addresses, one low-end Android phone to test on.

---

## Phase 7 — Launch  (`v1.0`)
**Goal:** closed test → soft launch, with everything measurable.

Build / do
- Balance & FTUE fixes from closed-test analytics (funnel L1→L5, retry rate, ad ARPDAU, conversion)
- Store listing: icon, feature graphic, 8 screenshots, 30 s gameplay video, description EN/HI
- Privacy policy + ToS pages, Data-safety form, content rating, ads declaration
- Live AdMob IDs, production Remote Config values, Razorpay live keys
- Release notes, `docs/` final update, tag `v1.0`
- Post-launch dashboard: D1/D7, level funnel, ad/IAP revenue, crash rate → feeds the M3 gate

Done when
- [ ] Play closed test: ≥ 12 testers, 14 days, no blocking bugs
- [ ] All LAUNCH_PLAN §5 checklist items ticked
- [ ] Production access granted → web soft launch + Play release (staged 20 % → 100 %)

From you: store copy approval, final prices, the 14-day wait, and playing it a lot.

---

## Time reality
| | My active work | Calendar |
|---|---|---|
| P1–P4 (all code, mocks) | ~18–25 h ≈ 8–10 sessions | ~1 week if we do 1–2 sessions/day |
| P5–P6 (needs keys) | ~10–14 h ≈ 4–5 sessions | ~1 week after accounts exist |
| P7 | ~4–6 h | **14-day closed test** dominates |

**Critical path is not code: create the Play Console, Firebase, AdMob and Razorpay accounts during P1–P2 so P5–P7 aren't waiting.**

## Cut list (if time is short) — in order of what goes first
Bonk Club subscription (ship Remove Ads + skins only) → thief squirrel → Hindi toggle → Daily Remix ghost (keep the daily level) → coin packs → levels 9–10 (ship 8)
