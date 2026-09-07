# Changelog

All notable changes to BONK! are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.15.0] — 2026-09-07 — Three locations · three acts per level · speed reset per location
### Added
- **Locations.** Meadow (L1–4) → **City Park** (L5–8, `assets/images/bg/park_far/park_mid.webp`: skyline, bandstand,
  fountain, ice-cream cart) → **Forest** (L9–10, `forest_far/forest_mid.webp`: pines, campfire, log, stream). Sky, clouds,
  tree frame, road and the fence/grass apron are shared so the play lane never changes. `BG.THEMES` has all three.
- **Three acts per level** (`stages` in the level JSON, default morning → evening → night). Act k starts when score
  reaches k/3 of the target: the light cross-fades over ~1.2 s (`BG.setTime`), a "🌇 EVENING" banner + chime, the puppy
  puffs dust, items fall faster ("FASTER!" / "FULL SPEED!"), and hazards pause 1.5 s so the change is never a cheap hit.
  Times: **morning** (as before) · **evening** (orange sky, warm soft-light, low sun) · **night** (blue multiply,
  stars, moon, a lantern glow that follows the puppy so he stays readable) · **rain** (grey grade, slanted streaks that
  lean with the wind). Background life thins at night / in rain.
- **Speed reset per location.** Level 1 of every location starts at the game's original L1 pace (`speed[0] ≈ .28`);
  within a level the acts go slow → medium → fast (`speed[0]` → `speed[1]`); across a location, targets, hazard weights
  and mechanics grow — not raw speed. HUD shows the act (`LV 6 🌙`); the level card shows the location.

| # | Place | Name | Target | Speed | Acts | 3rd star | Mechanics |
|---|-------|------|--------|-------|------|----------|-----------|
| 1 | Meadow | Sunny Meadow | 400 | 0.28→0.42 | morning → evening → night | bonesIn 8 | — |
| 2 | Meadow | Rocky Road | 900 | 0.3→0.48 | morning → evening → night | coins 12 | — |
| 3 | Meadow | Bomb Squad | 1400 | 0.32→0.54 | morning → rain → night | noBomb  | — |
| 4 | Meadow | Combo Creek | 1900 | 0.34→0.6 | morning → evening → night | combo 3 | — |
| 5 | City Park | Park Life | 1300 | 0.28→0.44 | morning → evening → night | nearMiss 3 | — |
| 6 | City Park | Breezy Bandstand | 1700 | 0.3→0.5 | morning → rain → night | goldBones 1 | wind 0.55 |
| 7 | City Park | Gusty Gardens | 2000 | 0.32→0.56 | morning → evening → night | power 4 | wind 0.8 |
| 8 | City Park | Squirrel Trouble | 2000 | 0.34→0.62 | evening → night → rain | coins 25 | wind 0.5, squirrel |
| 9 | Forest | Forest Camp | 1900 | 0.28→0.48 | morning → evening → night | dodge 30 | squirrel, waves |
| 10 | Forest | Forest Master | 2300 | 0.3→0.58 | morning → rain → night | combo 5 | wind 0.7, squirrel, waves |

### Fixed (found by the balance sweep)
- **Hazard waves left no real gap.** "One open lane of count+1" was a 34 px slot for an 80 px puppy on a 390 px phone.
  Waves now carve a gap of 1.25 × the puppy's width at a random spot and spread the rocks around it.
- **Near-miss margin** `0.18` puppy-widths (~20 px) was too tight to feel — nobody earned "PHEW!". Now `0.30`.
- Ambient road life is off in the forest (no road there).
### Changed
- `Spawner` pace is act-driven: `setStage(i, t)` / `pace(t)` replace the old level-long ramp; `safeUntil` covers the
  act change. `Levels.validate` checks `stages`. `tools/sim_levels.py` bot rewritten around contact windows (t0/t1)
  and reachable-safe-spot search — it now clears every level; `sim_play.py` shares it.
### Verified (scripted, 390×844, fresh save, 2 good runs + 1 perfect run per level)
- All 10 levels cleared by the good bot; 3rd star reached on every level (L1–L9 ★★★ in good runs, L10 ★☆★ with the
  ×5 combo reached in the perfect run). `tools/check.py` PASS · `tools/sim_play.py` 25/25 · zero console errors.

