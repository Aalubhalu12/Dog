#!/usr/bin/env python3
"""Bump the game version everywhere it must match:  python3 tools/bump.py 0.9.8
Updates CONFIG.VERSION, every ?v= in index.html, the @imports in styles/main.css and README."""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
new = sys.argv[1]
cfg = ROOT / 'src/core/config.js'; old = re.search(r"VERSION: '([\d.]+)'", cfg.read_text()).group(1)
for f in ['src/core/config.js', 'index.html', 'styles/main.css', 'README.md']:
    p = ROOT / f; t = p.read_text()
    t = t.replace(f"VERSION: '{old}'", f"VERSION: '{new}'").replace(f'?v={old}', f'?v={new}').replace(f'**Version:** {old}', f'**Version:** {new}')
    t = re.sub(r'\?v=[\d.]+', f'?v={new}', t) if f in ('index.html', 'styles/main.css') else t   # catch any stragglers
    p.write_text(t); print('  ', f)
print(f'{old} → {new}. Now add a CHANGELOG entry and run tools/check.py')
