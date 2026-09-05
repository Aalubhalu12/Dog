# Simulated playtest — v0.9.5 (2026-09-05)

**How:** `tools/sim_play.py` — a scripted player reads the game state every frame, steers toward the highest-value falling item and away from hazards, and plays through the *real* UI (menu → countdown → win card → NEXT LEVEL → game over → R retry). A second run (`sim2`) played L2 and L3 twice each with a stronger look-ahead bot. Headless Chromium 390×844, fresh save.

## Checklist (23 checks, 21 ✅ / 2 ✗ — both ✗ are difficulty results, not bugs)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Menu loads, PLAY shows *Level 1* | ✅ | |
| 2 | Fresh save: 0 stars, 0 coins | ✅ | |
| 3 | Levels loaded from JSON (3) | ✅ | |
| 4 | L1 countdown → running | ✅ | |
| 5 | FTUE bubble shown for a new player | ✅ | `ftue_step: move` (then catch, dodge, combo) |
| 6 | L1 bot outcome | ✅ win | 440/400 in 29 s, 3 lives, **combo ×5 (16)**, 3★ |
| 7 | L1 win card: stars, saved, L2 unlocked | ✅ | "Perfect! 🌟 · Best combo ×5 (16) · ▶ LEVEL 2" |
| 8 | L2 countdown → running (via NEXT LEVEL) | ✅ | |
| 9 | L2 bot outcome (simple bot) | ✗ lose | 810/900 in 41 s, combo ×4, 5 near misses, 2 shield saves |
| 10 | Instant retry with **R** restarts L2 | ✅ | game-over card closed, `retry{from:gameover}` |
| 11 | L2 retry outcome (simple bot) | ✗ lose | — |
| 12 | Bot ran (2 567 frames, 377 dodges) | ✅ | |
| 13 | Analytics: `level_start`/`level_end` per run | ✅ | `1:win:3★ 2:lose:0★ 2:lose:0★` |
| 14 | Analytics: combo steps / breaks logged | ✅ | steps 12, breaks 6 |
| 15 | FTUE marked done after L1 | ✅ | `ftue_done` ×1 |
| 16 | Coins persisted to wallet | ✅ | 29 |
| 17 | Reload: progress persisted | ✅ | 3★, unlocked 2, PLAY = "Level 2 · Rocky Road", 3/9 |
| 18 | Level board reflects progress | ✅ | 1 done (3★), 1 current, 8 locked |
| 19 | Pause (Esc) → Resume | ✅ | |
| 20 | Pause → Level board, `quit` logged | ✅ | |
| 21 | Settings opens with Export / Reset rows | ✅ | |
| 22 | Render loop alive | ✅ | headless rAF ~29/s (throttled; not device fps) |
| 23 | **Zero console / page errors for the whole session** | ✅ | |

### Stronger bot (look-ahead) — L2 / L3, two runs each
| Level | Run 1 | Run 2 |
|---|---|---|
| L2 | **win** 930 in 49 s · 1 heart lost · combo ×5 · 2 near · 1 shield · ★★ (1,3) | **win** 900 in 55 s · 1 heart lost · combo ×5 · 6 near · ★★ (1,3) |
| L3 | lose 800/1500 in 57 s · combo ×4 · 3 near · 2 shields | lose 470 in 32 s · combo ×3 |

## Features verified during the sim (seen in screenshots `docs/screenshots/sim_*.jpg`)
- Combo paw-chain fills, steps ×2…×5, banner + gold badge at ×5, "COMBO LOST" on break
- Shield bubble on puppy + HUD badge; absorbs a rock (lives unchanged, `shield_save`)
- "PHEW!" + coin on near misses; gold bone sparkle; magnet timer badge
- Win card: 3 stars pop, goal rows, extras pill (best combo); game-over card: extras pills (combo, near misses, shield saves, % of target), NEW BEST
- Level board: L1 yellow 3★, L2 blue current, details card with Best 440

## Findings → actions
1. **No bugs.** All flows, persistence and analytics behave; zero errors across ~6 minutes of simulated play.
2. **Difficulty curve:** L1 is a clean tutorial win; L2 needs real dodging (a reactive bot dies at 90 %, a look-ahead bot wins with 1 heart lost); **L3 is too hard** — even the better bot dies at ~50 % with 3 hearts lost in ~45 s. Recommendation for Phase 3: L3 → target 1 300, bombs 14→11, speed end 0.65→0.60; keep it as the "wall" of the first 3 but not a brick wall. Confirm with human playtest before changing.
3. **★2 (no heart lost) is the rare star** on L2/L3 — good: that's the mastery star.
4. Combo ×5 is reachable in every level (bots hit it in L1 and L2) — the chain length (4 per step) feels right; a human will break it more often than the bot, which is intended.

Human playtest #1 still needed for "is it fun" (retry desire, clarity of combo, fairness feel) — the gate for Phase 2.
