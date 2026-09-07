# Architecture

BONK! is intentionally dependency-free. Scripts are plain `<script>` tags loaded in
order (see the bottom of `index.html`); each file exposes **one global** (e.g. `Game`,
`BG`, `Assets`). If the project grows, the same files can be converted to ES modules by
adding `export`/`import` lines — the boundaries are already clean.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ app.js            scene registry · main rAF loop · settings  │
├──────────────────────────────────────────────────────────────┤
│ scenes/           HomeScene (level board) · PlayScene        │
│                   (glue: user actions ⇄ Game events ⇄ UI)    │
├──────────────────────────────────────────────────────────────┤
│ ui/               HUD (compact, ≤15 % of stage) · Modals     │
├──────────────────────────────────────────────────────────────┤
│ game/             Game ─┬─ Puppy · Spawner · FX    FTUE      │
│                         └─ Mechanics (wind · squirrel · waves)│
│                   BG (parallax, THEMES) · Ambient (bg life)  │
├──────────────────────────────────────────────────────────────┤
│ data/             ITEMS / POWERS · GOALS · LEVELS (json)     │
├──────────────────────────────────────────────────────────────┤
│ audio/            SFX (procedural Web Audio + puppy voice)   │
├──────────────────────────────────────────────────────────────┤
│ services/         Flags · Analytics · Save → Wallet → Store  │
│                   Leaderboard (Mock / Http adapter)          │
├──────────────────────────────────────────────────────────────┤
│ core/             CONFIG · Events · DOM helpers · Assets · Input│
└──────────────────────────────────────────────────────────────┘
```

**Rule of thumb:** lower layers never reference higher ones.
`game/` never touches the DOM (except `FX`, which owns the `#fx` overlay); `ui/` never
contains game rules.

## Frame flow

```
requestAnimationFrame
  └─ app.frame(now, dt)
       └─ currentScene.frame(now, dt)
            ├─ Game.update(dt)              (play scene only)
            │    ├─ puppy.update(dt)        physics from Input
            │    ├─ powers tick
            │    ├─ Mechanics.update(dt,S)   gusts · squirrel · wave spawns (via spawner.spawnAt)
            │    ├─ spawner.update(...)     spawn · fall · wind drift · magnet · collide → Game.onCatch(item)
            │    ├─ FX.update(dt)           particles
            │    └─ hooks.onHUD(state)      → HUD.update
            └─ BG.draw(now, dt, hooks)
                 sky → clouds → far layers → light rays → [behindFront] → ground → trees → [overlay] → leaves → vignette
                                                                                              └─ Game.draw: puppy · items · particles
```

## Game state object (`Game.state`)

```js
{
  level, levelIdx, time,
  score, coins, bones, lives, mult,
  powers: { magnet: secondsLeft, star: secondsLeft, shield: 0|1 },
  combo: { n, mult, best, bestMult }, nearMisses, shieldSaves,
  spawner,               // Spawner instance (items live in spawner.items)
  cleared, over, lastHit, isNewBest
}
```

## Events from Game → scene (`Game.init(hooks)`)

| hook | when |
|---|---|
| `onStart(S)` | new level run created (before countdown) |
| `onCountdown(text \| null)` | each countdown tick; `null` = hide |
| `onHUD(S)` | every frame while running |
| `onLifeLost(S)` | after a hazard hit |
| `onLevelClear(S)` | target reached (after the banner delay) |
| `onGameOver(S)` | lives hit 0 (after the fall delay) |
| `onCombo(S, 'add'|'break')` | combo chain changed (HUD paw-chain) |

## Persistence (`Save` → `Wallet` → `Store`)

One versioned document in localStorage: **`bonk_save`** (`v: 2`) plus **`bonk_save_bak`** (last known-good copy).

