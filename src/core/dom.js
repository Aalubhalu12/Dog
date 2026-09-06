/**
 * BONK! — DOM helpers shared by every UI module
 * ---------------------------------------------------------------
 *   $('#id')            → first match (document.querySelector)
 *   $$('.cls')          → Array of matches
 *   restartAnimation(el)→ re-trigger a CSS animation / class-based transition (forces a reflow)
 */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function restartAnimation(el, cls) {
  if (cls) el.classList.remove(cls); else el.style.animation = 'none';
  void el.offsetWidth;                                    // reflow: browsers restart the animation on the next paint
  if (cls) el.classList.add(cls); else el.style.animation = '';
}
