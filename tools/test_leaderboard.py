#!/usr/bin/env python3
"""BONK! leaderboard tests — runs the real page headless and checks every rule in docs/LEADERBOARD.md.
    python3 tools/test_leaderboard.py          (needs playwright; starts its own server)"""
import functools, http.server, socketserver, threading, time, sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
fail = []
def ok(m): print('  ✓', m)
def bad(m): print('  ✗', m); fail.append(m)
def T(cond, msg): (ok if cond else bad)(msg)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT))); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html?a={int(time.time())}'

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = br.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    ready = lambda: (pg.wait_for_function('document.querySelector("#loader.done")', timeout=20000), pg.wait_for_timeout(300))
    pg.goto(URL); ready(); pg.evaluate('localStorage.clear()'); pg.reload(); ready()

    print('1. local-first recording')
    r = pg.evaluate('''() => { const c0 = Leaderboard.calls; Events.emit('progress', {id:1, score:333, cleared:false, stars:[0,0,0]});
        return { latest: Save.get('lb.latest'), best: Save.get('lb.best'), win: Leaderboard.windowUsed(), calls: Leaderboard.calls - c0, adapter: Leaderboard.adapterName }; }''')
    T(r['latest'] == 333 and r['best'] == 333, f'run score saved locally at once {r}')
    T(r['adapter'] == 'mock', 'mock adapter in use (no ENDPOINT configured)')
    pg.wait_for_timeout(700)
    boot = pg.evaluate('() => ({ calls: Leaderboard.calls, used: Leaderboard.windowUsed(), cached: !!Leaderboard.getCache() })')
    T(boot['calls'] == 1 and boot['used'] and boot['cached'], f'boot used this window exactly once, cache written {boot}')
    r2 = pg.evaluate('''() => { const c0 = Leaderboard.calls; for (let i=0;i<5;i++) Events.emit('progress', {id:1, score:400+i, cleared:false, stars:[0,0,0]}); return Leaderboard.calls - c0; }''')
    pg.wait_for_timeout(300)
    T(r2 == 0 and pg.evaluate('Leaderboard.calls') == 1, f'5 more runs → 0 extra server calls (window already used)')

    print('2. view opens from cache + local best instantly')
    v0 = pg.evaluate('() => Leaderboard.view("world")')
    T(v0['me']['score'] == 404 and v0['synced'] and v0['me']['rank'] is None and len(v0['top']) == 10, f'boot-synced with score 0 → top 10 cached, I am unranked, my row shows LOCAL best 404')
    pg.evaluate('''async () => { Save.set('lb.lastWindow', null); await Leaderboard.syncIfDue('test'); Save.update(d => { d.lb.best = 404; }); }''')   # next window: upload
    v = pg.evaluate('() => Leaderboard.view("world")')
    T(v['me']['score'] == 404 and v['synced'] and v['me']['rank'], f'after sync: ranked #{v["me"]["rank"]} of {v["total"]}')
    T(len(v['top']) == 10 and all(v['top'][i]['score'] >= v['top'][i+1]['score'] for i in range(9)), 'world top 10 present & sorted')
    ar = v['around']; me_i = next(i for i, x in enumerate(ar) if x['me'])
    T(me_i == 7 and len(ar) == 13, f'around = 7 above + me + 5 below (got {me_i} above, {len(ar)} total)')
    ranks = [x['rank'] for x in ar]
    T(ranks == list(range(ranks[0], ranks[0] + 13)) and ranks[0] > 10, f'contiguous ranks {ranks[0]}–{ranks[-1]}, no overlap with top 10')
    T(all(ar[i]['score'] >= ar[i+1]['score'] for i in range(12) if not ar[i]['me'] and not ar[i+1]['me']), 'neighbours sorted by score')
    vc = pg.evaluate('() => Leaderboard.view("country")')
    T(vc['country'] == vc['top'][0]['country'] and all(x['country'] == vc['country'] for x in vc['top']), f'country board separate, all rows {vc["country"]}')
    T(v['me']['rank'] != vc['me']['rank'], f'world rank {v["me"]["rank"]} ≠ country rank {vc["me"]["rank"]}')

    print('3. forced sync uploads best & updates rank; in-Top-10 has no around slice')
    before = v['me']['rank']
    s = pg.evaluate('''async () => { Save.set('lb.lastWindow', null); const c = await Leaderboard.syncIfDue('test'); return { rank: c.world.rank, serverBest: Save.get('lb.serverBest'), calls: Leaderboard.calls }; }''')
    T(s['serverBest'] == 404 and s['rank'] == before and s['calls'] == 3, f'sync with no improvement is read-only, rank stays #{s["rank"]} {s}')
    s = pg.evaluate('''async () => { Events.emit('progress', {id:1, score:2500, cleared:false, stars:[0,0,0]}); Save.set('lb.lastWindow', null); const c = await Leaderboard.syncIfDue('test'); return { rank: c.world.rank, serverBest: Save.get('lb.serverBest'), calls: Leaderboard.calls }; }''')
    T(s['serverBest'] == 2500 and s['rank'] < before, f'better score 2500 uploaded, rank {before} → {s["rank"]}')
    top = pg.evaluate('''async () => { Events.emit('progress', {id:1, score:99999, cleared:false, stars:[0,0,0]}); Save.set('lb.lastWindow', null); await Leaderboard.syncIfDue('test'); const v = Leaderboard.view('world'); return { rank: v.me.rank, inTop: v.inTop, around: v.around.length, dup: v.top.filter(r => r.me).length, n: v.top.length }; }''')
    T(top['rank'] == 1 and top['inTop'] and top['around'] == 0 and top['dup'] == 1 and top['n'] == 10, f'#1 → top has me once, around empty {top}')

    print('4. UI')
    pg.click('#btnBoard', force=True); pg.wait_for_timeout(400)
    ui = pg.evaluate('''() => ({ open: Modals.isOpen('#modalBoard'), rows: document.querySelectorAll('#lbList .lb-row').length, me: document.querySelectorAll('#lbList .lb-row.me').length,
        meTxt: document.querySelector('#lbMe').textContent, tech: /ago|sync|updated/i.test(document.querySelector('#modalBoard').textContent) })''')
    T(ui['open'] and ui['rows'] == 10 and ui['me'] == 1, f'board open, 10 rows, me highlighted once {ui["rows"]}')
    T('#1' in ui['meTxt'] and '99,999' in ui['meTxt'], f'header shows my rank + local score: {ui["meTxt"]!r}')
    T(not ui['tech'], 'no "updated X ago"/sync text shown')
    pg.screenshot(path=str(ROOT / 'docs/screenshots/leaderboard_top.jpg'), quality=82, type='jpeg')
    pg.click('#lbCountryTab', force=True); pg.wait_for_timeout(200)
    T(pg.evaluate('document.querySelectorAll("#lbList .lb-row.me").length') == 1, 'country tab renders with me')
    # mid-pack player view
    pg.evaluate('''async () => { Modals.closeAll(); Save.update(d => { d.lb.best = 0; d.lb.serverBest = 0; d.lb.latest = 0; d.best = 0; d.lb.lastWindow = null; d.profile.uid = 'newbie' + Date.now(); }); Leaderboard.clearCache();
        Events.emit('progress', {id:1, score:1450, cleared:false, stars:[0,0,0]}); await new Promise(r => setTimeout(r, 600)); }''')
    pg.click('#btnBoard', force=True); pg.wait_for_timeout(400)
    mid = pg.evaluate('''() => ({ rows: document.querySelectorAll('#lbList .lb-row').length, near: !!document.querySelector('.lb-gap'), meIdx: [...document.querySelectorAll('#lbList .lb-row')].findIndex(r => r.classList.contains('me')), rank: Leaderboard.view('world').me.rank })''')
    T(mid['rows'] == 23 and mid['near'] and mid['meIdx'] == 17, f'mid-pack: 10 top + 13 near (me at index 17) rank #{mid["rank"]}')
    pg.screenshot(path=str(ROOT / 'docs/screenshots/leaderboard_mid.jpg'), quality=82, type='jpeg')

    print('5. never-synced / offline player')
    pg.evaluate('''() => { Modals.closeAll(); Leaderboard.clearCache(); Save.update(d => { d.lb.lastWindow = Leaderboard.windowKey(); }); }''')
    off = pg.evaluate('''() => { const v = Leaderboard.view('world'); return { synced: v.synced, top: v.top.length, me: v.around.length === 1 && v.around[0].me, rank: v.me.rank, score: v.me.score }; }''')
    T(not off['synced'] and off['top'] == 0 and off['me'] and off['rank'] is None and off['score'] == 1450, f'no cache → still shows my local score, no rank {off}')
    pg.click('#btnBoard', force=True); pg.wait_for_timeout(300)
    T(pg.evaluate('document.querySelectorAll("#lbList .lb-row.me").length') == 1, 'board renders with cache empty (no crash)')
    pg.evaluate('Modals.closeAll()')

    print('6. reset & flag')
    pg.evaluate('window.confirm = () => true'); pg.click('#btnSettings', force=True); pg.wait_for_timeout(200); pg.click('#btnResetProgress', force=True); pg.wait_for_timeout(300)
    T(pg.evaluate('!Leaderboard.getCache() && Save.get("lb.best") === 0') , 'reset clears cache + local lb')
    pg.goto(URL + '&flag_leaderboard_enabled=0'); ready(); pg.evaluate('localStorage.removeItem("bonk_lb_cache")')
    c0 = pg.evaluate('Leaderboard.calls'); pg.evaluate('Events.emit("progress",{id:1,score:50,cleared:false,stars:[0,0,0]})'); pg.wait_for_timeout(500)
    T(pg.evaluate('Leaderboard.calls') == c0 == 0, 'flag off → no server calls, local record still works: ' + str(pg.evaluate('Save.get("lb.latest")')))
    T(not errs, f'console errors: {len(errs)}')
    for e in errs[:5]: print('     ', e[:200])
    br.close()
srv.shutdown()
print('\nRESULT:', 'PASS ✅' if not fail else f'FAIL ❌ ({len(fail)})')
sys.exit(1 if fail else 0)
