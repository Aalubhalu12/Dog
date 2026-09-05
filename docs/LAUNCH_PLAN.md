# BONK! — MVP Launch Plan (M1 + M2 → playable soft launch)
_Created 2026-09-05 · from v0.8.2 · target ≈ 4 weeks · Web PWA first, Android (Capacitor) right after_

**Decisions this plan is built on**
- Launch order: **Web/PWA link now → Android APK/AAB within weeks.** Same code base; Capacitor is a wrapper, not a rewrite.
- **4-week lean scope.** Everything not listed under "Launch scope" is cut or flagged OFF behind Remote Config.
- **I build all code** (game, Firebase rules/functions, Capacitor project, billing/ads plumbing with mocks). **You** create the accounts and paste keys (checklist at the bottom). I can't create Google/Firebase/AdMob accounts from here.
- Locked principles still apply: **never sell power**, breeds/skins are cosmetic only, timed objectives are stars not game-over, no energy wall.

---

## 1. Launch scope (what "ready to play" means)

| Area | In the MVP launch | Deferred (flag OFF / later) |
|------|-------------------|------------------------------|
| Levels | **10 levels** (Meadow), difficulty curve, 3-star goals each | Autumn/Night worlds, bosses |
| Mechanics | Combo ×1–×5, near-miss, 2 new items (golden bone +50, shield biscuit), wind (L6+), thief squirrel (L8+) | Puddles/frogs, fog, kites, boss crow |
| Retention | Daily Remix (seeded daily level, local ghost score), daily login bonus (coins), streak | Doghouse/village, chest with odds |
| Progression | Coins wallet, stars, furthest level, unlocks | Village buildings |
| Shop | **Skins** (5 puppy skins: coins or IAP), **Remove Ads** (one-time), **Bonk Club** subscription | Breed collection with rarity |
| Ads | Rewarded (revive ×1 / double coins), interstitial (every 3rd game over, never before L3), banner OFF | Offerwall |
| Backend | Firebase Auth (anonymous + Google link), Firestore cloud save, Remote Config, Analytics, Crashlytics (Android), Cloud Functions for purchase verification | Leaderboards (M5), friend links |
| Audio | 1 meadow music loop, SFX mix, separate music/SFX sliders | Per-world music |
| FTUE | First 20 s of L1 guided (no text walls), skip for returning players | Interactive tutorial level |
| Platform | PWA (installable, offline play), Android AAB (Capacitor) | iOS |
| Legal | Privacy policy, ToS page, consent (UMP for AdMob, GDPR/CCPA), age gate ≥13 or family-policy mode | — |

---

## 2. Screens & navigation (complete map)

```
Splash/Loader ─► Main Menu ─┬─► PLAY (continues furthest level) ─► Game HUD ─┬─► Pause ─► Resume / Restart / Levels / Menu
                            │                                              ├─► Win  ─► Next / Replay / Levels / (Double coins 📺)
                            │                                              └─► Lose ─► Revive 📺 (once) / Retry / Levels / Menu
                            ├─► LEVELS (board, pages, details, Play)
                            ├─► DAILY (Daily Remix card: modifiers, best/ghost, Play; countdown to next)
                            ├─► SHOP ─┬─► Skins tab (preview on puppy, coins or ₹, Equip)
                            │         ├─► Remove Ads (one-time)
                            │         └─► Bonk Club (subscription; benefits list, price, Restore)
                            ├─► PROFILE (name, avatar skin, stars, coins, streak, Google sign-in / link, Restore purchases)
                            └─► SETTINGS (music, SFX, vibration, language EN/HI, privacy, consent, credits, version, reset progress)
Overlays: Daily bonus popup (first launch/day) · Level-up/unlock toast · Not-enough-coins → shop · Offline banner · Consent dialog (first launch) · Rate-us (after 3rd win, once)
```

**Navigation rules**
- Every screen has a visible back and the Android hardware back is handled (back = same as back button; on menu = confirm exit).
- No dead ends: game over always offers Retry; shop always returns to where it was opened from.
- Any screen reachable in ≤2 taps from the menu. Purchases never interrupt the run.
- All screens work in phone portrait (390×844, 375×667) and the desktop 0.70 frame — verified by Playwright screenshots per release.

---

## 3. Systems to build

