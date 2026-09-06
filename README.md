# 🐾 BONK! — Catch. Dodge. Don't get bonked.

A polished 2D catch-and-dodge mobile web game with a Pixar-style parallax world.
Move the puppy left/right, catch bones and coins, grab power-ups, and dodge falling rocks and bombs.

**Version:** 0.13.0 · **Stack:** vanilla HTML5 Canvas + JS + CSS (no build step, no dependencies)

![BONK! gameplay](docs/screenshots/00_overview.jpg)

**Live build:** https://aalubhalu12.github.io/Dog/ (GitHub Pages, deploys on every push to `main`) · **Repo:** https://github.com/Aalubhalu12/Dog

---

## 🚀 Quick start

```bash
# any static server works — e.g.
bash tools/serve.sh            # → http://localhost:8080
# or
python3 -m http.server 8080
```
Open `index.html` through a server (not `file://`) so images and localStorage work.

**Controls**
| Platform | Move | Pause |
|---|---|---|
| Phone | Hold ◀ ▶ buttons **or drag** anywhere on the play area | ❚❚ button |
| Desktop | `←` `→` or `A` `D` | `Esc` / `P` |

---

## 📁 Project structure

```
bonk/
├── index.html                 # single page: scene markup (home board, HUD, modals) + script load order
├── README.md  .gitignore  .editorconfig
├── styles/                    # CSS, one file per screen — main.css imports them in order
│   ├── main.css               #   entry (@imports with ?v= cache tags)
│   ├── base.css               #   reset, stage frame, shared buttons, loader / toast
│   ├── home.css               #   home = level board (exact mockup replica) + live puppy
│   ├── hud.css                #   in-game HUD, controls, goal chip, FTUE bubble, pops / banners
│   └── modals.css             #   pause / game-over / level-clear / settings / leaderboard cards
├── src/                       # game code — vanilla JS, no build step, ONE global per file
│   ├── app.js                 # bootstrap: load → register scenes → fixed-step main loop → settings
│   ├── core/                  # engine plumbing (knows nothing about puppies)
│   │   ├── config.js          #   VERSION + all tunables (puppy physics, combo, near-miss, leaderboard)
│   │   ├── events.js          #   tiny pub/sub  Events.on / emit
│   │   ├── dom.js             #   $, $$, restartAnimation
│   │   ├── assets.js          #   image manifest + loader → Assets.img('key') / Assets.url('key')
│   │   └── input.js           #   touch buttons + drag + keyboard → Input.left / right / drag
│   ├── services/              # persistence, economy, telemetry, backend
│   │   ├── flags.js           #   feature flags (defaults · ?flag_x=1 · Remote Config later)
│   │   ├── analytics.js       #   event log: ring buffer + sinks, export, summary
│   │   ├── save.js            #   ★ save v2: one versioned document, migrations, backup, corrupt recovery
│   │   ├── wallet.js          #   coins: bounded add / spend, events
│   │   ├── store.js           #   Store facade: best, per-level {best,cleared,stars,plays}, settings, stats
│   │   └── leaderboard.js     #   local-first leaderboard, cached view, daily sync windows (Mock / Http adapter)
│   ├── audio/
│   │   └── sfx.js             #   procedural SFX + puppy voice (Web Audio) → SFX.play('key')
│   ├── data/                  # catalogues + loaders (design data, no behaviour)
│   │   ├── items.js           #   ★ ITEMS + POWERS
│   │   ├── goals.js           #   ★ GOALS registry — 3rd-star objectives
│   │   └── levels.js          #   loads + validates data/levels/*.json into LEVELS
│   ├── game/                  # simulation + canvas rendering (never touches the DOM except FX)
│   │   ├── game.js            #   Game controller: score, lives, powers, combo, near-miss, shield, flow
│   │   ├── puppy.js           #   Puppy: physics, 24 fps sheet animation, turn pivot, draw
│   │   ├── spawner.js         #   Spawner: spawning, fall profiles, magnet, collisions
│   │   ├── background.js      #   BG: parallax renderer + THEMES + camera framing
│   │   ├── ambient.js         #   background life per level (birds, walkers, cars) — behind the fence
│   │   ├── effects.js         #   FX: pop text, banners, flash, shake, particles
│   │   └── ftue.js            #   first-time hints (move / catch / dodge / combo), once per save
│   ├── ui/
│   │   ├── hud.js             #   HUD DOM binding (score, hearts, coins, goal chip, power timers, combo)
│   │   └── modals.js          #   modal open / close + fill (pause, game over, level clear, leaderboard)
│   └── scenes/                # glue: user actions ⇄ Game events ⇄ UI
│       ├── home.js            #   HomeScene — level board + PLAY (also the level map)
│       └── play.js            #   PlayScene — wires Game hooks to HUD / Modals
├── data/
│   └── levels/                # ★ L01.json … + index.json — one file per level
├── assets/images/             # everything the game SHIPS (all WebP, ≈3.9 MB)
│   ├── bg/                    # parallax layers: sky, clouds, mountains, village (+water_mask), meadow, road, foreground_wide, trees
│   ├── ambient/               # bird sheet, walker sheets, cars
│   ├── puppy/                 # 24 fps sprite sheets (idle / run / yay / bonk / dizzy) + result-card stills
│   ├── items/                 # one sprite per item key (bone, goldbone, coin, magnet, star, shield, rock, bomb)
│   ├── ui/                    # arrows, hearts, stars, lock, trophy
│   ├── home/                  # painted plate, logo, sitting puppy (2 poses)
│   └── levels/                # thumb_<id>.webp — level-select thumbnails
├── art/                       # SOURCE material, not loaded by the game — see art/README.md
├── firebase/                  # Cloud Function `leaderboard` + rules (Phase 5), with node tests
├── docs/                      # HANDOVER · ARCHITECTURE · ADDING_CONTENT · STATUS · PHASES · plans · CHANGELOG · screenshots/
└── tools/
    ├── check.py               # ★ smoke test: syntax, asset refs, version tags, headless play, data layer, leaderboard tests
    ├── sim_play.py            # scripted bot plays L1–L3 through the real UI (25-point checklist)
    ├── test_leaderboard.py    # leaderboard unit/integration checks (run by check.py)
    ├── bump.py                # bump VERSION everywhere it must match
    ├── serve.sh               # local dev server
    ├── optimize_assets.py     # PNG/JPG → WebP for new art
    ├── build_puppy_sheets.py  # cut sprite sheets from art/clips/*.mp4 (opencv, numpy, Pillow)
    ├── clip_utils.py          #   helpers for the above
    ├── grade_puppy.py         #   colour grade (imported by light_puppy.py)
    └── light_puppy.py         #   ONE-SHOT grade + pseudo-3D relight for freshly built sheets
```

