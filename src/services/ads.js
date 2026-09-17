/**
 * BONK! — Ad layer (Phase 4: MOCK panels with the REAL placement rules; Phase 6 swaps in AdMob via Capacitor)
 * ---------------------------------------------------------------
 *   Ads.rewarded(placement)      → Promise<boolean>  (true = user watched to the end → grant the reward)
 *   Ads.interstitial(placement)  → Promise<void>     (shows only if the rules allow; resolves immediately otherwise)
 *   Ads.canReward()              → false when ads are disabled (flags) — hides 📺 buttons
 * Placement rules (LAUNCH_PLAN §3.3), enforced HERE so the adapter can stay dumb:
 *   interstitials: never before level `interstitial_min_level`, at most one per `interstitial_every` game-overs,
 *   never within 3 minutes of the last one, never after a 3-star win, never for Remove-Ads / Club owners.
 *   rewarded: always optional, never a gate; one revive per run (Game enforces), 2× coins on the win card.
 * Adapter shape: { name, showRewarded(placement) → Promise<bool>, showInterstitial(placement) → Promise<void> }.
 */
const Ads = (() => {
  let adapter = null, lastInterstitialAt = -Infinity, overs = 0;
  const on = () => Flags.get('ads_enabled');
  const adFree = () => Shop.owns('remove_ads') || Shop.owns('club');

  // --- mock adapter: a 3-second fake ad panel (skippable after the timer for rewarded = no reward) -------------
  const mock = {
    name: 'mock',
    show(kind, placement) {
      return new Promise(res => {
        const el = $('#adMock'); el.classList.add('open'); el.dataset.kind = kind;
        $('#adKind').textContent = kind === 'rewarded' ? '📺 Rewarded ad (mock)' : '📺 Ad (mock)'; $('#adPlace').textContent = placement;
        const btn = $('#adDone'), skip = $('#adSkip'); let t = 3; btn.disabled = true; btn.textContent = `${t}s`; skip.hidden = kind !== 'rewarded';
        const tick = setInterval(() => { t--; if (t > 0) btn.textContent = `${t}s`; else { clearInterval(tick); btn.disabled = false; btn.textContent = kind === 'rewarded' ? '✓ CLAIM' : 'CONTINUE'; } }, 1000);
        const end = ok => { clearInterval(tick); el.classList.remove('open'); btn.onclick = skip.onclick = null; res(ok); };
        btn.onclick = () => end(true); skip.onclick = () => end(false);
      });
    },
    showRewarded: p => mock.show('rewarded', p), showInterstitial: p => mock.show('interstitial', p),
  };
  adapter = mock;

  async function rewarded(placement) {
    if (!on()) return false;
    Analytics.track('ad_rewarded_start', { placement, adapter: adapter.name });
    const ok = await adapter.showRewarded(placement); Analytics.track(ok ? 'ad_rewarded_done' : 'ad_rewarded_skip', { placement });
    return ok;
  }
  /** Called at every game-over (and can be called after non-3★ wins). Decides + shows. */
  async function interstitial(placement, ctx = {}) {
    if (!on() || adFree()) return false;
    overs++;
    const minLevel = Flags.get('interstitial_min_level'), every = Flags.get('interstitial_every');
    if ((ctx.levelId || 1) < minLevel) return false;
    if (ctx.stars === 3) return false;
    if (overs % every !== 0) return false;
    if (performance.now() - lastInterstitialAt < 180e3) return false;
    lastInterstitialAt = performance.now(); Analytics.track('ad_interstitial', { placement, adapter: adapter.name });
    await adapter.showInterstitial(placement); return true;
  }
  return { rewarded, interstitial, canReward: () => on(), get adFree() { return adFree(); }, setAdapter: a => { adapter = a; }, get adapterName() { return adapter.name; },
    /** QA */ _reset() { overs = 0; lastInterstitialAt = -Infinity; } };
})();
