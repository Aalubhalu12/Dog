#!/usr/bin/env python3
"""Bump the game version everywhere it must match:  python3 tools/bump.py 0.9.8
Updates CONFIG.VERSION, every ?v= in index.html, the @imports in styles/main.css, README, and regenerates
sw.js (VERSION + the pre-cache SHELL list = html/css/js/manifest/level data/every shipped image).
Run with the current version (or no argument) to only refresh the SHELL list."""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = ROOT / 'src/core/config.js'; old = re.search(r"VERSION: '([\d.]+)'", cfg.read_text()).group(1)
new = sys.argv[1] if len(sys.argv) > 1 else old
for f in ['src/core/config.js', 'index.html', 'styles/main.css', 'README.md']:
    p = ROOT / f; t = p.read_text()
    t = t.replace(f"VERSION: '{old}'", f"VERSION: '{new}'").replace(f'?v={old}', f'?v={new}').replace(f'**Version:** {old}', f'**Version:** {new}')
    t = re.sub(r'\?v=[\d.]+', f'?v={new}', t) if f in ('index.html', 'styles/main.css') else t   # catch any stragglers
    p.write_text(t); print('  ', f)

# --- service worker: version + app shell -------------------------------------------------------
html = (ROOT / 'index.html').read_text()
shell = ['./', './index.html', './manifest.webmanifest']
shell += sorted(set(re.findall(r'(?:src|href)="((?:src|styles)/[\w/.\-]+)\?v=', html)))
shell += ['styles/' + i for i in re.findall(r'@import url\("([\w./-]+)\?v=', (ROOT / 'styles/main.css').read_text())]
shell += sorted(str(p.relative_to(ROOT)) for p in ROOT.glob('data/levels/*.json'))
shell += sorted(str(p.relative_to(ROOT)) for p in ROOT.glob('assets/**/*') if p.suffix in ('.webp', '.png') and 'rig_parts' not in p.name)
sw = ROOT / 'sw.js'; t = sw.read_text()
t = re.sub(r"const VERSION = '[\d.]+';", f"const VERSION = '{new}';", t)
t = re.sub(r"const SHELL = \[.*?\];", "const SHELL = [\n  " + ",\n  ".join(f"'{s}'" for s in shell) + "\n];", t, flags=re.S)
sw.write_text(t); print(f'   sw.js ({len(shell)} shell files)')
print(f'{old} → {new}. Now add a CHANGELOG entry and run tools/check.py')
