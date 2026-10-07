/**
 * Parses the scraper's preblast reaction summary.
 *
 * `GET /reactions_log/pre-blast-data?date=YYYY-MM-DD` returns plain text built
 * by `PreBlastPaxReactionData::full_summary()` in f3-scraper-rs:
 *
 *   Summary for expected BDs on 2026-10-08.
 *
 *   Bleach
 *   --------------------
 *
 *   Backslash:
 *
 *   BD backblast has not been posted yet.
 *
 *   Reactions log:
 *
 *   hc:
 *   first added 2026-10-07 18:00:00.
 *   Removed hc last time at 2026-10-07 19:00:00.
 *
 *   --------------------
 *
 * An AO heading is a line directly followed by the dashed rule; a reaction
 * block ends with a blank line and then the rule. A PAX still has an HC when
 * their "hc:" block has no "Removed hc" line.
 */

const RULE = '--------------------';

/**
 * Preblast AO names that differ from the backblast AO names the app keys on.
 */
const PREBLAST_AO_ALIASES = new Map<string, string>([
  ['cynthia mann', 'otb cynthia mann'],
  ['gordon harris park', 'otb gordon harris park'],
  ['ruckership canyon', 'otb ruckership canyon'],
  ['warhorse', 'war horse'],
  ['camel\'s back', 'camels back'],
]);

/** Backblast AO key (lowercase) for a preblast summary heading. */
export function preblastAoKey(heading: string): string {
  const key = heading.trim().toLowerCase();
  return PREBLAST_AO_ALIASES.get(key) ?? key;
}

/**
 * The PAX (lowercase names) holding an HC on each AO's preblast, keyed by
 * backblast AO name.
 */
export function parsePreblastHcs(summary: string): Map<string, Set<string>> {
  const hcs = new Map<string, Set<string>>();
  const lines = summary.split('\n').map(line => line.trim());

  let ao: string|undefined;
  let pax: string|undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line === RULE || line === 'Reactions log:') continue;

    const isHeading = lines[i + 1] === RULE && !line.endsWith(':') &&
        !line.startsWith('first added') && !line.startsWith('Removed');
    if (isHeading) {
      ao = preblastAoKey(line);
      pax = undefined;
      if (!hcs.has(ao)) hcs.set(ao, new Set());
      continue;
    }

    if (line === 'hc:') {
      if (ao && pax) hcs.get(ao)!.add(pax);
      continue;
    }
    if (line.startsWith('Removed hc')) {
      if (ao && pax) hcs.get(ao)!.delete(pax);
      continue;
    }
    if (line === 'sc:' || line.startsWith('Removed ') ||
        line.startsWith('first added')) {
      continue;
    }
    if (line.endsWith(':')) {
      pax = line.slice(0, -1).trim().toLowerCase();
    }
  }

  return hcs;
}