## [0.14.0] — 2026-09-07 — Phase 3: levels 4–10, wind, squirrel, hazard waves
### Added
- **Levels 4–10** (`data/levels/L04–L10.json`, thumbnails `thumb_4..10.webp`) — the board is now 10 real tiles.

| # | Name | Target | 3rd star | Mechanics |
|---|------|--------|----------|-----------|
| 1 | Sunny Meadow | 400 | bonesIn 8 | — |
| 2 | Rocky Road | 900 | coins 12 | — |
| 3 | Bomb Squad | 1500 | noBomb  | — |
| 4 | Combo Creek | 1700 | combo 3 | — |
| 5 | Close Call | 2000 | nearMiss 4 | — |
| 6 | Breezy Hill | 2200 | goldBones 1 | wind 0.55 |
| 7 | Gusty Gap | 2400 | power 4 | wind 0.8 |
| 8 | Squirrel Trouble | 2600 | coins 25 | wind 0.4, squirrel |
| 9 | Rock Slide | 2800 | dodge 30 | wind 0.5, squirrel, waves 3/18s |
| 10 | Meadow Master | 3000 | combo 5 | wind 0.7, squirrel, waves 4/16s mix |

- **`src/game/mechanics.js`** — per-level mechanics, all driven by the level's `modifiers` (off unless asked):
  - **Wind** (`wind: 0..1`): gusts every 7–13 s for 2.5–4 s; telegraphed 0.8 s early by a chevron sweep, streaming
    leaves, the tree frame leaning, a whoosh — and the puppy bracing into the wind. Light items (coins, power-ups)
    drift most, bones a bit, **rocks/bombs never** (hazards stay predictable; the wind is a reading skill, not RNG).
  - **Squirrel** (`squirrel: true`): darts out from behind the fence, grabs any bone that hits the ground, bounces
    with a "MINE!" and scampers off. The puppy does a startled "HEY!" hop if it's close. Visual only.
  - **Hazard waves** (`waves: {every, count, gap, mix}`): "⚠ INCOMING!" banner + alarm, then a rock sweep across
    `count+1` lanes with **one lane always open**. Regular spawning pauses during the wave. `mix` alternates bombs.
- **`dodge` goal** (`src/data/goals.js`): count hazards that reach the ground without touching you (L9).
- **Puppy**: `celebrate()` on level clear (plants paws, happy-hop clip, two bounces, confetti burst), `surprised()`
  (squirrel), wind lean. All understated — no new sheets, nothing added to L1–L5 gameplay.
- **`tools/sim_levels.py`** — balance sweep: a look-ahead bot plays every level from a clean save through the real
  board UI ("good" runs + a "perfect" no-hazard run per level), reports win rate / stars / mechanic event counts and
  fails if a level is unwinnable, a goal unreachable, or a configured mechanic never fires.
  `tools/sim_play.py` now imports the same bot (one bot to maintain) and expects 10 levels.
- SFX: `whoosh`, `squeak`, `alarm`. CSS: `.banner.warn`, `.gust`.
### Changed
- `Spawner.spawn()` split into `spawn()` + `spawnAt(type, xFrac, time, speedMul)`; `update()` takes `onDodge`.
- `Levels.validate` checks `modifiers` (wind range, squirrel boolean, waves shape).
### Balance (scripted, 390×844, fresh save)
- Good bot clears every level (L4 3★, L5–L9 ★☆★, L10 cleared on 1 of 2 runs at ~3 min); perfect run reaches the
  3rd star on every level whose goal doesn't need hazards; nearMiss (L5) and dodge (L9) stars reached in good runs.
  Targets were lowered twice from the first draft (L10 6000 → 3000) — the sweep showed the curve was ~2× too steep.
- `tools/check.py` PASS · `tools/sim_play.py` 25/25 · zero console errors in every run.

