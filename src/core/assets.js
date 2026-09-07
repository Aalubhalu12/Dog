/**
 * BONK! — Asset manifest + loader
 * ---------------------------------------------------------------
 * Every image drawn on the canvas or injected by JS is listed here; access via
 * Assets.img('<key>') (decoded Image) or Assets.url('<key>') (for <img src>).
 * Add a line, drop the file, done. Static <img> tags in index.html load on their own.
 */
const Assets = (() => {
  const ROOT = 'assets/images/';
  const MANIFEST = {
    // background layers
    sky: 'bg/sky.webp', mountains: 'bg/mountains.webp', village: 'bg/village.webp',
    foreground: 'bg/foreground_wide.webp', road: 'bg/road.webp', meadow: 'bg/meadow.webp', water_mask: 'bg/water_mask.webp', trees: 'bg/trees.webp',
    cloud0: 'bg/cloud0.webp', cloud1: 'bg/cloud1.webp', cloud2: 'bg/cloud2.webp',
    park_far: 'bg/park_far.webp', park_mid: 'bg/park_mid.webp',           // theme 'park'   (levels 5–8)
    forest_far: 'bg/forest_far.webp', forest_mid: 'bg/forest_mid.webp',   // theme 'forest' (levels 9–10)
    // puppy: result-card stills + animation sheets (see src/game/puppy.js)
    puppy_yay: 'puppy/puppy_yay.webp',
    puppy_bonk: 'puppy/puppy_bonk.webp', puppy_dizzy: 'puppy/puppy_dizzy.webp',
    idle_sheet: 'puppy/idle_sheet.webp', run_sheet: 'puppy/run_sheet.webp',
    yay_sheet: 'puppy/yay_sheet.webp', bonk_sheet: 'puppy/bonk_sheet.webp', dizzy_sheet: 'puppy/dizzy_sheet.webp',
    // items (keys must match src/data/items.js)
    bone: 'items/bone.webp', coin: 'items/coin.webp', magnet: 'items/magnet.webp',
    star: 'items/star.webp', rock: 'items/rock.webp', bomb: 'items/bomb.webp',
    goldbone: 'items/goldbone.webp', shield: 'items/shield.webp',
    // ui
    heart: 'ui/heart.webp', heart_empty: 'ui/heart_empty.webp', trophy: 'ui/trophy.webp', star_gold: 'ui/star_gold.webp', star_grey: 'ui/star_grey.webp', lock: 'ui/lock.webp',
    btn_left: 'ui/btn_left.webp', btn_right: 'ui/btn_right.webp',
    // ambient life (decorative)
    car0: 'ambient/car0.webp', car1: 'ambient/car1.webp', car2: 'ambient/car2.webp',
    walker0: 'ambient/walker0_sheet.webp', walker1: 'ambient/walker1_sheet.webp', bird_sheet: 'ambient/bird_sheet.webp',
    squirrel: 'ambient/squirrel.webp',                       // L8+ bone thief (src/game/mechanics.js)
    // (home-screen art — plate, puppy, logo — is referenced directly from index.html and never drawn on the canvas)
  };
  const images = {};

  function load(onProgress) {
    const keys = Object.keys(MANIFEST); let done = 0;
    return Promise.all(keys.map(k => new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = () => { images[k] = im; onProgress && onProgress(++done / keys.length); res(); };
      im.src = ROOT + MANIFEST[k];
    }))).then(() => images);
  }
  return { load, img: k => images[k], url: k => ROOT + MANIFEST[k] };
})();
