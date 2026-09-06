# BONK! — Status & Next Steps
_Updated 2026-09-07 · current build **v0.14.0** (Phases 1–2 done, Phase 3 content shipped — music + playtest balance open) · roadmap reference: `PHASE2_PLAN.md` (locked v3)_

---

## ✅ Completed (v0.1 → v0.8.2)

### Core game (MVP — accepted)
- Catch/dodge loop: bones +10, coins +1, magnet, 2× star, rocks (BONK!, −heart), bombs (dizzy)
- 10 levels with 3 lives each (targets 400 → 3000), level-by-level ambient life (birds → villagers → cars)
- Phase 3 mechanics per level via `modifiers`: wind gusts (L6+), thief squirrel (L8+), hazard waves with one open lane (L9–10) — `src/game/mechanics.js`
- Balance sweep tool `tools/sim_levels.py` (every level, fresh save, real UI): all 10 clearable, 3 stars reachable
- Fixed-step 120 Hz simulation, smooth movement, camera pulled back, natural item falling
- Procedural puppy voice (yip / wuff / whine / whimper / paw steps) + item SFX

### Puppy (from your AI green-screen clips)
- Run 16 f · Idle 24 f · Yay 24 f · Bonk 24 f · Dizzy 24 f — all from the video, one generic sheet player
- Colour-graded to match logo/meadow, medium size (11–13.5 % of screen height), faster (edge-to-edge ≈ 1 s)
- Turn-flicker fixed, edge clamp follows body, drag-to-move on the field
- Reusable pipeline: `tools/build_puppy_sheets.py`, `tools/grade_puppy.py`, brief in `ANIMATION_BRIEF.md`

### Progression & UI
- **3-star objectives** per level (target · no heart lost · level goal), sticky, saved per level; live goal chip in HUD; stars + chimes on the win card
- **Level select board** (mockup-faithful): 5 × 2 wooden tiles, pages, thumbnails, details card, big Play
- Menu: PLAY continues from furthest level, LEVELS button with total stars
- "Premium casual" look: wood-framed cards, glossy buttons, icon rows on pause / game over / win
- Cache-busting (`?v=`), README / CHANGELOG / ADDING_CONTENT / ANIMATION_BRIEF kept current

### Phase 1 — Foundation (v0.9.0) ✅
- Save v2 (versioned doc + migration + backup/corrupt recovery), Wallet, Levels as JSON with validator, Analytics buffer + export, Flags, Events, Reset progress, extended `tools/check.py`

### Phase 2 — Core Fun (v0.9.5) ✅
- Combo ×1–×5 with paw-chain HUD, near-miss "Phew!", gold bone + shield biscuit, new goal types, richer result screens + instant retry, FTUE hints

### Infra
- Modular vanilla JS (no build step), server on :8080, public tunnel link for phone testing, Playwright screenshot checks

---

## 🔜 Next — see `LAUNCH_PLAN.md` (4-week M1+M2 → soft launch plan)

### M1 items (kept for reference)

Ordered by impact; each item is a self-contained ship.

| # | Item | Why | Size |
|---|------|-----|------|
| 1 | **Combo ×1→×5** with paw-chain UI (a hit resets) | Biggest missing fun multiplier; makes skilled play feel rewarded | M |
| 2 | **Levels 4–10** with a difficulty curve (spawn rate, hazard mix, new goal types) | Board shows 10 tiles; 7 are "coming soon" | M |
| 3 | **FTUE** — first 20 s of level 1 teaches drag/arrows, bone, rock, without text walls | First impression for new players | S |
| 4 | **Near-miss "Phew!"** + instant retry on game over | Cheap juice, proven retention helpers | S |
| 5 | **Local analytics log** (session, level start/end, stars, retries, deaths by item) | Required to measure the M1 gate | S |
| 6 | **Save v2** — schema version + migration (before any wallet/shop) | Prevents progress loss when data shape changes | S |
| 7 | Levels → JSON data (mechanics, goals, rewards) | Lets you add levels without touching code | S |
| 8 | Music loop (meadow) + proper SFX mix | Currently SFX only | M |

**M1 gate:** playtest with ~5 people — is it fun without village/chest/shop? (retry rate, voluntary replays from the analytics log)

---

## 🎨 Art still wanted from you (optional, same pipeline)
- Dedicated **idle clip** (¾ view, blink, tail wag) — current idle is the calm 0.8 s before the hop
- **Menu hero pose** clip (sitting, tongue out, looking at camera) to replace the logo puppy still
- Later per-world: Autumn / Night backgrounds in the same style as the meadow

---

## 🧭 After M1 (unchanged from the locked plan)
- **M2** world growth: levels 3–10 mechanics (wind, squirrel thief, puddles, boss crow), new items, Daily Remix, first Doghouse, music
- **M3** Dogs + Village: buildings, breed collection (no stats), Daily Bone Chest, cosmetics, share card
- **M4** more worlds · **M5** social · **Phase 3** monetization (never sell power)

---

## Known gaps / small polish backlog
- Level board side decorations (signposts, dog house) from the mockup — skipped so far to keep the parallax clean
- Settings: no separate music/SFX sliders yet (one sound toggle)
- Permanent hosting: GitHub Pages at https://aalubhalu12.github.io/Dog/ (repo Aalubhalu12/Dog); tunnels are only needed for testing uncommitted work
