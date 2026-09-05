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
  6. data layer: v1 → v2 save migration, corrupt-save recovery, level JSON validation, wallet bounds,
     analytics events for a full run (level_start / level_end / retry / quit), reset progress, URL flags
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
for js in sorted(list(ROOT.glob('src/**/*.js')) + list(ROOT.glob('firebase/functions/*.js'))):
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

# 2b. level data files
print('2b. level data')
import json
idx = json.loads((ROOT / 'data/levels/index.json').read_text())
prev = 0
for f in idx['levels']:
    fp = ROOT / 'data/levels' / f
    if not fp.exists(): bad(f'{f} listed in index.json but missing'); continue
    try: L = json.loads(fp.read_text())
    except Exception as e: bad(f'{f}: invalid JSON ({e})'); continue
    req = ['id', 'name', 'target', 'hearts', 'spawn', 'speed', 'ramp', 'safeTime', 'weights']
    miss = [k for k in req if k not in L]
    if miss: bad(f'{f}: missing {miss}')
    elif L['id'] != prev + 1: bad(f'{f}: id {L["id"]} not consecutive (expected {prev + 1})')
    else: ok(f'{f}: L{L["id"]} {L["name"]} target {L["target"]}'); prev = L['id']
extra = sorted(p.name for p in (ROOT / 'data/levels').glob('L*.json') if p.name not in idx['levels'])
for e in extra: print('  ! not in index.json:', e)

# 3. script tags + version --------------------------------------------------------------------
print('3. index.html scripts + version')
html = (ROOT / 'index.html').read_text()
ver = re.search(r"VERSION\s*:\s*'([\d.]+)'", (ROOT / 'src/core/config.js').read_text()).group(1)
for src, v in re.findall(r'(?:src|href)="((?:src|styles)/[\w/.\-]+)\?v=([\d.]+)"', html):
    (ok if (ROOT / src).exists() else bad)(src)
    if v != ver: bad(f'{src} cache tag ?v={v} != CONFIG.VERSION {ver}')
for imp, v in re.findall(r'@import url\("([\w./-]+)\?v=([\d.]+)"\)', (ROOT / 'styles/main.css').read_text()):
    (ok if (ROOT / 'styles' / imp).exists() else bad)(f'styles/{imp}')
    if v != ver: bad(f'styles/main.css @import {imp} cache tag ?v={v} != CONFIG.VERSION {ver}')
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
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    Handler = functools.partial(Quiet, directory=str(ROOT))
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
            pg.wait_for_timeout(300)
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
        # 6. data layer ---------------------------------------------------------------
        print('6. data layer (save v2 / levels / wallet / analytics)')
        errs = []
        pg = br.new_page(viewport={'width': 390, 'height': 844})
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        ready = lambda: (pg.wait_for_function('document.querySelector("#loader.done")', timeout=20000), pg.wait_for_timeout(300))
        pg.goto(url); ready()
        pg.evaluate("""() => { localStorage.clear(); localStorage.setItem('bonk_best','777'); localStorage.setItem('bonk_coins','123');
            localStorage.setItem('bonk_levels', JSON.stringify({1:{best:500,cleared:true,stars:[true,true,false]}})); localStorage.setItem('bonk_set_sound','false'); }""")
        pg.reload(); ready()
        m = pg.evaluate('() => ({ v: Save.doc.v, best: Store.best(), coins: Store.coins(), stars: Store.totalStars(), unlocked: Store.highestUnlocked(), sound: Store.setting("sound"), legacyGone: localStorage.getItem("bonk_levels") === null })')
        (ok if m == {'v': 2, 'best': 777, 'coins': 123, 'stars': 2, 'unlocked': 2, 'sound': False, 'legacyGone': True} else bad)(f'v1 → v2 migration {m}')
        pg.evaluate('() => { Save.flush(); localStorage.setItem("bonk_save", "{broken"); }'); pg.reload(); ready()
        r = pg.evaluate('() => ({ coins: Store.coins(), best: Store.best() })')
        (ok if r == {'coins': 123, 'best': 777} else bad)(f'corrupt main → backup recovery {r}')
        lv = pg.evaluate('() => ({ n: LEVELS.length, bad: Levels.validate({id:0}).length > 3, good: Levels.validate(JSON.parse(JSON.stringify(LEVELS[0]))).length })')
        (ok if lv['n'] >= 3 and lv['bad'] and lv['good'] == 0 else bad)(f'levels from JSON {lv}')
        w = pg.evaluate('() => { const a = Wallet.add(99999, "t"); const s1 = Wallet.spend(5, "t"), s2 = Wallet.spend(1e9, "t"); return { a, s1, s2, c: Wallet.coins() }; }')
        (ok if w['a'] == 5123 and w['s1'] and not w['s2'] and w['c'] == 5118 else bad)(f'wallet bounds {w}')
        pg.click('#lsPlay', force=True); pg.wait_for_timeout(4300)
        pg.evaluate('Game.puppy.inv = 1e9; Game.state.score = Game.state.level.target'); pg.wait_for_timeout(2000)
        pg.click('#btnWinRetry', force=True); pg.wait_for_timeout(500)
        pg.evaluate('document.querySelector("#btnPause").click()'); pg.wait_for_timeout(300); pg.click('#btnQuit', force=True); pg.wait_for_timeout(300)
        a = pg.evaluate('() => ({ ends: Analytics.events("level_end").map(e => e.result), retry: Analytics.events("retry").length, starts: Analytics.events("level_start").length, plays: (Store.levelProgress()[1]||{}).plays, exp: Analytics.export().length > 100 })')
        (ok if a['ends'] == ['win', 'quit'] and a['retry'] == 1 and a['starts'] == 2 and a['plays'] == 1 and a['exp'] else bad)(f'analytics run events {a}')
        pg.evaluate('window.confirm = () => true'); pg.click('#btnSettings', force=True); pg.wait_for_timeout(300); pg.click('#btnResetProgress', force=True); pg.wait_for_timeout(400)
        rs = pg.evaluate('() => ({ u: Store.highestUnlocked(), c: Store.coins(), b: Store.best() })')
        (ok if rs == {'u': 1, 'c': 0, 'b': 0} else bad)(f'reset progress {rs}')
        pg.goto(url + '&flag_shop_enabled=1'); ready()
        fl = pg.evaluate('() => Flags.get("shop_enabled") === true && Flags.get("paws_enabled") === false')
        (ok if fl else bad)('URL flag overrides')
        (ok if not errs else bad)(f'data-layer console errors: {len(errs)}')
        for e in errs[:5]: print('     ', e[:200])
        pg.close()
        br.close()
    srv.shutdown()

# 7. leaderboard (client rules + Cloud Function contract) -------------------------------------------------
print('7. leaderboard')
import subprocess
r = subprocess.run([sys.executable, str(ROOT / 'tools/test_leaderboard.py')], capture_output=True, text=True)
(ok if r.returncode == 0 else bad)(f"tools/test_leaderboard.py: {r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-300:]}")
if r.returncode: print(r.stdout[-1500:])
r = subprocess.run(['node', '--test', 'test/'], cwd=ROOT / 'firebase/functions', capture_output=True, text=True)
(ok if r.returncode == 0 else bad)('firebase/functions/test (node --test): ' + ' '.join(l for l in r.stdout.splitlines() if l.startswith('# pass') or l.startswith('# fail')))

print('\nRESULT:', 'PASS ✅' if not fail else f'FAIL ❌ ({len(fail)})')
sys.exit(1 if fail else 0)
