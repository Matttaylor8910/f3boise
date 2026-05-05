import {TreeLocation} from './map.page';

/**
 * Pure helpers for the region-tree view. Shared by {@link MapPage} (sorting
 * during tree construction) and {@link MapRegionTreeComponent} (template
 * display) so both call sites compute identical labels.
 */

/**
 * Alphabetical sort key for region tree rows: the sole AO name when exactly
 * one AO; otherwise the location row label (covers 0 or 2+ AOs at the pin).
 */
export function treeLocationSortKey(loc: TreeLocation): string {
  if (loc.aos.length === 1) {
    const aoName = loc.aos[0]?.name?.trim();
    if (aoName) return aoName;
  }
  return loc.displayName?.trim() ?? '';
}

/**
 * Header label rendered for a tree row — falls back to a placeholder when
 * neither the AO nor the location supplies a name.
 */
export function treeLocationHeaderLabel(loc: TreeLocation): string {
  return treeLocationSortKey(loc) || '— unnamed —';
}

export function treeLocationHeaderIsUnnamed(loc: TreeLocation): boolean {
  return !treeLocationSortKey(loc);
}

/** True when this tree row's location has no usable lat/lng (no map pin). */
export function treeLocationMissingMapCoords(loc: TreeLocation): boolean {
  const {lat, lng} = loc;
  if (lat == null || lng == null) return true;
  if (lat === 0 && lng === 0) return true;
  return false;
}

/**
 * When the row shows a single AO, second line: location roster name if it
 * differs from the AO title.
 */
export function treeLocationSubtitleSingleAo(loc: TreeLocation): string {
  if (loc.aos.length !== 1) return '';
  const locName = loc.displayName?.trim() ?? '';
  if (!locName) return '';
  const aoName = loc.aos[0]?.name?.trim();
  if (!aoName) return '';
  if (locName.localeCompare(aoName, undefined, {sensitivity: 'base'}) === 0) {
    return '';
  }
  return locName;
}
