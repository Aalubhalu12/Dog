/**
 * BONK! — Level definitions
 * ---------------------------------------------------------------
 * Add a level by appending an object to LEVELS. Nothing else needs
 * to change — the level select, HUD, progress bar and level-clear
 * flow all read from this array.
 *
 * Fields:
 *   id        – display number
 *   name      – short title shown on the clear card
 *   target    – score needed to clear the level
 *   hearts    – lives at start (also the max)
 *   duration  – (optional) if set, level also ends when the timer runs out
 *   spawn     – [startInterval, endInterval] seconds between spawns
 *   speed     – [startSpeed, endSpeed] fall speed (stage heights / second)
 *   ramp      – seconds over which spawn/speed go from start → end
 *   weights   – relative spawn chance per item key (see items.js)
 *   safeTime  – seconds at the start with no hazards
 *   theme     – background theme key, default 'meadow'
 *   ambient   – background life density: { birds, walkers, cars } each 0..1 (0 = none). Grows level by level.
 *   goal      – the level-specific 3rd star. Types (see GOALS in goals.js):
 *                 { type:'bonesIn', count, seconds }  – catch N bones within the first T seconds
 *                 { type:'coins', count }             – collect N coins this level
 *                 { type:'noBomb' }                   – never get dizzy
 *                 { type:'power', count }             – grab N power-ups
 *               Star 1 = reach target · Star 2 = don't lose a heart · Star 3 = goal. Timed goals are never game-over.
 *   unlock    – (future) requirement, e.g. { stars: 3 }
 */
const LEVELS = [
  {
    id: 1, name: 'Sunny Meadow', target: 400, hearts: 3,
    spawn: [1.00, 0.62], speed: [0.28, 0.40], ramp: 60, safeTime: 3,
    weights: { bone: 36, coin: 30, rock: 16, bomb: 6, magnet: 6, star: 6 },
    theme: 'meadow', ambient: { birds: .6, walkers: 0, cars: 0 },        // quiet morning: just birds
    goal: { type: 'bonesIn', count: 8, seconds: 30 },
  },
  {
    id: 2, name: 'Rocky Road', target: 900, hearts: 3,
    spawn: [0.70, 0.45], speed: [0.38, 0.55], ramp: 60, safeTime: 2,
    weights: { bone: 32, coin: 28, rock: 22, bomb: 9, magnet: 5, star: 4 },
    theme: 'meadow', ambient: { birds: .8, walkers: .6, cars: 0 },       // villagers come out
    goal: { type: 'coins', count: 12 },
  },
  {
    id: 3, name: 'Bomb Squad', target: 1500, hearts: 3,
    spawn: [0.60, 0.38], speed: [0.45, 0.65], ramp: 60, safeTime: 2,
    weights: { bone: 30, coin: 26, rock: 20, bomb: 14, magnet: 5, star: 5 },
    theme: 'meadow', ambient: { birds: 1, walkers: .8, cars: .7 },       // the lane gets busy
    goal: { type: 'noBomb' },
  },
];

/** Returns a level by index, clamped to the last level (endless replay of the hardest). */
function getLevel(index) { return LEVELS[Math.max(0, Math.min(index, LEVELS.length - 1))]; }
