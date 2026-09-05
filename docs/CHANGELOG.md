# Changelog

All notable changes to BONK! are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
