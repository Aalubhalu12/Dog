# art/ — source material (NOT loaded by the game)

| Folder | Contents | Used by |
|---|---|---|
| `reference/` | Original mockups (`mockup_gameplay.png`, `home_mockup.png`), the puppy character reference (green-screen + transparent) used as the identity reference for every AI video generation, and the generated home-screen sources (`home_plate_source.png`, `home_logo_source.png`, `home_dog_source_a/b.png`) the shipped `assets/images/home/*.webp` were keyed from | design reference, `docs/ANIMATION_BRIEF.md` |
| `clips/` | AI-generated green-screen puppy clips, 24 fps: `run_treadmill.mp4`, `hop.mp4` (idle + yay), `bonk.mp4`, `dizzy.mp4` | `tools/build_puppy_sheets.py` |
| `ui/` | Raw sheets the icons / gold bone / shield biscuit were cut from | one-off |

Everything the game actually ships is under `assets/` (all WebP, ≈3.9 MB).
`art/clips/*.mp4` is git-ignored because of size (≈7 MB) — keep them in Drive/LFS; the pipeline only needs them when re-cutting the puppy sheets.