```
{ v, createdAt, updatedAt, best, coins,
  levels: { [id]: { best, cleared, stars:[b,b,b], plays } },
  settings: { sound, vib, tilt, music }, ftue: { done }, shop: { owned, equipped },
  daily: { streak, last }, stats: { runs, wins, losses, quits, bones, playSec } }
```
- `Save` — load (with migrations from the v1 scattered keys `bonk_best/coins/levels/set_*`), debounced write, backup, corrupt-recovery, `get/set/update/reset/replace/toJSON`. Cloud save (Phase 5) calls `Save.replace(doc)` / `Save.toJSON()`.
- `Wallet` — the only writer of `coins`; bounded (+5000 per add, never negative), emits `coins` events, logs `coins_earned/spent`.
- `Store` — the facade the rest of the game uses (`best`, `levelStars`, `recordLevel`, `highestUnlocked`, `setting`, `stat`, `resetAll`).
- `Events` — pub/sub (`coins`, `progress`, `best`, `setting`, `save:loaded|written|corrupt|reset`, `flag`).

## Levels (`data/levels/*.json`)

`Levels.load()` runs at boot (parallel with asset loading): reads `index.json`, fetches each file, validates
(`Levels.validate`), normalises defaults and fills the global `LEVELS` array. Invalid files are skipped with a console error.

## Analytics & flags

`Analytics.track(name, props)` → ring buffer (500 events, persisted in `bonk_alog`) + sinks (Phase 5: GA4).
Emitted by the game: `session_start · level_start · level_end{result: win|lose|quit, score, stars, duration, heartsLost} · retry{from} · continue · quit · pause · coins_spent · reset_progress · error`.
`Flags.get(key)` → defaults in `flags.js`, overridable via URL `?flag_<key>=…` and later Remote Config (`Flags.apply`).

## Boot sequence (`app.js`)

`Save.load()` → `Analytics.track('session_start')` → `Promise.all([Levels.load(), Assets.load()])` → `BG.init()` → bind scenes → menu.
A load failure shows a retry screen instead of a blank page.

## Responsive stage

`#stage` is a 9:16-ish container. On phones it fills the viewport; on wide screens it
becomes a rounded phone frame over a blurred backdrop. All UI sizes use `cqmin/cqw`
(container query units) so they scale with the stage, not the window.
The canvas is sized in CSS pixels × `devicePixelRatio` (capped at 2).

## Testing

`python3 tools/check.py` is the smoke test (syntax, asset refs, version tags, headless
play on 3 viewports with zero console errors, screenshots). There is no unit-test framework
yet; the game exposes `Game`, `BG`, `ITEMS`, `Store` globally so it can be driven from the
console or Playwright. Useful hooks:

```js
Game.start(2)                       // start level 2 directly
Game.puppy.inv = 1e9                // god mode
Game.state.spawner.items = []       // clear the sky
Game.state.spawner.timer = 1e9      // stop spawning
Game.puppy.setPose('dizzy')         // preview a pose
localStorage.bonk_levels = JSON.stringify({1:{best:500,cleared:true,stars:[true,true,false]}})  // seed progress, then reload
```
Example — drop a rock on the puppy:

```js
// drop a rock on the puppy
const S = Game.state, W = BG.W, H = BG.H, def = ITEMS.rock;
S.spawner.items.push({ type:'rock', def, x: Game.puppy.x*W, y: H*.5, size: W*def.size, vy: H*.5, rot:0, vr:1, wob:0, dead:false });
```

- `src/services/leaderboard.js` — local-first leaderboard, cached server view, daily-window sync (see docs/LEADERBOARD.md)
- `firebase/` — Cloud Function + Firestore indexes/rules for the leaderboard

## Adaptive quality (`src/core/perf.js`)
The main loop reports each rendered frame's wall time to `Perf.frame(ms)`. A median > 22 ms (or p90 > 34 ms) for ~2 s steps the tier down; ~15 s of < 12 ms steps it up. `BG` reads `Perf.tier` for the canvas DPR cap (1 / 1.5 / 2), water ripples (off / half-res / full), god rays (off below tier 1) and the soft-light grade (tier 2 only). Simulation is never affected. Devices with ≤ 2 cores or ≤ 2 GB start at tier 1; `?q=0|1|2` locks a tier for QA; `level_end` analytics carry `q`.
