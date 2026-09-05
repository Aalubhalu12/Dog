# Developer hand-over — read this first (15 min)

## 0. Run it
```bash
git clone <repo> && cd bonk
bash tools/serve.sh          # http://localhost:8080  (any static server works; not file://)
python3 tools/check.py       # smoke test — should print RESULT: PASS ✅
```
No build step, no npm, no framework. Plain HTML5 Canvas + JS + CSS. Everything under `assets/` is what ships (≈4 MB WebP).

## 1. Read in this order
| Doc | Why |
|---|---|
| `README.md` | structure, controls, rules, release checklist |
| `docs/STATUS.md` | what exists and what's next |
| `docs/ARCHITECTURE.md` | layers, frame flow, `Game.state`, events, storage, debug hooks |
| `docs/ADDING_CONTENT.md` | copy-paste recipes for levels / goals / items / power-ups / scenes |
| `docs/PHASES.md` → `docs/LAUNCH_PLAN.md` | the work plan (7 phases) and launch scope (shop, ads, Firebase, Android) |
| `docs/PHASE2_PLAN.md` | LOCKED design principles — do not violate (no selling power, timers are stars not game-over, no energy wall) |
| `docs/ANIMATION_BRIEF.md` + `art/README.md` | how the puppy animation is produced from AI clips |

## 2. Mental model
- `index.html` holds all screen markup; scripts load in dependency order at the bottom (`core → game → ui → scenes → app`).
- One global per file (`CONFIG`, `Store`, `Assets`, `SFX`, `Input`, `ITEMS`, `LEVELS`, `GOALS`, `Ambient`, `BG`, `FX`, `Puppy`, `Spawner`, `Game`, `HUD`, `Modals`, `MenuScene`, `MapScene`, `PlayScene`). Lower layers never reference higher ones.
- `app.js` runs a **fixed 120 Hz simulation** (max 12 steps/frame) and one render per rAF. Don't put game logic in render.
- Scenes = DOM glue. `Game` never touches the DOM (except `FX` which owns the `#fx` overlay).
- All sizes are relative to the stage (`cqmin/cqw` in CSS, fractions of `BG.W/BG.H` in canvas code) — the same code renders the phone-portrait stage and the desktop phone-frame.
- Data lives in `items.js`, `levels.js`, `goals.js`. Most content work never touches logic.

## 3. Conventions
- **Versioning:** bump `CONFIG.VERSION` → mirror in every `?v=` in `index.html` and README → CHANGELOG entry → `tools/check.py` green. `check.py` fails if they drift.
- **Assets:** drop PNG/JPG in `assets/images/<group>/`, run `tools/optimize_assets.py` (→ WebP), add a key in `src/core/assets.js`. Sprites ≤ 500 px, backgrounds ≤ 900 px wide.
- **Puppy art:** never hand-edit sheets. Regenerate from `art/clips` with `tools/build_puppy_sheets.py`, then (only for fresh sheets) `tools/grade_puppy.py`. Shipped sheets are already graded.
- **Ambient life:** stays behind the fence, subtle, progresses per level (L1 birds → L2 walkers → L3 cars). Don't add clutter to level 1.
- **Style:** 2-space indent, `const` modules, no dependencies without a discussion. Keep the "cute, not oversaturated" look.
- **Persistence:** everything through `Store` (`bonk_*` keys). Phase 1 replaces it with a versioned `bonk_save` + migration — build new features on that, not on new raw keys.

## 4. Known debt (intentional, tracked in PHASES.md)
- Globals instead of ES modules (fine for now; boundaries are clean, conversion is mechanical).
- No unit tests — `tools/check.py` is the safety net; add tests when the save/wallet layer lands (Phase 1).
- Levels are JS objects, not JSON yet (Phase 1).
- No music; SFX and puppy voice are procedural Web Audio (Phase 3 adds a loop and sliders).
- Level thumbnails are static WebPs per level id (`assets/images/levels/thumb_<id>.webp`); missing → falls back to thumb_1.

## 5. Debug hooks (browser console)
```js
Game.start(3); Game.puppy.inv = 1e9;           // jump to level 3, god mode
Game.state.spawner.items = []; Game.state.spawner.timer = 1e9;   // clear sky, stop spawning
Game.puppy.setPose('yay');                      // preview poses: idle run yay bonk dizzy
Store.recordLevel(1, 999, true, [true,true,true]);   // grant stars, then open LEVELS
localStorage.clear(); location.reload();        // fresh player
```
