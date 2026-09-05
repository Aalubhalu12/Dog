# Adding content — recipes

## 1. Add a level

`src/game/levels.js` → append to `LEVELS`:

```js
{
  id: 4, name: 'Windy Peaks', target: 2200, hearts: 3,
  spawn: [0.55, 0.35],     // seconds between spawns, start → after `ramp`
  speed: [0.50, 0.72],     // fall speed in stage-heights/second
  ramp: 60, safeTime: 2,
  weights: { bone: 28, coin: 24, rock: 22, bomb: 16, magnet: 5, star: 5 },
  theme: 'meadow',
},
```
That's it. HUD, progress bar, level-clear card and `Store.recordLevel` all read from the array.
`getLevel(i)` clamps to the last entry, so "Keep playing" after the final level replays it (endless).

## 2. Add a falling item

1. Sprite → `assets/images/items/<key>.webp` (transparent, ~260 px wide).
   Drop a PNG and run `python3 tools/optimize_assets.py` to convert.
2. `src/core/assets.js` → add `<key>: 'items/<key>.webp'` to `MANIFEST`.
3. `src/game/items.js` → add an entry:

```js
// a good item worth 25 points
steak: { kind: 'score', size: .12, rot: 1.2, score: 25, pose: 'yay', poseTime: .5,
         popText: '+{v}', popClass: 'good', sfx: 'bone', particles: ['#fff', '#ff7a7a'] },

// a hazard
cactus: { kind: 'hazard', size: .11, rot: 0, hit: 'bonk', stun: .5, pose: 'bonk', poseTime: .9,
          banner: 'OUCH!', sfx: 'bonk', particles: ['#7ccb3f', '#fff'] },
```
4. Add it to a level's `weights`.
5. (optional) `index.html` → add a row to the How-to-Play legend.

`kind` drives behaviour in `Game.onCatch`:
`score` → adds `score × mult`; `coin` → adds `coins`; `power` → starts `power` for `dur`; `hazard` → −1 life + `stun` + `pose`.

## 3. Add a power-up

1. Create the item with `kind: 'power'`, `power: 'shield'`, `dur: 5`, `banner: 'SHIELD!'`.
2. `src/game/items.js` → `POWERS.shield = { icon: 'shield', label: '' }`.
3. `src/game/game.js` → in `newState` add `shield: 0` to `powers`; implement its effect
   where relevant (e.g. in `onCatch` hazard branch: `if (S.powers.shield > 0) { S.powers.shield = 0; return; }`).
4. The HUD badge with countdown appears automatically (`HUD.update` iterates `S.powers`).

## 4. Add a sound

`src/core/audio.js` → add a key to `lib` using `tone()` / `noise()`, then reference it
with `sfx: '<key>'` on an item, or call `SFX.play('<key>')` anywhere.
For recorded audio later: put files under `assets/audio/` and add a small sample player
in the same file — keep the same keys so nothing else changes.

## 5. Add a background theme

`src/game/background.js` → `THEMES`:

```js
night: {
  sky: 'sky_night', clouds: ['cloud0', 'cloud1', 'cloud2'], frame: 'trees_night',
  layers: [
    { key: 'mountains_night', depth: .15, bottom: .62 },
    { key: 'village_night',   depth: .30, bottom: .80 },
    { key: 'foreground_night',depth: .55, bottom: 1.03, front: true },
  ],
},
```
Register the images in `assets.js`, then set `theme: 'night'` on a level.
Layer images should be transparent PNG/WebP with the artwork anchored at the bottom;
`bottom` is where the layer's bottom edge sits (fraction of stage height).

## 6a. Replace / extend puppy animation sheets

Sheets live in `assets/images/puppy/`. Each is one horizontal row of equal-width cells, feet aligned to the
bottom edge, character horizontally centred per cell. `Puppy.SHEETS` in `src/game/puppy.js` declares
`{ key, frames }` for `idle` and `run`. To swap in a run sheet with a different count: replace the file, set `frames: N` — everything reads
`SHEETS.run.frames`. Keep the bob phase (`frame - N/3`) at the gather pose. Recommended 8–16 frames; normalise
frame scale by alpha-area before packing (see the 0.6.0 build notes).

## 6. Add a puppy pose

