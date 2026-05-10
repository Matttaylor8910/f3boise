/**
 * Shared SVG marker builders used by both the full map page and the embedded
 * read-only RegionMapComponent. Keeping the SVG geometry here (instead of
 * inlined per call site) ensures the two surfaces always share the same
 * pin look.
 */

import {AoDay} from './map.page';

const DAY_COLORS = [
  '#c084fc',  // Sunday    — purple
  '#ff6b6b',  // Monday    — red
  '#4ecdc4',  // Tuesday   — teal
  '#45b7d1',  // Wednesday — blue
  '#96ceb4',  // Thursday  — green
  '#f0a500',  // Friday    — amber
  '#ff9ff3',  // Saturday  — pink
];

const DAY_ABBREVS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

export interface MarkerSpec {
  name: string;
  /** Days that have at least one workout — only these get a pill on the pin. */
  days: AoDay[];
  /** Tints the pin red to flag a closure on the next scheduled date. */
  closedNextDate?: boolean;
}

/**
 * Builds a callout SVG marker: one colored pill per active day, with a
 * downward-pointing caret anchored at the location point.
 *
 * Empty `activeDays` falls back to a circular "+" pin (orphan AO without a
 * scheduled workout yet).
 */
export function buildAoMarkerOptions(spec: MarkerSpec):
    google.maps.MarkerOptions {
  const activeDays = spec.days.filter(d => d.event);
  const closed = !!spec.closedNextDate;

  if (activeDays.length === 0) {
    const SIZE = 32, CARET_H = 7, totalH = SIZE + CARET_H;
    const cx = SIZE / 2;
    const fill = closed ? '#e53935' : '#2196f3';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
        SIZE}" height="${totalH}">
  <circle cx="${cx}" cy="${cx}" r="${cx - 1.5}" fill="${
        fill}" stroke="white" stroke-width="2"
          style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))"/>
  <text x="${cx}" y="${cx + 5}" font-size="18" font-weight="700" fill="white"
        text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">+</text>
  <path d="M${cx - 5} ${SIZE} L${cx} ${totalH} L${cx + 5} ${SIZE} Z" fill="${
        fill}"/>
</svg>`;
    return {
      title: spec.name,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(SIZE, totalH),
        anchor: new google.maps.Point(cx, totalH),
      },
    };
  }

  const n = activeDays.length;
  const PILL_W = 24, PILL_H = 20, PAD = 3, GAP = 2, CARET_H = 7;
  const boxW = n * PILL_W + (n - 1) * GAP + PAD * 2;
  const boxH = PILL_H + PAD * 2;
  const totalH = boxH + CARET_H;

  return {
    title: spec.name,
    icon: {
      url: buildPillMarkerSvgUri(
          activeDays,
          {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP, CARET_H},
          closed,
          ),
      scaledSize: new google.maps.Size(boxW, totalH),
      anchor: new google.maps.Point(boxW / 2, totalH),
    },
  };
}

interface PillDimensions {
  boxW: number;
  boxH: number;
  totalH: number;
  PILL_W: number;
  PILL_H: number;
  PAD: number;
  GAP: number;
  CARET_H: number;
}

function buildPillMarkerSvgUri(
    activeDays: AoDay[], dim: PillDimensions, closed: boolean): string {
  const {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP} = dim;

  const pills = activeDays
                    .map((d, i) => {
                      const color = DAY_COLORS[d.dayIndex] ?? '#aaa';
                      const abbrev = DAY_ABBREVS[d.dayIndex];
                      const x = PAD + i * (PILL_W + GAP);
                      const y = PAD;
                      const cx = x + PILL_W / 2;
                      return `<rect x="${x}" y="${y}" width="${
                                 PILL_W}" height="${
                                 PILL_H}" rx="4" fill="${color}"/>` +
                          `<text x="${cx}" y="${
                                 y +
                                 14}" font-size="9.5" font-weight="700" fill="white" ` +
                          `text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${
                                 abbrev}</text>`;
                    })
                    .join('');

  const boxFill = closed ? '#fff0f0' : 'white';
  const boxStroke = closed ? '#e53935' : '#ccc';
  const caretFill = closed ? '#e53935' : '#ccc';
  const caretInnerFill = closed ? '#fff0f0' : 'white';

  const cx = boxW / 2;
  const caretOuter =
      `M${cx - 7} ${boxH} L${cx} ${totalH} L${cx + 7} ${boxH} Z`;
  const caretInner =
      `M${cx - 5} ${boxH - 1} L${cx} ${totalH - 2} L${cx + 5} ${boxH - 1} Z`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
      boxW}" height="${totalH}">
  <rect width="${boxW}" height="${boxH}" rx="6" fill="${boxFill}" stroke="${
      boxStroke}" stroke-width="1.5"
        style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.18))"/>
  ${pills}
  <path d="${caretOuter}" fill="${caretFill}"/>
  <path d="${caretInner}" fill="${caretInnerFill}"/>
</svg>`;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
