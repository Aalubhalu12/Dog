/**
 * BONK! — Adaptive render quality
 * ---------------------------------------------------------------
 * Watches real frame times and steps the quality tier DOWN when the device
 * can't hold ~50 fps, UP again when it has headroom for a while.
 *
 *   tier 2  full      – DPR ≤ 2, water ripples, god rays, soft-light glow, vignette
 *   tier 1  balanced  – DPR ≤ 1.5, water at half res, rays every other frame
 *   tier 0  lite      – DPR 1, no water/rays/soft-light, grade as one multiply
 *
 * Override for QA / user setting: ?q=0|1|2 or Perf.lock(tier). Emits 'perf:tier'.
 * Never touches simulation — only how the picture is drawn.
 */
const Perf = (() => {
  const MAX = 2;
  let tier = MAX, locked = null, samples = [], slow = 0, fast = 0, lastChange = 0;
  try { const q = new URLSearchParams(location.search).get('q'); if (q !== null && q !== '' && !isNaN(+q)) locked = Math.max(0, Math.min(MAX, +q | 0)); } catch (e) {}
  // heuristic head start: very low-end devices (≤ 2 cores or ≤ 2 GB) begin one tier down instead of discovering it mid-run
  try { if (locked == null && ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2)) tier = 1; } catch (e) {}

  const setTier = t => { t = Math.max(0, Math.min(MAX, t)); if (t === tier) return; tier = t; lastChange = performance.now(); slow = fast = 0; Events.emit('perf:tier', { tier }); };

  /** Feed one rendered frame's wall time (ms). Called from the main loop. */
  function frame(ms) {
    if (locked != null) { if (tier !== locked) setTier(locked); return; }
    if (ms > 200) return;                                  // tab switch / GC monster: ignore
    samples.push(ms); if (samples.length < 60) return;    // decide per ~1 s of frames
    samples.sort((a, b) => a - b); const med = samples[30], p90 = samples[54]; samples = [];
    if (performance.now() - lastChange < 3000) return;    // let a change settle
    if (med > 22 || p90 > 34) { fast = 0; if (++slow >= 2) setTier(tier - 1); }        // ~2 s of <45 fps → step down
    else if (med < 12 && p90 < 18) { slow = 0; if (++fast >= 15) setTier(tier + 1); }  // ~15 s of comfortable 60+ → step up
    else slow = fast = 0;
  }
  return { frame, get tier() { return tier; }, get locked() { return locked; }, lock(t) { locked = t == null ? null : t; if (locked != null) setTier(locked); }, MAX };
})();