1. `assets/images/puppy/puppy_<pose>.webp` + manifest entry `puppy_<pose>`.
2. `src/game/puppy.js` → `draw()`: add an `if (this.pose === '<pose>')` line choosing the image and size.
3. Trigger with `puppy.setPose('<pose>', seconds)` or via an item's `pose` field.

## 7. Add a screen / scene (e.g. level select, shop)

1. `index.html` → `<div class="scene" id="sceneShop"> … </div>` (use `.topbar`, `.btn`, `.pill` etc.).
2. `src/scenes/shop.js`:

```js
const ShopScene = (() => {
  function bind(app) { document.querySelector('#btnShopBack').onclick = () => app.goMenu(); }
  return { bind, enter() { BG.setAmp(1); /* fill list */ }, exit() {}, frame(now, dt) { BG.draw(now, dt); } };
})();
```
3. `src/app.js` → add `shop: { obj: ShopScene, dom: 'sceneShop' }` to `SCENES`, call `ShopScene.bind(app)`, and navigate with `app.go('shop')`.
4. Add the `<script>` tag before `app.js`.

## 8. Tune the puppy

`src/core/config.js` → `PUPPY`: `WIDTH_FRAC` (size), `MAX_SPEED`, `ACCEL`, `FRICTION`, `DRAG_SPRING`, `INVINCIBLE_TIME`.

## 9. Add a modal

`index.html` → `<div class="modal" id="modalX"><div class="card">…<button data-close>OK</button></div></div>`
then `Modals.open('#modalX')`. Add the id to `STICKY` in `modals.js` if it must not close on backdrop tap.

## 10. Add an ambient actor (background life)

`src/game/ambient.js`. Three kinds exist: `cars`, `walkers`, `birds`.
- **New car**: drop `assets/images/ambient/car3.webp` (side view facing right), register in `assets.js`, change `Math.floor(Math.random() * 3)` → `* 4` in `spawnCar`.
- **New walker**: a horizontal sheet of N equal frames (feet aligned to the bottom) → `walker2_sheet.webp`; register; bump the random range in `spawnWalker` (and `frames` if N ≠ 4).
- **New kind** (e.g. a tractor, a hot-air balloon): add an array + `spawnX()` + update/draw pass mirroring the existing ones, and a `CFG` entry for its interval/cap.
Keep densities low — `CFG.MAX_*` caps protect the play area from getting busy.


## 11. Animated water on a background layer

Any far/mid layer can carry a `water: '<maskKey>'` entry in `BG.THEMES[...].layers`. The mask is a greyscale image the
same aspect as the layer (white = water). `drawWater()` in `src/game/background.js` paints drifting ripple bands and
sun glints into an offscreen canvas, clips with the mask, and composites at `WATER.ALPHA`. To make a mask for a new
painting: threshold the blue hue band (H 170–225°, S > .25) below the horizon, close/fill holes, keep components
> 1500 px, multiply by the layer's alpha, blur 2 px, save as webp (see the 0.5.0 build notes).


## 12. Item fall profiles & per-level background life

- Give an item a `fall` key in `items.js` (`tumble | flutter | heavy | float`) or add a new profile to `Spawner.FALL`
  in `spawner.js` (`start`, `accel`, `term`, `sway [amp, hz]`, `spin`, `wobble`).
- Each level may set `ambient: { birds, walkers, cars }` (0–1, 0 = none). Omit for full density. Use this to let the
  world "wake up" as the player progresses through a location.

## Adding a level goal (3rd star)

Each level in `src/game/levels.js` has a `goal`, e.g. `{ type: 'coins', count: 12 }`.
Available types live in `src/game/goals.js` → `GOALS`:

| type | config | done when |
|---|---|---|
| `bonesIn` | `count, seconds` | N bones caught before T seconds of run time |
| `coins` | `count` | N coins collected in the run |
| `noBomb` | – | level cleared without ever getting dizzy |
| `power` | `count` | N power-ups grabbed |

To add a type, add an entry with `label / init / on / done` (optionally `failed`, `progress`, `survive`).
`on` receives `'catch'` and `'hit'` events with the item; nothing else needs to change — the HUD chip,
map card and win card all read from `GOALS`. Star 1 (target) and star 2 (no heart lost) are automatic.

The level-select board pages itself from `LEVELS.length` (10 tiles per page) — nothing to lay out. Optional: add `assets/images/levels/thumb_<id>.webp` (4:3, ~520 px) for the details card; otherwise level 1's thumbnail is used.
