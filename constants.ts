// old url here
// export const BASE_URL = 'https://f3boiseapi-cycjv.ondigitalocean.app';

// new url here
export const BASE_URL = 'https://f3-scraper-rs.fly.dev';

export enum REGION {
  HIGH_DESERT = 'high-desert',
  SETTLERS = 'settlers',
}

export enum AO {
  // east
  BACKYARD = 'backyard',
  BERNIE_FISHER = 'bernie fisher',
  BLEACH = 'bleach',
  CAMELS_BACK = 'camels back',
  CAPITOL = 'capitol',
  GOOSE_DYNASTY = 'goose dynasty',
  REBEL = 'rebel',
  RISE = 'rise',
  RUCKERSHIP_EAST = 'ruckership east',
  TOWER = 'tower',

  // west
  BELLAGIO = 'bellagio',
  BLACK_CANYON = 'black canyon',
  BLACK_DIAMOND = 'black diamond',
  COOP = 'coop',
  DARK_STRIDE = 'dark stride',
  GEM = 'gem',
  IRON_MOUNTAIN = 'iron mountain',
  OLD_GLORY = 'old glory',
  RUCKERSHIP_WEST = 'ruckership west',
  WAR_HORSE = 'war horse',
  WEST_CANYON_ELEMENTARY = 'west canyon elementary',

  // region agnostic
  BLACK_OPS = 'black ops',
}

export const HIGH_DESERT_AOS = new Set<string>([
  AO.BACKYARD,
  AO.BERNIE_FISHER,
  AO.BLEACH,
  AO.CAMELS_BACK,
  AO.CAPITOL,
  AO.GOOSE_DYNASTY,
  AO.REBEL,
  AO.RISE,
  AO.RUCKERSHIP_EAST,
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
  AO.RUCKERSHIP_WEST,
  AO.WAR_HORSE,
  AO.WEST_CANYON_ELEMENTARY,

  // include in both
  AO.BLACK_OPS,
]);
