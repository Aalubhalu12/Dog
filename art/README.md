# art/ — source material (NOT loaded by the game)

| Folder | Contents | Used by |
|---|---|---|
| `reference/` | Original mockups (`mockup_gameplay.png`, `home_mockup.png`), the puppy character reference (green-screen + transparent), **`rig_parts_src.png`** (the magenta-keyed parts sheet the rig is cut from — torso, head, ear, tail, mouth, front leg, hind leg), location layer sources (`*_far_src.png`, `*_mid_src.png`) and the home-screen sources the shipped `assets/images/home/*.webp` were keyed from | design reference, `tools/rig/key_parts.py` |
| `ui/` | Raw sheets the icons / gold bone / shield biscuit were cut from | one-off |

Everything the game actually ships is under `assets/` (all WebP).
The puppy is a **procedural rig** since v0.17 (`src/game/rig.js`): 7 painted parts in `assets/images/puppy/rig/`, animated in code — there are no animation sheets or video clips any more. To repaint him, replace `rig_parts_src.png` (same 3-row layout) and run `python3 tools/rig/key_parts.py`; tune pivots/anchors in `rig.js` with `tools/rig/preview.html`.
