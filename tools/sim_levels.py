#!/usr/bin/env python3
"""BONK! level balance sweep — a scripted player plays EVERY level N times and reports the curve.
    python3 tools/sim_levels.py [runs=2] [levels=1-10]     (server on :8080; needs playwright)

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
lv = sys.argv[2] if len(sys.argv) > 2 else '1-10'
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
    const arrive = it => { const tta=(box.y-it.y)/Math.max(1,it.vy); const m=it.F===Spawner.FALL.heavy?0:it.F===Spawner.FALL.tumble?.7:1; return { tta, fx: it.x + wind*m*Math.max(0,tta) }; };
    for (const it of items) if (it.def.kind==='hazard') { const a=arrive(it); if (a.tta>-0.15 && a.tta<HOR) haz.push({it, ...a}); }
    const clear = x => { let c=1e9; for (const h of haz) c=Math.min(c, Math.abs(h.fx-x) - h.it.size*.36 - box.w*.5); return c; };
    const nearGoal = S.level.goal && S.level.goal.type==='nearMiss';
    const SAFE = pw*.20, MAXV = W*1.05;
    const crosses = (x0, x1) => { const lo=Math.min(x0,x1)-SAFE*.5, hi=Math.max(x0,x1)+SAFE*.5; return haz.some(h => h.fx>lo && h.fx<hi); };   // path passes under a falling hazard
    let goal=null;
    if (clear(px) < SAFE) {                                 // in danger → nearest safe spot we can reach without crossing under another hazard
      stats.dodges++;
      let best=null;
      for (let k=1;k<=18;k++) for (const d of [1,-1]) { const x=box.cx+d*k*pw*.12; if (x<W*.07||x>W*.93) continue; if (clear(x)<SAFE) continue;
        // don't run under a *different* hazard on the way
        const lo=Math.min(box.cx,x), hi=Math.max(box.cx,x); let through=false; for (const h of haz) { if (Math.abs(h.fx-box.cx) - h.it.size*.36 - box.w*.5 < SAFE) continue; if (h.fx>lo&&h.fx<hi) through=true; } if (through) continue;
        const cost=k + (hold!=null && Math.sign(x-box.cx)!==Math.sign(hold-box.cx) ? 6 : 0) + (nearGoal ? Math.max(0, clear(x)-pw*.16)/pw*4 : 0);
        if (!best||cost<best.cost) best={x,cost}; }
      goal = best ? best.x : hold != null ? hold : (box.cx < W*.5 ? W*.92 : W*.08);
      hold = goal;
    } else {
      hold = null;
      let target=null;
      for (const it of items) { if (it.def.kind==='hazard') continue; const a=arrive(it); if (a.tta<=0||a.tta>2.4) continue;
        if (clear(a.fx) < SAFE*1.3 || crosses(px, a.fx)) continue;         // never chase into / under a rock
        const v = val(S,it) - Math.abs(a.fx-px)/W*20 - a.tta*4;
        if (!target||v>target.v) target={v, fx:a.fx}; }
      if (target) goal=target.fx;
      else if (nearGoal && haz.length) { const h=haz.reduce((m,x)=>x.tta<m.tta?x:m); const side = box.cx<h.fx?-1:1; goal = h.fx + side*(box.w*.5 + h.it.size*.36 + pw*.09); if (crosses(px, goal)) goal=null; }   // flirt with the rock
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

def play(pg, idx, perfect, timeout=200):
    pg.evaluate(f'__perfect({str(perfect).lower()})')
    # unlock through the real save (levels before idx count as cleared), then use the real board: tile → PLAY
    pg.evaluate(f'for (let i = 0; i < {idx}; i++) if (!Store.isCleared(LEVELS[i].id)) Store.recordLevel(LEVELS[i].id, 1, true); HomeScene.enter()')
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