### 3.1 Gameplay (finish M1)
- Combo meter: consecutive catches ×1→×5, paw-chain UI in HUD, any hit resets; combo multiplies bone score only.
- Near-miss "Phew!" (rock passes within a small margin) + tiny coin bonus.
- Instant retry (no menu round-trip), result screens show stars + coins earned + combo max.
- Levels 4–10 as **JSON** (`data/levels/*.json`): spawn table, speeds, hazards, goal, reward, ambient preset. Curve tuned so L1–3 are learnable, L4–7 mid, L8–10 hard but fair.
- New items: golden bone (+50, rare), shield biscuit (absorbs one hit); wind gusts (items drift) from L6; squirrel steals a lying bone (visual only, L8+).
- FTUE: highlighted hints (drag hand, "catch!" arrow, "dodge!" arrow) tied to first spawns; auto-hidden once done, never repeated.
- Local analytics events (see 3.4) fired from the game core.

### 3.2 Meta (minimal M2)
- **Wallet**: coins (earned in runs, daily bonus, rewarded ads), stars. Save v2 with schema version + migration from the current `bonk_levels`/`bonk_coins` keys.
- **Daily Remix**: seed = date; picks a level + 1–2 modifiers (fast fall, bonus bones, no magnet, foggy edge); shows yesterday's best as ghost; reward coins once per day.
- **Daily bonus** ladder (7 days, small coins; day 7 = rare skin shard or bigger coins). Streak resets softly (miss a day → back one step, not to zero).
- **Skins**: 5 at launch — Classic Beagle (free), Bandana Red (coins), Party Hat (coins), Space Pup (₹), Golden Bonk (Club exclusive). Implemented as overlay layers on the existing sheets (no new animation needed) + palette swap for one. Preview live in the shop on the idle animation.

### 3.3 Monetization
| Product | Type | Price (India suggestion) | Grants |
|---------|------|--------------------------|--------|
| `remove_ads` | non-consumable | ₹149 | No interstitials, rewarded ads stay optional |
| `skin_space_pup`, `skin_ninja` | non-consumable | ₹79 each | Cosmetic skin |
| `coins_small/medium` | consumable | ₹49 / ₹149 | 500 / 2000 coins (cosmetic use only) |
| `bonk_club_monthly` | subscription | ₹99/mo (7-day trial) | Remove ads + 50 coins/day + Golden Bonk skin + Club badge; **no gameplay advantage** |

- Web: Razorpay one-time payments for remove-ads/skins (subscription **not** on web at launch — Club shown as "Coming on Android"). Android: Google Play Billing v6 via Capacitor plugin; subscription only there.
- **Entitlements are server-side**: Cloud Function verifies Play/Razorpay receipts → writes `users/{uid}/entitlements`. Client only reads. Restore purchases = re-read entitlements.
- Ads: AdMob through Capacitor (`@capacitor-community/admob`), UMP consent, test IDs until store review. Web build: ads mocked (a 3-second fake rewarded panel) so flows are testable in the link. Interstitial rules: not before level 3, not more than 1 per 3 minutes, never after a win with 3 stars, never for Remove-Ads/Club owners.

### 3.4 Backend (Firebase, Spark plan is enough for soft launch; Blaze needed for Cloud Functions)
- **Auth**: anonymous on first launch → optional Google link in Profile (keeps progress).
- **Firestore** `users/{uid}`: `profile`, `save` (v2 blob ≤ 50 KB, last-write-wins with `updatedAt`, conflict = keep higher stars/coins), `entitlements`, `daily` (streak, last claim), `remix/{date}` (best).
- **Security rules**: user can read/write only own doc; `entitlements` read-only for client; coin writes bounded by rule (max +5000 per write) to slow trivial cheating.
- **Cloud Functions**: `verifyPlayPurchase`, `verifyRazorpayPayment`, `playRtdn` (Play real-time subscription notifications), `claimDaily` (server time, prevents clock cheats), `remixSeed` (optional).
- **Remote Config**: feature flags (`ads_enabled`, `interstitial_every`, `club_enabled`, `remix_enabled`, `paws_enabled=false`), level tuning multipliers, shop prices, min app version.
- **Analytics** (Firebase/GA4 + local ring buffer for debugging): `session_start`, `level_start{id}`, `level_end{id,result,score,stars,combo_max,duration,deaths_by}`, `retry`, `remix_play`, `daily_claim{day}`, `ad_shown{type,placement}`, `ad_reward`, `shop_open`, `purchase{sku}`, `skin_equip`, `ftue_step`.
- **Crashlytics** (Android only) + JS error capture to Analytics on web.
- **Hosting**: Firebase Hosting for the PWA (custom domain later), cache headers, `?v=` busting retained.

### 3.5 Platform
- PWA: manifest, icons (192/512, maskable), service worker (precache game, network-first for config), install prompt in Settings.
- Capacitor Android: project in `android/`, splash + adaptive icon, portrait lock, immersive mode, hardware back, `Keep screen on`, plugins: AdMob, Google Play Billing, Firebase (Auth/Firestore/Analytics/Crashlytics), Haptics, App (lifecycle → pause game).
- Build outputs: signed AAB for Play internal testing, APK for direct sideload testing.

