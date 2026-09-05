/**
 * BONK! — Global configuration
 * ---------------------------------------------------------------
 * Central place for tunables that are NOT level-specific.
 * Level design lives in  src/game/levels.js
 * Item definitions live in src/game/items.js
 */
const CONFIG = Object.freeze({
  VERSION: '0.9.0',
  STORAGE_PREFIX: 'bonk_',

  /** Player (puppy) */
  PUPPY: {
    HEIGHT_FRAC: 0.135,    // puppy body height as fraction of stage height (medium: clearly readable on phones)
    MAX_WIDTH_FRAC: 0.30,  // cap so it never gets too wide on narrow screens
    GROUND_Y: 0.905,      // ground line as fraction of stage height
    MIN_X: 0.06,          // movement bounds (fraction of width)
    MAX_X: 0.94,
    MAX_SPEED: 1.05,      // stage widths / second (~0.85 s edge-to-edge) — snappy
    ACCEL: 4.6,           // stage widths / second^2 (reaches top speed in ~0.23 s)
    FRICTION: 12,         // velocity damping per second when no input
    DRAG_SPRING: 90,      // spring stiffness when following a finger drag
    INVINCIBLE_TIME: 1.6, // seconds of i-frames after taking a hit
  },

  /** Parallax background */
  PARALLAX: {
    MENU_AMP: 1.0,
    GAME_AMP: 0.45,
  },

  /** Effects */
  FX: {
    SHAKE: true,
    FLASH: true,
    VIBRATE_DEFAULT: true,
  },

  /** Countdown sequence before a level starts */
  COUNTDOWN: ['3', '2', '1', 'GO!'],
});
