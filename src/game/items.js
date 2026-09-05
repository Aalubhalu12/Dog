/**
 * BONK! — Item catalogue
 * ---------------------------------------------------------------
 * To add a new falling item:
 *   1. Drop its sprite in  assets/images/items/<key>.webp
 *   2. Add an entry below with the same <key>
 *   3. Reference <key> in a level's `weights` (src/game/levels.js)
 *   4. (optional) Add a sound in src/core/audio.js and an effect in
 *      src/game/effects.js — see `onCatch` handlers there.
 *
 * Fields:
 *   size    – width as fraction of stage width
 *   rot     – max random spin speed (rad/s); 0 = no spin
 *   kind    – 'score' | 'coin' | 'power' | 'hazard'
 *   score   – points awarded (kind: score)
 *   coins   – coins awarded (kind: coin)
 *   power   – power-up id (kind: power) + `dur` seconds
 *   hit     – reaction id (kind: hazard): 'bonk' | 'dizzy'
 *   stun    – seconds the puppy can't move after this hit
 *   pose    – puppy pose to show on contact
 *   popText – floating text on catch
 *   sfx     – SFX key
 *   fall    – physics profile (see Spawner.FALL): 'tumble' | 'flutter' | 'heavy' | 'float'
 */
const ITEMS = Object.freeze({
  bone:   { kind: 'score',  size: 0.082, rot: 1.6, fall: 'tumble', score: 10, pose: 'yay',  poseTime: 0.9, popText: '+{v}', popClass: 'good', sfx: 'bone',  particles: ['#fff', '#ffd23a', '#ffe9a8'] },
  coin:   { kind: 'coin',   size: 0.082, rot: 0,   fall: 'flutter', coins: 1,  popText: '+1', popClass: 'coin', sfx: 'coin', particles: ['#ffd23a'] },
  magnet: { kind: 'power',  size: 0.088, rot: 0.6, fall: 'float', power: 'magnet', dur: 6, banner: 'MAGNET!',   sfx: 'magnet', particles: ['#7fe3ff', '#fff'] },
  star:   { kind: 'power',  size: 0.105, rot: 0.9, fall: 'float', power: 'star',   dur: 8, banner: '2× SCORE!', sfx: 'star',   particles: ['#ffd23a', '#fff', '#ff9a1f'] },
  rock:   { kind: 'hazard', size: 0.100, rot: 2.2, fall: 'heavy', hit: 'bonk',  stun: 0.5, pose: 'bonk',  poseTime: 1.1, banner: 'BONK!',  sfx: 'bonk', particles: ['#ffd23a', '#ff9a1f', '#fff'] },
  bomb:   { kind: 'hazard', size: 0.088, rot: 0.4, fall: 'heavy', hit: 'dizzy', stun: 1.1, pose: 'dizzy', poseTime: 1.4, banner: 'DIZZY!', sfx: 'bomb', particles: ['#333', '#ff9a1f', '#ffd23a', '#fff'] },
});

/**
 * Power-up behaviours. Add a new power here + reference it from an item.
 *   onStart / onEnd  – called with game state
 *   label            – HUD badge text
 */
const POWERS = Object.freeze({
  magnet: { icon: 'magnet', label: '',    radius: 0.55, pull: 2.4, attracts: ['coin', 'bone'] },
  star:   { icon: 'star',   label: '2× ', multiplier: 2 },
});