---

## 4. Week-by-week

### Week 1 — Gameplay complete (M1)
- D1–2: Save v2 + migration, levels → JSON, local analytics buffer
- D3–4: Combo + near-miss + instant retry, result-screen upgrades
- D5–6: Levels 4–10 + golden bone + shield + wind + squirrel; difficulty pass
- D7: FTUE; Playwright regression screenshots; **v0.9 "M1 complete"** link → **playtest #1 (5 people)**

### Week 2 — Meta + all screens (M2-lite)
- D8–9: Wallet, daily bonus ladder, Daily Remix (seeded, ghost)
- D10–11: Shop UI (skins tab, remove ads, Club card), 5 skins via overlays, Profile, Settings (music/SFX sliders, language toggle EN/HI, privacy)
- D12: Music loop + SFX mix; Android back handling; offline banner
- D13–14: Ads mock layer + placement rules; consent dialog; **v0.10 "all screens"** → **playtest #2**

### Week 3 — Backend + Android
- D15–16: Firebase project wiring (Auth anon+Google, Firestore save sync, rules, Remote Config, Analytics)
- D17: Cloud Functions (purchase verification, claimDaily, RTDN) + emulator tests
- D18–19: Capacitor Android project, AdMob real SDK (test IDs), Play Billing integration, Razorpay web checkout
- D20–21: Internal testing track upload; fix native-only bugs; **v1.0-rc1**

### Week 4 — Launch hardening
- D22–23: Balance from playtest data (levels, combo, ad cadence), FTUE fixes, performance on low-end Android (target 60 fps on a 2019 ₹8k phone)
- D24–25: Store listing (icon, 8 screenshots, feature graphic, 30 s video from gameplay), privacy policy + ToS pages, data-safety form, content rating
- D26: Live AdMob IDs + real SKUs, Remote Config production values, Crashlytics verified
- D27–28: Closed testing (20+ testers, Play's 14-day requirement for new personal accounts — **start early!**), soft launch on web link, **v1.0**

> ⚠️ Google Play now requires new personal developer accounts to run a **closed test with ≥12 testers for 14 days** before production access. Create the account **this week** so the clock runs during weeks 1–3.

---

## 5. Definition of "ready to launch" (checklist)
- [ ] 10 levels playable, each with 3 stars achievable; no level > 25 % quit rate in playtest
- [ ] Every menu screen in §2 exists, works on 375×667 and Android back, zero console errors
- [ ] Save syncs anon→Google link without loss; uninstall/reinstall restores progress
- [ ] Purchases: buy, restore, refund-revoke tested in Play sandbox; Razorpay test mode on web
- [ ] Ads: rewarded + interstitial with test IDs, consent flow, Remove-Ads honoured everywhere
- [ ] Remote Config kill-switches for ads/shop/remix verified
- [ ] Analytics events visible in Firebase DebugView; local log exportable from Settings
- [ ] Crash-free ≥ 99 % across internal testers; 60 fps on low-end test device
- [ ] Privacy policy URL, ToS, data-safety form, content rating done; app icon/splash/screenshots done
- [ ] Playtest #2 result: ≥ 60 % of testers voluntarily replay a level (M1 gate proxy)

---

## 6. What you need to do (accounts & keys) — I'll wire everything once these exist
1. **Google account for the game** (shared inbox, 2FA).
2. **Firebase project** `bonk-puppy` (Blaze plan, budget alert ₹500) → send me the web config + Android `google-services.json`. Enable Auth (Anonymous, Google), Firestore, Remote Config, Analytics, Hosting, Functions.
3. **Google Play Console** developer account ($25, needs ID verification — takes days) → app "BONK! Puppy Adventure", package `com.<yourstudio>.bonk`. Create the SKUs from §3.3 later when I give the exact IDs.
4. **AdMob account** (link to the Firebase project) → app ID + 2 ad unit IDs (rewarded, interstitial). Keep test mode until store approval.
5. **Razorpay account** (KYC) for web payments → test keys first.
6. **Domain** (optional, e.g. bonkpuppy.com) for Hosting + privacy policy.
7. Studio name, support email, and the final price points you want (I proposed ₹ values above).
8. 12–20 friends/testers with Gmail for the Play closed test.

Until keys arrive, everything runs against **mocks** (fake ads, fake store, local save) so the whole flow is testable in the web link from Week 2.

---

## 7. Out of scope for launch (explicitly)
Village & buildings, breed collection/chest, leaderboards, friend challenges, iOS, Autumn/Night worlds, bosses, Paws energy (flag stays OFF). These pick up in M3+ after launch data (D1/D7, ad ARPDAU, conversion) is in.
