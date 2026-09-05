/**
 * BONK! — Asset manifest + loader
 * ---------------------------------------------------------------
 * Every image the game uses is listed here. Access loaded images via
 * Assets.img('<key>'). Add a line, drop the file, done.
 */
const Assets = (() => {
  const ROOT = 'assets/images/';
  const MANIFEST = {
    // background layers
    sky: 'bg/sky.webp', mountains: 'bg/mountains.webp', village: 'bg/village.webp',
    foreground: 'bg/foreground_wide.webp', road: 'bg/road.webp', meadow: 'bg/meadow.webp', water_mask: 'bg/water_mask.webp', trees: 'bg/trees.webp',
    cloud0: 'bg/cloud0.webp', cloud1: 'bg/cloud1.webp', cloud2: 'bg/cloud2.webp',
    // puppy poses
    puppy: 'puppy/puppy.webp', puppy_yay: 'puppy/puppy_yay.webp',
    puppy_bonk: 'puppy/puppy_bonk.webp', puppy_dizzy: 'puppy/puppy_dizzy.webp',
    idle_sheet: 'puppy/idle_sheet.webp', run_sheet: 'puppy/run_sheet.webp',
    yay_sheet: 'puppy/yay_sheet.webp', bonk_sheet: 'puppy/bonk_sheet.webp', dizzy_sheet: 'puppy/dizzy_sheet.webp',
    // items (keys must match src/game/items.js)
    bone: 'items/bone.webp', coin: 'items/coin.webp', magnet: 'items/magnet.webp',
    star: 'items/star.webp', rock: 'items/rock.webp', bomb: 'items/bomb.webp',
    goldbone: 'items/goldbone.webp', shield: 'items/shield.webp',
    // ui
    heart: 'ui/heart.webp', heart_empty: 'ui/heart_empty.webp', trophy: 'ui/trophy.webp', board: 'ui/board.webp', star_gold: 'ui/star_gold.webp', star_grey: 'ui/star_grey.webp', badge_paw: 'ui/badge_paw.webp', lock: 'ui/lock.webp',
    btn_left: 'ui/btn_left.webp', btn_right: 'ui/btn_right.webp',
    // ambient life (decorative)
    car0: 'ambient/car0.webp', car1: 'ambient/car1.webp', car2: 'ambient/car2.webp',
    walker0: 'ambient/walker0_sheet.webp', walker1: 'ambient/walker1_sheet.webp', bird_sheet: 'ambient/bird_sheet.webp',
    // brand
    logo: 'brand/logo.webp',
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
  return { load, img: k => images[k], all: () => images, url: k => ROOT + MANIFEST[k] };
})();