## [0.13.0] — 2026-09-06 — Codebase audit & restructure (no gameplay changes)
### Changed
- **Source layout by responsibility** (script order in `index.html` documents the dependency order):
  `core/` (config, events, dom, assets, input) · `services/` (flags, analytics, save, wallet, store, leaderboard) ·
  `audio/sfx.js` · `data/` (items, goals, levels loader) · `game/` · `ui/` · `scenes/`.
  Renames: `storage.js → store.js`, `audio.js → audio/sfx.js`, `net/leaderboard.js → services/`,
  `scenes/map.js → scenes/home.js` (`MapScene → HomeScene`, `sceneMap → sceneHome`, `goMenu/goMap → goHome`).
- **CSS**: `menu.css → home.css`; `map.css` dissolved into `hud.css` (goal chip), `modals.css` (goal list, result
  stars) and `home.css` (tile keyframes). Removed pre-mockup widgets never rendered (`.topbar .pill .iconbtn
  .btn-blue .btn-wood`, `float`/`menuIn` leftovers, dead `@container` block).
- One shared `$` / `$$` / `restartAnimation()` in `core/dom.js` replaces six private copies and six reflow hacks.
### Removed (verified zero runtime/tool references)
- Assets: `brand/logo.webp` (superseded by `home/logo.webp`), `ui/board.webp`, `ui/badge_paw.webp`, `puppy/puppy.webp`,
  the old `home/plate.webp` with the baked-in dog (`plate_nodog` renamed to `plate`), empty `assets/audio/`.
- Dead API: `Store.spendCoins/starCount/stat/continueLevelIdx`, `Save.toJSON/SCHEMA`, `Analytics.clear/session`,
  `Flags.all/DEFAULTS`, `Wallet.MAX_DELTA`, `Events.once`, `SFX.pant`, `BG.setAmbient`, `Levels.byId/count`,
  `Assets.all`, `CONFIG.PARALLAX.MENU_AMP`, `CONFIG.COMBO.DECAY`; hidden DOM (`#mapStars #best #lsCard #ftueHand #overTitle`).
- Duplicate / superseded art sources (`mockup_level_select.png` = `home_mockup.png`, raw logo, board sheet) and
  24 historical screenshots no doc references (docs/ 11 MB → 4 MB).
### Fixed
- `tools/sim_play.py` used absolute `/home/user/...` screenshot paths — now repo-relative.

## [0.12.3] — 2026-09-05 — Home: complete logo bone, living puppy
### Fixed
- **Logo bone was cut off.** The source logo art had the bottom-left bone clipped by its own canvas edge. Regenerated
  the logo with the bone complete (`assets/images/home/logo.webp`, same lettering/ribbon/proportions).
### Added
- **Home puppy moves.** The painted puppy was baked into the background plate. He is now a separate layer
  (`plate.webp (puppy painted out)` + `dog_sit.webp` / `dog_sit_b.webp`) with: a hello hop on entry, a slow breathing sway
  with soft shadow, a happy-squint blink every ~6.5 s, and a hop + yip when tapped. Subtle by design; honours
  `prefers-reduced-motion`.

## [0.12.2] — 2026-09-05 — Phone layout: puppy above the buttons, no more "disappearing"
### Fixed
- **Puppy hidden under the arrow buttons on phones.** Ground line raised 0.905 → 0.845 and the grass apron made
  taller, so the puppy runs on a clear lane above the ◀ ▶ buttons (buttons a touch smaller: 22 → 20 cqmin).
  Fence and road moved up with him; items still land at his feet; the arrow-ghosting hack is now dormant.
- **Puppy "invisible" after a hit.** The i-frame effect was a 45 % alpha strobe at 6 Hz, which on a phone reads as
  the dog vanishing. Replaced with a soft pulsing white glow — always fully visible.

## [0.12.1] — 2026-09-05 — Turn "blink" fixed
### Fixed
- Turning used to ease scaleX through 0, so for a frame or two the puppy shrank to a line and looked like it blinked
  out. The turn is now a pivot that only narrows to 45 %, swaps facing at the narrowest point and widens back out over
  150 ms (height rises slightly to keep the volume). Solid and single on every frame — no gap, no ghost.

## [0.12.0] — 2026-09-05 — Puppy: true 24 fps, right expression per state, pseudo-3D relight
### Changed
- **24 fps everywhere.** All five puppy sheets are consecutive real clip frames (no sub-sampling): idle 20 f
  (ping-ponged in code), run 16 f (one stride, never played faster than the 24 fps source), yay 28 f, bonk 28 f,
  dizzy 26 f. Reaction durations in `items.js` now match the clips (yay 1.15 s, bonk 1.2 s).
