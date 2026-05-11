import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';

export interface DayOfWeekRow {
  ao: string;
  /** Lowercase segment for `/ao/:name` (matches backblast / sidebar keys). */
  aoRoute: string;
  /** Index 0..6 — Sunday=0, Saturday=6. Null when no workouts ran that day. */
  averages: Array<number|null>;
}

interface DisplayCell {
  value: number|null;
  display: string;
  intensity: number;  // 0..1, used to drive cell tinting
  tooltip: string;
}

interface DisplayRow {
  ao: string;
  aoRoute: string;
  cells: DisplayCell[];
}

const FULL_DAY_LABELS =
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Heatmap of average PAX attendance per AO per day of week.
 * Empty cells (null averages) render as a subtle tile and skip the tooltip.
 *
 * Day-of-week columns are auto-pruned: any day with zero workouts across
 * every AO in the dataset is hidden so the grid stays compact.
 */
@Component({
  selector: 'app-day-of-week-heatmap',
  templateUrl: './day-of-week-heatmap.component.html',
  styleUrls: ['./day-of-week-heatmap.component.scss'],
})
export class DayOfWeekHeatmapComponent implements OnChanges {
  @Input() data: DayOfWeekRow[] = [];

  /** Day-of-week column indices that the table renders. */
  visibleDayIndices: number[] = [];
  visibleDayLabels: string[] = [];

  rows: DisplayRow[] = [];
  /** Largest cell value across the whole grid (used for color scaling). */
  maxValue = 0;

  ngOnChanges(_changes: SimpleChanges): void {
    this.recompute();
  }

  private recompute(): void {
    if (!this.data?.length) {
      this.visibleDayIndices = [];
      this.visibleDayLabels = [];
      this.rows = [];
      this.maxValue = 0;
      return;
    }

    // Auto-pick day columns: any day with at least one cell of data.
    const seen = new Set<number>();
    let max = 0;
    for (const row of this.data) {
      for (let i = 0; i < 7; i++) {
        const v = row.averages?.[i];
        if (v == null) continue;
        seen.add(i);
        if (v > max) max = v;
      }
    }

    this.visibleDayIndices =
        [0, 1, 2, 3, 4, 5, 6].filter(i => seen.has(i));
    this.visibleDayLabels =
        this.visibleDayIndices.map(i => FULL_DAY_LABELS[i]);
    this.maxValue = max;

    this.rows = [...this.data]
                    .sort((a, b) => a.ao.localeCompare(b.ao))
                    .map(row => this.toDisplay(row));
  }

  private toDisplay(row: DayOfWeekRow): DisplayRow {
    const cells: DisplayCell[] = this.visibleDayIndices.map(i => {
      const v = row.averages?.[i] ?? null;
      if (v == null) {
        return {value: null, display: '', intensity: 0, tooltip: ''};
      }
      const display = formatAvg(v);
      const intensity = this.maxValue > 0 ? v / this.maxValue : 0;
      const tooltip =
          `${row.ao} on ${FULL_DAY_LABELS[i]}: ${display} avg pax`;
      return {value: v, display, intensity, tooltip};
    });
    return {ao: row.ao, aoRoute: row.aoRoute, cells};
  }
}

function formatAvg(v: number): string {
  // 1 decimal unless the number is integer-equivalent
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
