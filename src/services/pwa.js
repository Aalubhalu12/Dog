/**
 * BONK! — PWA plumbing: service worker, install prompt, update + offline notices
 * ---------------------------------------------------------------
 *   PWA.init()            – register sw.js (skipped on file:// and on localhost tools runs when ?nosw=1)
 *   PWA.canInstall        – true once the browser offered `beforeinstallprompt` (Android Chrome / desktop)
 *   PWA.install()         – show the native install sheet; resolves 'accepted' | 'dismissed' | 'unavailable'
 *   PWA.standalone        – running from the home-screen icon
 *   Events: 'pwa:installable' (button may appear), 'pwa:installed', 'pwa:update' (new version waiting), 'net' { online }
 * iOS has no install event: Settings shows a one-line "Share → Add to Home Screen" hint instead.
 */
const PWA = (() => {
  let deferred = null, waiting = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  function init() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; Events.emit('pwa:installable', {}); });
    window.addEventListener('appinstalled', () => { deferred = null; Analytics.track('pwa_installed'); Events.emit('pwa:installed', {}); });
    window.addEventListener('online',  () => Events.emit('net', { online: true }));
    window.addEventListener('offline', () => Events.emit('net', { online: false }));
    if (standalone()) Analytics.track('pwa_launch');
    if (!('serviceWorker' in navigator) || location.protocol === 'file:' || /[?&]nosw=1/.test(location.search)) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; Events.emit('pwa:update', {}); }
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) { waiting = nw; Events.emit('pwa:update', {}); } }); });
      // check for a new version whenever the app comes back to the foreground (Pages deploys are frequent)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(e => console.warn('[PWA] sw register failed', e));
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; if (waiting) location.reload(); });
  }
  async function install() {
    if (!deferred) return 'unavailable';
    deferred.prompt(); const { outcome } = await deferred.userChoice; deferred = null;
    Analytics.track('pwa_prompt', { outcome }); return outcome;
  }
  /** Activate the waiting worker → controllerchange → reload with the new version. */
  function applyUpdate() { if (waiting) waiting.postMessage('skipWaiting'); else location.reload(); }

  return { init, install, applyUpdate, get canInstall() { return !!deferred; }, get standalone() { return standalone(); }, get ios() { return ios(); }, get hasUpdate() { return !!waiting; } };
})();
