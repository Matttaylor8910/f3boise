// old url here
// export const BASE_URL = 'https://f3boiseapi-cycjv.ondigitalocean.app';

// new url here
export const BASE_URL = 'https://f3-scraper-rs.fly.dev';

export enum REGION {
  CITY_OF_TREES = 'city-of-trees',
  HIGH_DESERT = 'high-desert',
  SETTLERS = 'settlers',
}

export enum AO {
  // city of trees
  BLEACH = 'bleach',
  CAMELS_BACK = 'camels back',
  LIBERTY = 'liberty',
  RISE = 'rise',

  // high desert
  BACKYARD = 'backyard',
  GOOSE_DYNASTY = 'goose dynasty',
  INTERCEPTOR = 'interceptor',
  REBEL = 'rebel',
  TOWER = 'tower',

  // settlers
  BELLAGIO = 'bellagio',
  BLACK_CANYON = 'black canyon',
  BLACK_DIAMOND = 'black diamond',
  COOP = 'coop',
  DARK_STRIDE = 'dark stride',
  GEM = 'gem',
  IRON_MOUNTAIN = 'iron mountain',
  OLD_GLORY = 'old glory',
  WAR_HORSE = 'war horse',
  WEST_CANYON_ELEMENTARY = 'west canyon elementary',

  // region agnostic
  BLACK_OPS = 'black ops',

  // old/closed
  RUCKERSHIP_EAST = 'ruckership east',
  RUCKERSHIP_WEST = 'ruckership west',
}

export const CITY_OF_TREES_AOS = new Set<string>([
  AO.BLEACH,
  AO.CAMELS_BACK,
  AO.LIBERTY,
  AO.RISE,

  // include in both
  AO.BLACK_OPS,
]);

export const HIGH_DESERT_AOS = new Set<string>([
  AO.BACKYARD,
  AO.GOOSE_DYNASTY,
  AO.INTERCEPTOR,
  AO.REBEL,
  AO.TOWER,

  // include in both
  AO.BLACK_OPS,
]);

export const SETTLERS_AOS = new Set<string>([
  AO.BELLAGIO,
  AO.BLACK_CANYON,
  AO.BLACK_DIAMOND,
  AO.COOP,
  AO.DARK_STRIDE,
  AO.GEM,
  AO.IRON_MOUNTAIN,
  AO.OLD_GLORY,
  AO.WAR_HORSE,
  AO.WEST_CANYON_ELEMENTARY,

  // include in both
  AO.BLACK_OPS,
]);
