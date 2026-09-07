#!/usr/bin/env python3
"""BONK! level balance sweep — a scripted player plays EVERY level N times and reports the curve.
    python3 tools/sim_levels.py [runs=2] [levels=1-16]     (server on :8080; needs playwright)

Two bots per level:
  • "good"    – look-ahead player who dodges hazards and chases value (should clear every level ≥ 50 %)
  • "perfect" – same bot with hazards spawn-suppressed (verifies the 3rd-star goal is achievable at all)
For each level prints: win rate, avg score/target, avg duration, stars, hearts lost, and the mechanic events
seen (gusts, squirrel grabs, waves) so a mechanic that never fires shows up as a bug. Exit 1 if any level is
unwinnable for the good bot in every run, or the goal is unreachable for the perfect bot.
"""
import sys, time, json, pathlib
from playwright.sync_api import sync_playwright

RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
lv = sys.argv[2] if len(sys.argv) > 2 else '1-16'
a, b = (lv.split('-') + [lv])[:2]; LEVELS = list(range(int(a), int(b) + 1))
URL = f'http://localhost:8080/index.html?a={int(time.time())}'

BOT = r'''
window.__bot = (() => {
  let on=false, raf=0, stats={frames:0,dodges:0}, hold=null;   // hold = committed dodge target while danger persists
  const key=(k,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{key:k}));
  let cur=null; const press=k=>{ if(cur===k) return; if(cur) key(cur,false); cur=k; if(k) key(k,true); };
  const val = (S,it) => {                                   // goal-aware item value
    const g = S.level.goal && S.level.goal.type, d = it.def;
    if (d.kind==='hazard') return -1;
    let v = d.kind==='score' ? (d.score||10) : d.kind==='power' ? 30 : 8;
    if (g==='coins' && it.type==='coin') v += 14;
    if (g==='power' && d.kind==='power') v += 20;
    if (g==='goldBones' && it.type==='goldbone') v += 40;
    if (g==='bonesIn' && it.type==='bone') v += 6;
    return v;
  };
  function think(){
    if(!on) return; raf=requestAnimationFrame(think);
    const S=Game.state; if(!S||!Game.active||Game.paused){ press(null); return; }
    stats.frames++;
    const W=BG.W,box=Game.puppy.box,pw=box.pw,wind=Mechanics.windX*W*.30,vx=Game.puppy.vx;
    const px = box.cx + vx/12;                              // where the puppy STOPS if we release now (friction 12/s)
    const HOR=1.3, items=S.spawner.items, haz=[];
    // contact window of a falling thing: t0 = when it can first touch the puppy's head, t1 = when it has passed his feet (then it's gone)
    const arrive = it => { const r=it.size*.36, v=Math.max(1,it.vy), t0=(box.y-r-it.y)/v, t1=(box.y+box.h+r-it.y)/v, tta=(box.y-it.y)/v;
      const m=it.F===Spawner.FALL.heavy?0:it.F===Spawner.FALL.tumble?.7:1; return { t0, t1, tta, fx: it.x + wind*m*Math.max(0,tta) }; };
    for (const it of items) if (it.def.kind==='hazard') { const a=arrive(it); if (a.t1 > 0 && a.t0 < HOR) haz.push({it, ...a}); }
    const clear = x => { let c=1e9; for (const h of haz) c=Math.min(c, Math.abs(h.fx-x) - h.it.size*.36 - box.w*.5); return c; };
    const nearGoal = S.level.goal && S.level.goal.type==='nearMiss';
    const SAFE = pw*.20, MAXV = W*1.05;
    const edge = Math.max(W*.06, Game.puppy.width*.42) + 2, LO = edge, HI = W - edge;      // the puppy's real clamp
    const reach = x => Math.abs(x-px)/MAXV + .10;
    const hits = (h, x) => Math.abs(h.fx-x) - h.it.size*.36 - box.w*.5 < SAFE;
    // Standing at x is safe if (a) no hazard over x is in contact during [arrival-.05, arrival+.5] and
    // (b) every hazard we run under is either already past our feet or still above our head when we cross it.
    const safeAt = x => { const ta = reach(x);
      for (const h of haz) {
        if (hits(h,x) && h.t0 < ta + .5 && h.t1 > ta - .05) return false;
        const lo=Math.min(px,x)-SAFE*.6, hi=Math.max(px,x)+SAFE*.6;
        if (h.fx>lo && h.fx<hi && Math.abs(h.fx-px) > SAFE*.5) { const tc=Math.abs(h.fx-px)/MAXV + .08; if (h.t0 - .10 < tc && tc < h.t1 + .05) return false; } }
      return true; };
    let goal=null;
    // near-miss goal: brave mode — the hazard's landing spot is certain once it's below ~40 % height; stand just outside its edge
    let flirt=null;
    if (nearGoal && S.goal && Goals.progress(S) < 1) { const h=haz.filter(x=>x.t0>0 && x.it.y > BG.H*.35).reduce((m,x)=>!m||x.t0<m.t0?x:m, null);
      if (h && h.t0 < .8) { const side = box.cx<h.fx?-1:1; const g = h.fx + side*(box.w*.5 + h.it.size*.36 + pw*.09);
        if (g>=LO && g<=HI && reach(g) < h.t0 - .03 && haz.every(o => o===h || !(Math.abs(o.fx-g) - o.it.size*.36 - box.w*.5 < SAFE && o.t0 < reach(g)+.6 && o.t1 > reach(g)-.05))) flirt = g; } }
    const threatened = haz.some(h => hits(h,px) && h.t0 < .9 && h.t1 > 0);
    if (flirt != null) { goal = flirt; hold = null; }
    else if (threatened) {
      stats.dodges++;
      let best=null;
      for (let k=0;k<=24;k++) for (const d of (k? [1,-1] : [1])) { const x=px+d*k*pw*.12; if (x<LO||x>HI) continue; if (!safeAt(x)) continue;
        const cost=k + (hold!=null ? Math.abs(x-hold)/pw*3 : 0) + (nearGoal ? Math.max(0, clear(x)-pw*.16)/pw*4 : 0);
        if (!best||cost<best.cost) best={x,cost}; }
      if (!best) {                                              // nothing provably safe: least-bad = where the contact window is furthest from our arrival
        let bestS=-1; for (let k=0;k<=24;k++) for (const d of [1,-1]) { const x=px+d*k*pw*.12; if (x<LO||x>HI) continue; let sc=1e9; for (const h of haz) if (hits(h,x)) sc=Math.min(sc, h.t0 > reach(x) ? h.t0-reach(x) : reach(x)-h.t1); if (sc>bestS) { bestS=sc; best={x}; } } }
      goal = best ? (Math.abs(best.x-px) < 1 ? null : best.x) : null;
      hold = goal;
    } else {
      hold = null;
      let target=null;
      for (const it of items) { if (it.def.kind==='hazard') continue; const a=arrive(it); if (a.tta<=0||a.tta>2.4) continue;
        const fx = Math.max(LO, Math.min(HI, a.fx));
        if (!safeAt(fx)) continue;                                // never chase into / under a rock
        const v = val(S,it) - Math.abs(fx-px)/W*20 - a.tta*4;
        if (!target||v>target.v) target={v, fx}; }
      if (target) goal=target.fx;
    }
    if(goal==null){ press(null); return; }
    const dx=goal-px; if(Math.abs(dx)<pw*.08) press(null); else press(dx>0?'ArrowRight':'ArrowLeft');
  }
  return { start(){ on=true; hold=null; think(); }, stop(){ on=false; cancelAnimationFrame(raf); press(null); }, stats };
})();
// perfect mode: hazards never spawn (goal reachability check)
window.__perfect = on => { if(!window.__origPick) window.__origPick = Spawner.pick;
  Spawner.pick = on ? (w => { const k = window.__origPick(w); return ITEMS[k].kind==='hazard' ? 'bone' : k; }) : window.__origPick; };
'''

