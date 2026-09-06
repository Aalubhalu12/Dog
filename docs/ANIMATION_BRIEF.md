# BONK! — Brief for AI video tool (puppy animation)

## Background colour: GREEN `#00FF00`
The beagle is tan / white / black with a **pink tongue** — magenta/pink would eat the tongue. Nothing on the dog is green, so green keys cleanly.

## Deliverable format (what to export)
| | Requirement |
|---|---|
| Best | **PNG sequence** (one PNG per frame) — no compression artefacts on edges |
| Fine | **MP4 (H.264) or WebM**, 24 or 30 fps, highest bitrate available |
| Resolution | 1024×1024 or 1280×720 minimum; square (1:1) preferred |
| Length | Run: 2–4 s seamless loop · others: see table |
| Camera | Locked. No zoom, no pan, no shake, no depth-of-field change |
| Motion blur | OFF (if the tool has the option) |
| Shadow | None on the floor (I add the shadow in-game) |

Upload `puppy_reference_green.png` (or `_transparent.png`) as the character reference in every generation so the dog stays identical.

## Prompts (copy-paste)

### 1. RUN — the one we need most
> A cute Pixar-style beagle puppy (tan and white with a black saddle, floppy ears, big brown eyes, pink tongue out), exact same character as the reference image. Pure side view, running to the RIGHT in a happy energetic gallop. The puppy stays fixed in the centre of the frame as if on a treadmill — it does NOT move across the screen. Seamless looping run cycle, body height and head stay level, only legs, ears and tail move. Flat solid green screen background #00FF00, no floor, no shadow, no props, no text. Locked camera, even studio lighting, no motion blur, 3D animated film quality.

### 2. IDLE (optional — I have a still version)
> Same beagle puppy as the reference, standing and facing slightly toward the camera, gentle breathing, one blink, tail wagging slowly, weight shifting a little. Seamless 3-second loop. Flat solid green screen background #00FF00, no floor shadow, locked camera, no motion blur.

### 3. HAPPY CATCH (optional)
> Same beagle puppy as the reference, side view facing right, does one small excited hop with a happy open-mouth smile, lands and returns to a neutral standing pose. About half a second, plays once (not a loop). Flat solid green screen #00FF00, no floor shadow, locked camera, no motion blur.

### 4. BONK (optional)
> Same beagle puppy as the reference, side view facing right, flinches as if something small dropped on its head: eyes squeeze shut, ears flap up, head ducks, then recovers. About half a second, plays once. Flat solid green screen #00FF00, no floor shadow, locked camera.

### 5. DIZZY (optional)
> Same beagle puppy as the reference, standing facing the camera, wobbling dizzily side to side with a dazed expression and crossed eyes, 1–2 second seamless loop. Flat solid green screen #00FF00, no floor shadow, locked camera.

## Negative / avoid (paste in the "negative prompt" box if there is one)
> camera movement, zoom, panning, motion blur, shadow on ground, floor, grass, background objects, text, watermark, multiple dogs, dog moving across frame, changing size, cropped paws or ears, dark green, gradient background

## What happens on my side
You do **not** need to make any game file. Send the clip(s); I will:
1. chroma-key the green + remove spill,
2. find the loop point and pick 8–16 evenly spaced frames,
3. stabilise every frame on the body (saddle-centroid registration) so nothing rocks,
4. pack into the game's sprite sheet **`assets/images/puppy/run_sheet.webp`** (one horizontal strip, equal-width frames, transparent) and retune fps / bob / paw-step timing in `src/game/puppy.js`.

Idle → `idle_sheet.webp`, catch/bonk/dizzy → `puppy_yay.webp`, `puppy_bonk.webp`, `puppy_dizzy.webp` (or short sheets if the motion is worth it).

## Status
- ✅ RUN, HOP (→ idle + yay), BONK, DIZZY delivered and integrated in v0.8.0 (`tools/build_puppy_sheets.py`).
- Still wanted (optional): a dedicated IDLE clip (front/¾ view with blink + tail wag) — currently idle is the calm start of the hop clip.

## v0.12.0 — 24 fps + expression + pseudo-3D pass
- All five sheets are now **consecutive real clip frames at a true 24 fps** (no sub-sampling): idle 20 f (ping-ponged in code, 1.6 s breath), run 16 f (one stride), yay 28 f (1.17 s take-off→smile→landing), bonk 28 f (1.17 s flinch→shake-off), dizzy 26 f (1.08 s loop).
- Expression per state comes from the clips themselves: idle/run = happy neutral (tongue), yay = big smile mid-hop, bonk = squint + ear flap (still = strongest flinch frame), dizzy = crossed eyes + star ring.
- Pipeline: `tools/build_puppy_sheets.py` (key + pack) → `tools/light_puppy.py` **once** (colour grade + pseudo-3D relight: distance-transform "inflated" normal, key light top-left, belly AO, sky rim, warm ground bounce, faint sheen — deliberately subtle).
- Reaction durations in `src/data/items.js` match the clip lengths (yay 1.15 s, bonk 1.2 s, dizzy 1.4 s).
