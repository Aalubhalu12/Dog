#!/usr/bin/env python3
"""BONK! simulated playtest — a scripted player plays L1→L3 through the real UI and prints a checklist.
    python3 tools/sim_play.py     (server must be running on :8080; needs playwright)
Simulated player: reads game state each frame, steers toward the best good item / away from hazards.
Plays L1 → L2 → L3 through the real UI (countdown, win cards, NEXT LEVEL). Records a checklist."""
import pathlib
SHOTS = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'screenshots'
import json,time
from playwright.sync_api import sync_playwright
URL=f'http://localhost:8080/index.html?a={int(time.time())}'
CL=[]
def check(name, ok, detail=''): CL.append((name, bool(ok), detail)); print(('✓' if ok else '✗'), name, detail)

BOT = r'''
window.__bot = (() => {
  let on=false, raf=0, stats={frames:0, dodges:0};
  const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup', {key:k}));
  let cur=null;
  const press = k => { if (cur===k) return; if (cur) key(cur,false); cur=k; if (k) key(k,true); };
  function think(){
    if(!on) return; raf=requestAnimationFrame(think);
    const S=Game.state; if(!S||!Game.active||Game.paused){ press(null); return; }
    stats.frames++;
    const W=BG.W,H=BG.H,box=Game.puppy.box,px=box.cx, pw=box.pw;
    let target=null, danger=null;
    for(const it of S.spawner.items){
      const tta=(box.y-it.y)/Math.max(1,it.vy);        // seconds until it reaches puppy height
      if(it.def.kind==='hazard'){ if(tta>-0.1 && tta<0.9 && Math.abs(it.x-px)<pw*.9) { if(!danger||tta<danger.tta) danger={it,tta}; } }
      else if(tta>0 && tta<2.2){ const score=(it.def.kind==='score'?(it.def.score||10):it.def.kind==='power'?30:8) - Math.abs(it.x-px)/W*20 - tta*4; if(!target||score>target.score) target={it,score}; }
    }
    let goal=null;
    if(danger){ stats.dodges++; goal = danger.it.x<px ? Math.min(W*.92, px+pw*1.4) : Math.max(W*.08, px-pw*1.4); }
    else if(target){ goal=target.it.x; }
    if(goal==null){ press(null); return; }
    const dx=goal-px; if(Math.abs(dx)<pw*.12) press(null); else press(dx>0?'ArrowRight':'ArrowLeft');
  }
  return { start(){ on=true; think(); }, stop(){ on=false; cancelAnimationFrame(raf); press(null); }, stats };
})();
'''
res={}
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={'width':390,'height':844},device_scale_factor=2); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    ready=lambda: (pg.wait_for_function('document.querySelector("#loader.done")',timeout=20000), pg.wait_for_timeout(300))
    pg.goto(URL); ready(); pg.evaluate('localStorage.clear()'); pg.reload(); ready()
    # ---- menu
    check('Home loads, Level 1 selected', 'Level 1' in pg.evaluate('document.querySelector("#lsTitle").textContent'))
    check('Fresh save: 0 stars, 0 coins', pg.evaluate('Store.totalStars()===0 && Store.coins()===0'))
    check('Levels loaded from JSON (3)', pg.evaluate('LEVELS.length')==3)
    pg.evaluate(BOT)
    # ---- play L1..L3 via UI
    pg.click('#lsPlay',force=True)
    t_start=time.time(); levels_done=[]
    pg.evaluate('__bot.start()')
    for lvl in (1,2,3):
        # wait for countdown to finish
        pg.wait_for_function('Game.active',timeout=15000)
        check(f'L{lvl}: countdown → running', True)
        if lvl==1:
            pg.wait_for_timeout(1500)
            check('FTUE bubble shown for new player', pg.evaluate('document.querySelector("#ftue").classList.contains("on") || Analytics.events("ftue_step").length>0'), pg.evaluate('Analytics.events("ftue_step").map(e=>e.step).join(",")'))
        # let the bot play until win card or game over (cap 150 s game time)
        outcome=None; t0=time.time(); shot=False; combo_seen=0; shield_seen=False; near_seen=0; gold_seen=False
        while time.time()-t0<170:
            pg.wait_for_timeout(500)
            st=pg.evaluate('() => ({ win: Modals.isOpen("#modalWin"), over: Modals.isOpen("#modalOver"), score: Game.state?Game.state.score:0, time: Game.state?Game.state.time:0, lives: Game.state?Game.state.lives:0, combo: Game.state?Game.state.combo.bestMult:0, shield: Game.state?Game.state.shieldSaves:0, near: Game.state?Game.state.nearMisses:0, gold: Game.state?(Game.state._goldSeen||false):false, sh: Game.state?Game.state.powers.shield:0 })')
            combo_seen=max(combo_seen,st['combo']); near_seen=max(near_seen,st['near']); shield_seen=shield_seen or st['shield']>0
            if st['sh']>0 and not shot: pg.screenshot(path=str(SHOTS / f'sim_shield_L{lvl}.jpg'),quality=75,type='jpeg'); shot=True
            if st['win']: outcome='win'; break
            if st['over']: outcome='over'; break
        dur=round(time.time()-t0,1)
        info=pg.evaluate('() => ({ score: Game.state.score, lives: Game.state.lives, stars: Game.state.stars, comboBest: Game.state.combo.best, comboMult: Game.state.combo.bestMult, near: Game.state.nearMisses, shields: Game.state.shieldSaves, bones: Game.state.bones, t: Math.round(Game.state.time) })')
        levels_done.append((lvl,outcome,info))
        check(f'L{lvl}: bot outcome', outcome=='win', f"{outcome} score={info['score']}/{LEVEL_T[lvl-1] if (LEVEL_T:=[400,900,1500]) else 0} in {info['t']}s lives={info['lives']} stars={info['stars']} combo×{info['comboMult']}({info['comboBest']}) near={info['near']} shields={info['shields']}")
        pg.screenshot(path=str(SHOTS / f'sim_result_L{lvl}.jpg'),quality=75,type='jpeg')
        if outcome!='win':
            # retry once with the R key
            pg.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"r"}))'); pg.wait_for_timeout(300)
            check(f'L{lvl}: instant retry (R) restarted', pg.evaluate('!Modals.isOpen("#modalOver") && Game.state.level.id==='+str(lvl)))
            pg.wait_for_function('Game.active',timeout=15000); t0=time.time(); outcome=None
            while time.time()-t0<170:
                pg.wait_for_timeout(500)
                st=pg.evaluate('() => ({ win: Modals.isOpen("#modalWin"), over: Modals.isOpen("#modalOver") })')
                if st['win']: outcome='win'; break
                if st['over']: outcome='over'; break
            check(f'L{lvl}: retry outcome', outcome=='win', outcome)
            if outcome!='win': break
        # win card checks
        wc=pg.evaluate('() => ({ title: document.querySelector("#winTitle").textContent, stars: [...document.querySelectorAll("#winStars img.on")].length, extra: document.querySelector("#wExtra").textContent, btn: document.querySelector("#btnContinue span").textContent, saved: Store.isCleared('+str(lvl)+'), unlocked: Store.highestUnlocked() })')
        check(f'L{lvl}: win card stars={wc["stars"]}, progress saved, next unlocked', wc['saved'] and wc['unlocked']==lvl+1, f'{wc["title"]} | {wc["extra"]} | {wc["btn"]}')
        if lvl<3: pg.click('#btnContinue',force=True)
    pg.evaluate('__bot.stop()')
    # ---- after run
    bot=pg.evaluate('__bot.stats')
    check('Bot ran (frames>0, dodges>0)', bot['frames']>0 and bot['dodges']>0, str(bot))
    a=pg.evaluate('() => ({ starts: Analytics.events("level_start").length, ends: Analytics.events("level_end").map(e=>e.id+":"+e.result+":"+e.starsN+"★"), steps: Analytics.events("combo_step").length, breaks: Analytics.events("combo_break").length, ftue: Analytics.events("ftue_done").length, summary: Analytics.summary() })')
    check('Analytics: level_start per level, level_end per outcome', a['starts']>=3 and len(a['ends'])>=3, ' '.join(a['ends']))
    check('Analytics: combo steps/breaks logged', a['steps']>0, f"steps={a['steps']} breaks={a['breaks']}")
    check('FTUE marked done after L1', pg.evaluate('Store.ftueDone()'), f"ftue_done events={a['ftue']}")
    coins=pg.evaluate('Store.coins()'); check('Coins persisted to wallet', coins>0, f'{coins} coins')
    # ---- persistence across reload + level board
    pg.reload(); ready()
    per=pg.evaluate('() => ({ stars: Store.totalStars(), unlocked: Store.highestUnlocked(), coins: Store.coins(), play: document.querySelector("#lsTitle").textContent.trim(), homeCoins: document.querySelector("#mapCoins").textContent })')
    check('Reload: progress persisted', per['unlocked']>=2 and per['coins']==coins, json.dumps(per))
    pg.wait_for_timeout(300)
    board=pg.evaluate('() => ({ done: document.querySelectorAll(".tile.done").length, cur: document.querySelectorAll(".tile.current").length, locked: document.querySelectorAll(".tile.locked").length })')
    check('Level board reflects progress', board['done']>=1, json.dumps(board))
    pg.screenshot(path=str(SHOTS / 'sim_board.jpg'),quality=75,type='jpeg')
    # ---- pause / resume / hardware-ish flows
    pg.click('#lsPlay',force=True); pg.wait_for_function('Game.active',timeout=15000)
    pg.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))'); pg.wait_for_timeout(300)
    paused=pg.evaluate('Game.paused && Modals.isOpen("#modalPause")')
    pg.click('#btnResume',force=True); pg.wait_for_timeout(300)
    resumed=pg.evaluate('!Game.paused && Game.active')
    check('Pause (Esc) → Resume', paused and resumed)
    pg.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))'); pg.wait_for_timeout(200); pg.click('#btnPauseMap',force=True); pg.wait_for_timeout(400)
    check('Pause → Level board (quit logged)', pg.evaluate('document.querySelector("#sceneHome").classList.contains("active") && Analytics.events("quit").length>0'))
    # ---- settings
    pg.click('#btnBackMenu, #mapBack, .ls-back',force=True) if pg.query_selector('#mapBack, .ls-back') else None
    pg.evaluate('document.querySelector("#btnSettings") && document.querySelector("#btnSettings").click()'); pg.wait_for_timeout(300)
    check('Settings opens with Export/Reset rows', pg.evaluate('Modals.isOpen("#modalSettings") && !!document.querySelector("#btnExportLog") && !!document.querySelector("#btnResetProgress")'))
    # ---- perf sample
    fps=pg.evaluate('''() => new Promise(r => { let n=0, t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })''')
    check('Render loop alive (headless rAF)', fps>10, f'{fps}/s (headless is throttled; not a device fps)')
    check('Zero console/page errors for the whole session', not errs, '; '.join(e[:80] for e in errs[:3]))
    res={'levels':levels_done,'summary':a['summary'],'errors':errs}
    br.close()
print('\n== SUMMARY ==', json.dumps(res['summary'],indent=1))
passed=sum(1 for c in CL if c[1]); print(f'\nCHECKLIST {passed}/{len(CL)} passed')
json.dump({'checklist':CL,'res':res},open('/tmp/sim_result.json','w'),indent=1)