- **Expressions.** Frame windows re-picked so each state shows its face: happy neutral (idle/run), full smile
  mid-hop (yay), squint + ear flap (bonk; game-over still = strongest flinch frame), crossed eyes + stars (dizzy).
  The real hop pose now also plays when the puppy is moving slowly (previously only when still).
- **Pseudo-3D look.** New one-shot `tools/light_puppy.py` (grade + relight): silhouette-derived normals, key light
  top-left, ambient occlusion under the belly, sky rim on the back, warm ground bounce, faint fur sheen — kept subtle.
- Asset budget: puppy sheets 1.8 MB total (`assets/images` 4.0 MB).

## [0.6.1] — 2026-09-05 — Smoothness + puppy voice
### Fixed (animation glitches)
- **Catch pop.** Catching a bone while running used to snap to the front-view "yay" image and back — the most visible
  glitch. Now: while running the gallop continues and the puppy does a small hop (ballistic arc on top of the stride
  bob); the happy pose only shows when nearly stationary.
- **Mirror snap on turns.** Facing now eases through a ~90 ms pivot (scaleX passes through 0) instead of flipping in
  one frame; dust puff unchanged.
- **Double exposure.** All visual transitions (idle/run/yay/bonk/dizzy) share one cross-dissolve whose alphas sum to 1
  (smoothstep), so nothing ghosts; the outgoing run frame keeps advancing during the dissolve.
- **Threshold flicker.** Idle↔run uses hysteresis (start > 8 % speed, stop < 4 %).
- **Frame-time jumps.** App loop is now fixed-step 120 Hz simulation with an accumulator behind a variable-rate render,
  so a long frame (tab switch, GC pause, 120→60 Hz throttling) becomes several small steps, not one visible jump.
- Bob is smoothed and the shadow shrinks/fades with lift (bob + hop).
### Added (soft puppy voice — procedural, no files)
- Tiny formant "vocal tract" in `audio.js` (`voice()`): saw source → two band-pass formants → breath layer → low-pass.
  Sounds: **yip** (bone catch; coins only 25 % of the time), **wuff** (power-up, level GO), **whine** (bonk),
  **whimper** (dizzy), **paw pats** on the two contact frames of the gallop. Rate-limited (voice ≥ 0.55 s apart,
  steps ≥ 80 ms) and mixed 30–50 % under the item SFX so it stays soft and cute. Demo: `docs/puppy_voice_demo.wav`.

## [0.6.0] — 2026-09-05 — "Feel" pass
### Changed
- **Puppy gallop.** New **12-frame** side-view rotary-gallop sheet (reach → contact → pass-over → gather → hind
  touchdown → drive → push-off → full suspension → airborne reach → descent → landing). Frame-rate tied to speed
  (12–30 fps — "on ones" at full sprint); vertical bob is one arc per stride, lowest at the gather, highest at
  suspension. Frames are scale-normalised (±8 % clamp) so there is no size jitter across the loop.
  Why 12 and not 24: studio 2D run cycles are 8–16 drawings; extra generated frames add identity drift rather than
  smoothness. Optical-flow in-betweening (8→24) was tested and rejected — it ghosts on the legs.
- **Natural falling items.** Per-type fall profiles (`Spawner.FALL`): items accelerate in instead of appearing at
  full speed; bones tumble end-over-end, coins flutter and rock side-to-side (with a proper two-sided flip), rocks and
  bombs drop hard and straight and end up faster, power-ups drift down slowly with a wide sway. Identical "speed
  lines" removed; a soft ground shadow fades in and tightens during the last third of the fall so the landing point
  reads clearly. Faint streak only on heavy items at speed.
- **Background life grows level by level.** Levels declare `ambient: { birds, walkers, cars }` (0–1). Level 1 is a
  quiet morning with birds only; villagers appear in Level 2; the lane gets cars in Level 3. Menu keeps a light mix.
- Hint text moved up and paw emoji removed so it never sits on the puppy.

