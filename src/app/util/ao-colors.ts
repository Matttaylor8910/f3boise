import {AO} from '../../../constants';

/** Chart colour for an AO (lowercase backblast name). */
export function aoColor(ao: string): string {
  switch (ao.toLowerCase()) {
    case AO.BACKYARD:
      return '#014235';
    case AO.BELLAGIO:
      return '#16A085';
    case AO.BLACK_CANYON:
      return '#3067e6';
    case AO.BLACK_DIAMOND:
    case AO.BLACK_OPS:
      return '#000000';
    case AO.BLEACH:
      return '#8FFF5A';
    case AO.CAMELS_BACK:
      return '#FFDD33';
    case AO.LIBERTY:
      return '#1e0697';
    case AO.COOP:
      return '#3C6F19';
    case AO.DARK_STRIDE:
      return '#E75293';
    case AO.DUCK_HUNT:
      return '#7fd7ab';
    case AO.EMMETT_GEM_ISLAND:
      return '#17A2B8';
    case AO.GEM:
      return '#3498DB';
    case AO.GOOSE_DYNASTY:
      return '#A8AAAF';
    case AO.INTERCEPTOR:
      return '#720374';
    case AO.IRON_MOUNTAIN:
      return '#002F4D';
    case AO.LIBERTY_PARK:
      return '#DC143C';
    case AO.OLD_GLORY:
      return '#9B59B6';
    case AO.OTB_CYNTHIA_MANN:
      return '#C2185B';
    case AO.OTB_GORDON_HARRIS_PARK:
      return '#8D6E63';
    case AO.OTB_LIBERTY_PARK:
      return '#FF7043';
    case AO.RAFO:
      return '#5D4E75';
    case AO.REBEL:
      return '#E0C248';
    case AO.RISE:
      return '#F39C12';
    case AO.OTB_RUCKERSHIP_CANYON:
      return '#FF8C00';
    case AO.RUCKERSHIP_EAST:
      return '#E67E22';
    case AO.RUCKERSHIP_WEST:
      return '#D35400';
    case AO.SENTINELS:
      return '#686363';
    case AO.SUNDAY_RUCK:
      return '#795548';
    case AO.TOWER:
      return '#9CD6F1';
    case AO.THE_EDGE:
      return '#2C3E50';
    case AO.WAR_HORSE:
      return '#E74C3C';
    default:
      return fallbackColor(ao.toLowerCase());
  }
}

/**
 * Stable fallback colour for an AO with no entry above, so a new AO renders
 * the same colour on every load instead of a random one.
 */
function fallbackColor(ao: string): string {
  let hash = 0;
  for (const char of ao) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360}, 65%, 45%)`;
}
