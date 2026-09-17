/**
 * BONK! — Back navigation (Android hardware back / browser back / Escape)
 * ---------------------------------------------------------------
 * The app is a single page; we keep ONE sentinel entry in browser history so the back gesture reaches us
 * as `popstate` instead of leaving the site. Modals and the play scene register "layers" — back closes the
 * top-most layer; when nothing is open on the home screen, a second back within 2 s exits (Android habit).
 *   Nav.push(id, onBack)  – a layer opened (returns nothing; onBack must close it)
 *   Nav.pop(id)           – a layer closed by its own button (keeps the stack honest)
 *   Nav.back()            – programmatic back (Escape key, tests)
 */
const Nav = (() => {
  const stack = [];                       // [{ id, onBack }]
  let armedExit = 0, ignoreNext = false;

  function ensureSentinel() { if (!history.state || !history.state.bonk) history.pushState({ bonk: 1 }, ''); }
  function push(id, onBack) { const i = stack.findIndex(l => l.id === id); if (i >= 0) stack.splice(i, 1); stack.push({ id, onBack }); }
  function pop(id) { const i = stack.findIndex(l => l.id === id); if (i >= 0) stack.splice(i, 1); }
  function back() {
    if (stack.length) { const top = stack.pop(); top.onBack(); return true; }
    if (typeof Game !== 'undefined' && Game.inProgress) { Events.emit('nav:pause', {}); return true; }   // in a run: back = pause
    const now = performance.now();
    if (now - armedExit < 2000) { return false; }                                                            // second back → let the browser leave
    armedExit = now; Modals.toast('Press back again to exit'); return true;
  }
  function init() {
    ensureSentinel();
    window.addEventListener('popstate', () => {
      if (ignoreNext) { ignoreNext = false; return; }
      if (back()) { ignoreNext = false; history.pushState({ bonk: 1 }, ''); }            // handled → restore the sentinel so the next back reaches us too
      else if (PWA.standalone) history.back();                                            // installed app: really exit (2nd back)
      // in a browser tab, not re-pushing lets the 2nd back leave the page naturally
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); back(); } });
  }
  return { init, push, pop, back, get depth() { return stack.length; } };
})();