def play(pg, idx, perfect, timeout=240):
    pg.evaluate(f'__perfect({str(perfect).lower()})')
    # unlock through the real save (levels before idx count as cleared), then use the real board: tile → PLAY
    pg.evaluate(f'for (let i = 0; i < {idx}; i++) if (!Store.isCleared(LEVELS[i].id)) Store.recordLevel(LEVELS[i].id, 1, true); HomeScene.enter()')
    pg.evaluate(f'HomeScene.enter(); (function(){{ const b=document.querySelector(\'.tile[data-i="{idx}"]\'); if(!b) document.querySelector("#lsNext").click(); }})()'); pg.wait_for_timeout(250)   # tile may be on page 2
    pg.evaluate(f'document.querySelector(\'.tile[data-i="{idx}"]\').click()'); pg.wait_for_timeout(150)
    pg.evaluate('document.querySelector("#lsPlay").click()')
    pg.wait_for_function('Game.active', timeout=15000)
    pg.evaluate('__bot.start()')
    t0 = time.time()
    while time.time() - t0 < timeout:
        pg.wait_for_timeout(500)
        st = pg.evaluate('''() => ({ win: Modals.isOpen("#modalWin"), lose: Modals.isOpen("#modalOver") })''')
        if st['win'] or st['lose']: break
    ev = pg.evaluate('({...Mechanics.stats})')
    pg.evaluate('__bot.stop()')
    S = pg.evaluate('''() => { const S=Game.state; return S ? { timeout: !Modals.isOpen("#modalWin") && !Modals.isOpen("#modalOver"), score:S.score, target:S.level.target, time:Math.round(S.time), lives:S.lives, cleared:S.cleared, stars:S.stars||null, hearts:S.heartsLost||0, combo:S.combo.bestMult, dodged:S.dodged||0, goal: S.goal ? Goals.progress(S) : null } : null }''')
    if S['timeout']: pg.evaluate('Game.stop && Game.stop(); Modals.closeAll()'); pg.evaluate('document.querySelector("#btnPause").click()'); pg.wait_for_timeout(200); pg.evaluate('document.querySelector("#btnQuit").click()')
    else: pg.evaluate(f'document.querySelector("{"#btnWinHome" if S["cleared"] else "#btnHome"}").click()')
    pg.wait_for_timeout(300)
    S['ev'] = ev; return S

