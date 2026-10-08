export const BASE_URL = 'https://f3-scraper-rs.fly.dev';

export const GOOGLE_MAPS_API_KEY = 'AIzaSyDeyjzsdu8Yjlzc6udpTP8Pd_pRs4Hle6I';

export enum REGION {
  CITY_OF_TREES = 'city-of-trees',
  HIGH_DESERT = 'high-desert',
  SETTLERS = 'settlers',
  CANYON = 'canyon',
}

export enum AO {
  // city of trees
  BLEACH = 'bleach',
  CAMELS_BACK = 'camels back',
  LIBERTY = 'liberty',
  OTB_CYNTHIA_MANN = 'otb cynthia mann',
  RISE = 'rise',

  // high desert
  BACKYARD = 'backyard',
  GOOSE_DYNASTY = 'goose dynasty',
  INTERCEPTOR = 'interceptor',
  OTB_GORDON_HARRIS_PARK = 'otb gordon harris park',
  REBEL = 'rebel',
  TOWER = 'tower',

  // settlers
  BELLAGIO = 'bellagio',
  BLACK_CANYON = 'black canyon',
  BLACK_DIAMOND = 'black diamond',
  COOP = 'coop',
  DARK_STRIDE = 'dark stride',
  EMMETT_GEM_ISLAND = 'emmett gem island',
  GEM = 'gem',
  OLD_GLORY = 'old glory',
  OTB_LIBERTY_PARK = 'otb liberty park',
  RAFO = 'rafo',
  SENTINELS = 'sentinels',
  SUNDAY_RUCK = 'sunday ruck',

  // canyon
  DUCK_HUNT = 'duck hunt',
  IRON_MOUNTAIN = 'iron mountain',
  LIBERTY_PARK = 'liberty park',
  OTB_RUCKERSHIP_CANYON = 'otb ruckership canyon',
  THE_EDGE = 'the edge',
  WAR_HORSE = 'war horse',

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
  AO.OTB_CYNTHIA_MANN,
  AO.RISE,

  // include in all
  AO.BLACK_OPS,
]);

export const HIGH_DESERT_AOS = new Set<string>([
  AO.BACKYARD,
  AO.GOOSE_DYNASTY,
  AO.INTERCEPTOR,
  AO.OTB_GORDON_HARRIS_PARK,
  AO.REBEL,
  AO.TOWER,

  // include in all
  AO.BLACK_OPS,
]);

export const SETTLERS_AOS = new Set<string>([
  AO.BELLAGIO,
  AO.BLACK_CANYON,
  AO.BLACK_DIAMOND,
  AO.COOP,
  AO.DARK_STRIDE,
  AO.EMMETT_GEM_ISLAND,
  AO.GEM,
  AO.OLD_GLORY,
  AO.OTB_LIBERTY_PARK,
  AO.RAFO,
  AO.SENTINELS,
  AO.SUNDAY_RUCK,

  // include in all
  AO.BLACK_OPS,
]);

export const CANYON_AOS = new Set<string>([
  AO.DUCK_HUNT,
  AO.IRON_MOUNTAIN,
  AO.LIBERTY_PARK,
  AO.OTB_RUCKERSHIP_CANYON,
  AO.THE_EDGE,
  AO.WAR_HORSE,

  // include in all
  AO.BLACK_OPS,
]);

// Region agnostic AOs (appear in all regions but should be listed separately)
export const REGION_AGNOSTIC_AOS = new Set<string>([
  AO.BLACK_OPS,
]);

// Discontinued/closed AOs
export const DISCONTINUED_AOS = new Set<string>([
  AO.RUCKERSHIP_EAST,
  AO.RUCKERSHIP_WEST,
]);

// Workouts whose name in the scraper's /region/workouts feed differs from the
// AO name used in backblasts. Keys are the workout name normalized and
// lowercased, values are the backblast AO name.
export const WORKOUT_AO_ALIASES = new Map<string, string>([
  ['camel\'s back', AO.CAMELS_BACK],
  ['cynthia mann', AO.OTB_CYNTHIA_MANN],
  ['gordon harris park', AO.OTB_GORDON_HARRIS_PARK],
  ['ruckership canyon', AO.OTB_RUCKERSHIP_CANYON],
  ['warhorse', AO.WAR_HORSE],
]);

/**
 * The backblast AO name for any spelling of an AO: the scraper's workout
 * name, an older link, or the name itself. Lowercased.
 */
export function canonicalAoName(name: string): string {
  const lower = name.trim().toLowerCase();
  return WORKOUT_AO_ALIASES.get(lower) ?? lower;
}