★ = **data files**. Most future content (new levels, items, power-ups) only touches these.

---

## ➕ Adding content (cheat-sheet)

| I want to… | Edit | Details |
|---|---|---|
| Add a level | `data/levels/L0N.json` + `index.json` | copy the last file, edit, register — the board lays itself out; `tools/check.py` validates |
| Add a goal type (3rd star) | `src/data/goals.js` | add an entry to `GOALS` — see `docs/ADDING_CONTENT.md` |
| Add a falling item | `src/data/items.js` + sprite in `assets/images/items/` + line in `src/core/assets.js` | see `docs/ADDING_CONTENT.md` |
| Add a power-up | `items.js` (`POWERS`) + handle in `game.js` / `spawner.js` | |
| Change puppy speed / size | `src/core/config.js` → `PUPPY` | |
| Add a sound | `src/audio/sfx.js` | reference by key from an item |
| Add a background theme | `src/game/background.js` → `THEMES` | set `theme:` on a level |
| Tune background life (cars/people/birds) | `src/game/ambient.js` → `CFG` | spawn intervals, caps, road position |
| Add a screen (shop, level select) | new `src/scenes/*.js` + `.scene` div in `index.html` + register in `src/app.js` | |

Full recipes with code: **[docs/ADDING_CONTENT.md](docs/ADDING_CONTENT.md)**

---

## 🎮 Gameplay rules

| Item | Effect |
|---|---|
| 🦴 Bone | +10 score (×2 during star) |
| 🪙 Coin | +1 coin (persisted) |
| 🧲 Magnet | 6 s — pulls bones & coins toward the puppy |
| ⭐ Star | 8 s — 2× score |
| 🦴✨ Gold bone | +50 (rare, sparkles) |
| 🛡 Shield biscuit | absorbs the next hit — no heart lost, combo kept |
| 🪨 Rock | **BONK!** −1 ❤, short stun |
| 💣 Bomb | **DIZZY!** −1 ❤, longer stun |

3 hearts per level · 1.6 s invincibility after a hit · clear a level by reaching its `target` score · "Keep playing" carries score/coins forward and restores 1 heart.

**Combo:** every catch (bone, gold bone, coin, power-up) adds a paw to the chain; 4 paws = next multiplier, up to **×5** on bone score. Getting hit or letting a bone touch the ground breaks it.
**Near-miss:** a rock/bomb that just brushes past = "PHEW!" +1 coin.

**Stars per level:** ⭐ reach the target · ⭐ don't lose a heart · ⭐ level-specific goal (`src/data/goals.js`). Stars are sticky and saved per level; the level board and PLAY button use them.

---

## 🧭 Where we are / what's next
0. **[docs/HANDOVER.md](docs/HANDOVER.md)** — new developer orientation (15 min)
1. **[docs/STATUS.md](docs/STATUS.md)** — done vs. next (start here)
2. **[docs/PHASES.md](docs/PHASES.md)** — 7 execution phases to launch, each with a done-when checklist
3. **[docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md)** — launch scope: all screens, shop/skins/remove-ads/subscription, ads rules, Firebase backend, Android wrap
4. **[docs/PHASE2_PLAN.md](docs/PHASE2_PLAN.md)** — locked long-term design (M1–M5) and monetization principles

## ✅ Before you commit
```bash
python3 tools/check.py
```
Checks JS syntax, every asset reference, level JSON files, `?v=` cache tags vs `CONFIG.VERSION`, then plays the game headless on 3 viewports asserting zero console errors, refreshes `docs/screenshots/`, and exercises the data layer (save migration, corrupt-save recovery, wallet bounds, analytics events, reset, flags). Needs `pip install playwright && python3 -m playwright install chromium` for the browser part (skipped gracefully otherwise).

**Release checklist:** bump `VERSION` in `src/core/config.js` → same value in every `?v=` in `index.html`, in the `@import`s of `styles/main.css` and in this README → add a `docs/CHANGELOG.md` entry → `python3 tools/check.py` green.

## 📜 Changelog
See **[docs/CHANGELOG.md](docs/CHANGELOG.md)**.

---

## 📱 Packaging for app stores (later)
The game is a static site — wrap it with [Capacitor](https://capacitorjs.com/) (Android/iOS) or publish as a PWA. No code changes required; add a `manifest.json` + service worker for PWA install.

## License
Art assets were generated for this project. Code © 2026 — all rights reserved (update as needed).