## [0.5.0] — 2026-09-04
### Added
- `docs/PHASE2_PLAN.md` — locked Phase 2 roadmap (v3).
- **Living water.** The lake/river in the village layer now has slow drifting ripples and breathing sun glints,
  clipped to an auto-extracted water mask (`assets/images/bg/water_mask.webp`, 4 KB). Rendered once per frame into a
  small offscreen canvas; no measurable FPS cost. Tunable via `WATER` in `background.js`.
- **Real puppy animation.** 6-frame side-view trot sheet (`assets/images/puppy/run_sheet.webp`) and 4-frame idle sheet
  (tail wag / ear lift / blink). Run frame-rate is tied to speed so paws never slide; gentle stride-synced bob;
  short idle↔run crossfade; small dust puff only on hard direction reversals. Menu puppy uses the idle sheet too.
### Changed
- Top speed tuned to ~1.2 s edge-to-edge for the wider stage; acceleration slightly softer for a natural start/stop.
- Hint text moved above the puppy so it doesn't overlap.
- Ambient life is now visible from the first second: the lane and sky are pre-populated on start/reset, and spawn
  intervals are shorter (cars/walkers every 3.5–8 s, small bird flocks every 5–10 s). Still behind the fence, still calm.
- No back-to-back identical cars/walkers; walkers keep spacing. Hint text only on Level 1 and auto-hides after 4 s.

## [0.4.0] — 2026-09-04
### Changed
- **Camera pulled back**: new wide foreground layer (fence spans the full width, doghouse at the edge), tree frame pushed outward,
  puppy and items ~15% smaller, movement bounds widened from 10–90% to 6–94% of the screen, spawn range widened, desktop frame wider (0.70 ratio).
- New mid-ground meadow layer between the village and the lane for depth continuity on tall screens.
### Added
- **Ambient life system** (`src/game/ambient.js`): country lane behind the fence with passing cars (3 variants, both directions),
  walking villagers (2 characters × 4-frame walk cycles), and small flocks of bluebirds (3-frame flap + occasional glide) in the sky band.
  All decorative, low density, drawn behind the ground layer so they never obscure gameplay. Toggle with `BG.setAmbient(false)`.
- `assets/images/ambient/` folder; `Ambient.CFG` for spawn rates / caps / road position.

## [0.3.0] — 2026-09-04
### Changed
- **Project restructure** for scalability: `src/core`, `src/game`, `src/ui`, `src/scenes`; CSS split into `styles/*.css`; assets grouped under `assets/images/{bg,puppy,items,ui,brand}`.
- Levels and items are now **pure data** (`levels.js`, `items.js`) — gameplay code reads from them.
- Scene system in `app.js` (`app.go('menu' | 'play')`) with `enter/exit/frame` lifecycle.
- Settings toggles use `data-setting` attributes and persist through `Store.setting()`.
### Added
- Level 3 config ("Bomb Squad"); "Keep playing" button now shows the next level number / Endless Mode.
- Per-level progress persistence (`Store.recordLevel`, `Store.highestUnlocked`) ready for a level-select screen.
- Countdown pauses/resumes correctly; pausing during the countdown no longer breaks the run.
- Version tag in the corner (`CONFIG.VERSION`).
- Docs: README, ARCHITECTURE, ADDING_CONTENT, ROADMAP; tools: `serve.sh`, `optimize_assets.py`.

## [0.2.0] — 2026-09-04
### Added
- Level 1 gameplay: falling bones / coins / magnet / 2× star / rocks / bombs, 3 hearts, invincibility frames.
- Puppy movement physics (accel + friction), drag-to-move with damped spring, keyboard support.
- Reaction poses (YAY / BONK / DIZZY), floating text, banners, particles, flash + shake.
- HUD (score, best, coins, hearts, power timers, progress bar), pause, game-over and level-clear cards.
- Procedural Web Audio sound effects and haptics.

## [0.1.0] — 2026-09-04
### Added
- Parallax menu scene: 7 generated art layers, drifting clouds, light rays, falling leaves, pointer/gyro parallax.
- Logo, tagline, PLAY / how-to / shop / sound buttons, settings modal, localStorage best & coins.
- Responsive phone-frame stage for desktop.
