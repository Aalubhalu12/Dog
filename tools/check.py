#!/usr/bin/env python3
"""BONK! smoke test — run before every commit / release.

    python3 tools/check.py            # needs: python3 -m pip install playwright && python3 -m playwright install chromium

What it does
  1. `node --check` on every JS file (syntax)
  2. every image referenced in src/core/assets.js + index.html + src/ exists (no broken asset paths)
  3. every <script src> in index.html exists and the ?v= matches CONFIG.VERSION
  4. starts a throw-away static server, loads the game headless on 3 viewports,
     walks menu → levels → play → pause → resume, asserts ZERO console errors / page errors
  5. saves fresh screenshots to docs/screenshots/ (menu / level_select / gameplay / desktop_frame)
Exit code 0 = all green.
"""
import os, re, subprocess, sys, threading, http.server, socketserver, functools, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
fail = []

def ok(msg): print('  ✓', msg)
def bad(msg): print('  ✗', msg); fail.append(msg)

# 1. JS syntax -------------------------------------------------------------------------------
print('1. JS syntax')
for js in sorted(ROOT.glob('src/**/*.js')):
    r = subprocess.run(['node', '--check', str(js)], capture_output=True, text=True)
    (ok if r.returncode == 0 else bad)(f'{js.relative_to(ROOT)} {r.stderr.strip()[:200]}')

# 2. asset references ------------------------------------------------------------------------
print('2. asset references')
text = ''.join(p.read_text() for p in list(ROOT.glob('src/**/*.js')) + [ROOT / 'index.html'] + list(ROOT.glob('styles/*.css')))
refs = set(re.findall(r"['\"(]((?:assets/)?(?:images|audio)/[\w/.\-]+\.(?:webp|png|jpg|mp3|ogg|wav))", text))
refs |= {'assets/images/' + m for m in re.findall(r"'((?:bg|ambient|puppy|items|ui|brand|levels)/[\w.\-]+\.webp)'", text)}
for r in sorted(refs):
    p = ROOT / (r if r.startswith('assets/') else 'assets/' + r)
    (ok if p.exists() else bad)(str(p.relative_to(ROOT)))
# unreferenced files (informational)
shipped = {str(p.relative_to(ROOT)) for p in ROOT.glob('assets/images/**/*.webp')}
used = {(r if r.startswith('assets/') else 'assets/' + r) for r in refs}
for u in sorted(shipped - used):
    if re.search(r'thumb_\d+\.webp$', u): continue        # thumbnails are built dynamically per level id
    print('  ! unreferenced:', u)

# 3. script tags + version --------------------------------------------------------------------
print('3. index.html scripts + version')
html = (ROOT / 'index.html').read_text()
ver = re.search(r"VERSION\s*:\s*'([\d.]+)'", (ROOT / 'src/core/config.js').read_text()).group(1)
for src, v in re.findall(r'(?:src|href)="((?:src|styles)/[\w/.\-]+)\?v=([\d.]+)"', html):
    (ok if (ROOT / src).exists() else bad)(src)
    if v != ver: bad(f'{src} cache tag ?v={v} != CONFIG.VERSION {ver}')
readme_ver = re.search(r'\*\*Version:\*\* ([\d.]+)', (ROOT / 'README.md').read_text())
if readme_ver and readme_ver.group(1) != ver: bad(f'README version {readme_ver.group(1)} != {ver}')
ok(f'CONFIG.VERSION = {ver}')

# 4. headless run ----------------------------------------------------------------------------
print('4. headless run')
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('  ! playwright not installed — skipping browser test (pip install playwright; python3 -m playwright install chromium)')
    sync_playwright = None

if sync_playwright:
    Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    Handler.log_message = lambda *a, **k: None
    srv = socketserver.TCPServer(('127.0.0.1', 0), Handler); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/index.html?a={int(time.time())}'
    shots = ROOT / 'docs/screenshots'; shots.mkdir(exist_ok=True)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for name, vw, vh, shot in [('phone', 390, 844, True), ('small', 375, 667, False), ('desktop', 1280, 800, True)]:
            errs = []
            pg = br.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=2)
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(url); pg.wait_for_function('document.querySelector("#loader.done") && typeof Game !== "undefined"', timeout=20000)
            pg.wait_for_timeout(900)
            if shot and name == 'phone': pg.screenshot(path=str(shots / 'menu.jpg'), quality=82, type='jpeg')
            if shot and name == 'desktop': pg.screenshot(path=str(shots / 'desktop_frame.jpg'), quality=82, type='jpeg')
            pg.click('#btnLevels', force=True); pg.wait_for_timeout(700)
            if shot and name == 'phone': pg.screenshot(path=str(shots / 'level_select.jpg'), quality=82, type='jpeg')
            pg.click('#lsPlay', force=True); pg.wait_for_timeout(4200)      # countdown → running
            pg.evaluate('Game.puppy.inv=1e9')
            pg.wait_for_timeout(2500)
            if shot and name == 'phone': pg.screenshot(path=str(shots / 'gameplay.jpg'), quality=82, type='jpeg')
            lvl = pg.evaluate('Game.state && Game.state.level && Game.state.level.id')
            pg.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))'); pg.wait_for_timeout(400)
            paused = pg.evaluate('(() => { const m=document.querySelector("#modalPause"); const cs=getComputedStyle(m); return cs.display!=="none" && cs.visibility!=="hidden" && +cs.opacity>0.5; })()')
            fps = pg.evaluate('''() => new Promise(r => { let n=0, t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })''')
            msg = f'{name} {vw}x{vh}: level={lvl} paused={paused} rAF={fps}/s errors={len(errs)}'
            (ok if lvl == 1 and paused and not errs else bad)(msg)
            for e in errs[:5]: print('     ', e[:200])
            pg.close()
        br.close()
    srv.shutdown()

print('\nRESULT:', 'PASS ✅' if not fail else f'FAIL ❌ ({len(fail)})')
sys.exit(1 if fail else 0)
