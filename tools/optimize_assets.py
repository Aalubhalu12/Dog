#!/usr/bin/env python3
"""Convert any PNG/JPG dropped in assets/images/** to WebP and remove the originals.
Usage:  python3 tools/optimize_assets.py            (needs Pillow)
Keeps alpha; caps sprites at 500px wide, backgrounds at 900px."""
import sys, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'images'
for p in root.rglob('*'):
    if p.suffix.lower() not in ('.png', '.jpg', '.jpeg'): continue
    im = Image.open(p).convert('RGBA'); cap = 900 if p.parent.name == 'bg' else 500
    if im.width > cap: im = im.resize((cap, int(im.height * cap / im.width)), Image.LANCZOS)
    out = p.with_suffix('.webp'); im.save(out, quality=88, method=6); p.unlink(); print('->', out.relative_to(root), im.size)
