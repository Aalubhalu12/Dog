/**
 * BONK! — Global configuration
 * ---------------------------------------------------------------
 * Central place for tunables that are NOT level-specific.
 * Level design lives in  data/levels/*.json (loaded by src/data/levels.js)
 * Item definitions live in src/data/items.js
 */
const CONFIG = Object.freeze({
  VERSION: '0.17.0',
  STORAGE_PREFIX: 'bonk_',

  /** Player (puppy) */
  PUPPY: {
    HEIGHT_FRAC: 0.105,    // puppy body height as fraction of stage height (v0.17: smaller → more room to run)
    MAX_WIDTH_FRAC: 0.20,  // cap so it never gets too wide on narrow screens (~15 % of a phone's width)
    GROUND_Y: 0.85,       // ground line (fraction of stage height): paws on the grass just in front of the fence; the strip below is thumb space (relative drag)
    MIN_X: 0.0,           // movement bounds (fraction of width) — edge to edge; Puppy clamps by half its body
    MAX_X: 1.0,
    MAX_SPEED: 1.05,      // stage widths / second (~0.85 s edge-to-edge) — snappy
    ACCEL: 4.6,           // stage widths / second^2 (reaches top speed in ~0.23 s)
    FRICTION: 12,         // velocity damping per second when no input
    DRAG_SPRING: 140,     // spring stiffness when following the relative-drag target (stiff = 1:1 feel, still no overshoot)
    DRAG_SENS: 1.3,       // relative drag: puppy travel per finger travel (Settings slider 0.8–2.0)
    INVINCIBLE_TIME: 1.6, // seconds of i-frames after taking a hit
  },

  /** Parallax background (gameplay; the home screen is a painted plate) */
  PARALLAX: { GAME_AMP: 0.45 },

  /** Effects */
  FX: {
    SHAKE: true,
    FLASH: true,
    VIBRATE_DEFAULT: true,
  },

  /** Combo: consecutive catches (bones / gold bones / coins / power-ups) without a hit or a missed bone */
  COMBO: {
    STEP: 4,              // catches per multiplier step  (×2 after 4, ×3 after 8 … ×5 after 16)
    MAX: 5,
    MISS_RESETS: true,    // letting a bone hit the ground breaks the chain (hazards always do)
  },
  /** Near-miss: a hazard passes within this many puppy-widths of the puppy without hitting */
  NEAR_MISS: { MARGIN: 0.30, COINS: 1, COOLDOWN: 0.8 },   // 0.18 was ~20 px on a phone: technically a near miss, but nobody felt it

  /** Leaderboard (src/services/leaderboard.js): local-first, server only in limited daily windows */
  LEADERBOARD: {
    SYNC_WINDOWS_PER_DAY: 2,   // 2 → one sync allowed in 00:00–11:59 and one in 12:00–23:59 (local time)
    ENDPOINT: '',              // '' = mock population; Phase 5: 'https://<region>-<project>.cloudfunctions.net/leaderboard'
  },

  /** Countdown sequence before a level starts */
  COUNTDOWN: ['3', '2', '1', 'GO!'],
});
