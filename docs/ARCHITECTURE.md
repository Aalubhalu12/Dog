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
│ scenes/           MenuScene · MapScene · PlayScene           │
│                   (glue: user actions ⇄ Game events ⇄ UI)    │
├──────────────────────────────────────────────────────────────┤
│ ui/               HUD · Modals            (DOM only)         │
├──────────────────────────────────────────────────────────────┤
│ game/             Game ─┬─ Puppy                             │
│                         ├─ Spawner ── ITEMS / POWERS (data)  │
│                         ├─ FX                                │
│                         ├─ GOALS (3rd-star rules, data)      │
│                         └─ LEVELS (data)                     │
│                   BG (parallax, THEMES) · Ambient (bg life)  │
├──────────────────────────────────────────────────────────────┤
│ core/             CONFIG · Store · Assets · SFX · Input      │
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
            │    ├─ spawner.update(...)     spawn · fall · magnet · collide → Game.onCatch(item)
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
  powers: { magnet: secondsLeft, star: secondsLeft },
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

## Persistence (`Store`)

localStorage keys are prefixed `bonk_`:
`best`, `coins`, `levels` (`{ [id]: { best, cleared, stars:[b,b,b] } }` — stars are sticky, merged in `Store.recordLevel`), `set_sound`, `set_vib`, `set_tilt`.
Planned (Phase 1 of `PHASES.md`): a single versioned `bonk_save` object with migrations; the cloud save in Phase 5 syncs that blob.

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