fails = []
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('document.querySelector("#loader.done")', timeout=20000)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_function('document.querySelector("#loader.done")', timeout=20000); pg.wait_for_timeout(300)
    pg.evaluate(BOT); pg.evaluate('Store.setFtueDone(true)')
    n = pg.evaluate('LEVELS.length'); print(f'levels loaded: {n}')
    print(f'{"L":>2} {"name":<18} {"mode":<8} {"win":>4} {"score/target":>13} {"t(s)":>5} {"♥lost":>5} {"stars":>6} {"goal":>5} {"combo":>5} {"dodge":>5}  events')
    for L in LEVELS:
        if L > n: break
        idx = L - 1
        for mode in ('good', 'perfect'):
            runs = RUNS if mode == 'good' else 1
            wins = 0; rows = []
            for r in range(runs):
                S = play(pg, idx, mode == 'perfect')
                rows.append(S); wins += 1 if S['cleared'] else 0
                stars = ''.join('★' if s else '☆' for s in (S['stars'] or [False]*3))
                print(f'{L:>2} {pg.evaluate(f"LEVELS[{idx}].name"):<18} {mode:<8} {"W" if S["cleared"] else ("T" if S["timeout"] else "L"):>4} {S["score"]:>6}/{S["target"]:<6} {S["time"]:>5} {S["hearts"]:>5} {stars:>6} {round(S["goal"] or 0,2):>5} x{S["combo"]:>4} {S["dodged"]:>5}  {S["ev"]}')
            if mode == 'good': good_rows = rows
            if mode == 'good' and wins == 0: fails.append(f'L{L}: good bot lost all {runs} runs')
            gtype = pg.evaluate(f'(LEVELS[{idx}].goal||{{}}).type')
            if mode == 'perfect' and gtype not in ('nearMiss', 'dodge') and not any(x['stars'] and x['stars'][2] for x in rows + good_rows): fails.append(f'L{L}: 3rd star never reached (goal progress {S["goal"]})')
            if mode == 'good' and gtype in ('nearMiss', 'dodge') and not any(x['stars'] and x['stars'][2] for x in rows): fails.append(f'L{L}: {gtype} goal never completed in {runs} good runs')
            # mechanics must actually fire when configured
            mods = pg.evaluate(f'LEVELS[{idx}].modifiers') or {}
            if mode == 'good':
                agg = {k: sum(x['ev'][k] for x in rows) for k in ('gusts', 'grabs', 'waves')}
                if mods.get('wind') and not agg['gusts']: fails.append(f'L{L}: wind configured but no gust observed')
                if mods.get('waves') and not agg['waves']: fails.append(f'L{L}: waves configured but none observed')
    br.close()
print('\nconsole errors:', errs[:5] if errs else 'none')
for f in fails: print('✗', f)
print('RESULT:', 'PASS ✅' if not fails and not errs else 'FAIL ❌')
sys.exit(0 if not fails and not errs else 1)
