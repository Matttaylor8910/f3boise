import {Component, Input} from '@angular/core';

export interface QDepthRow {
  ao: string;
  /**
   * Regular attenders: posted ≥ {@link REGULAR_POSTS_THRESHOLD} times at
   * this AO in the trailing window.
   */
  regularAttenders: number;
  /**
   * Subset of regular attenders who also led ≥ {@link REGULAR_QS_THRESHOLD}
   * workouts at this AO in the trailing window.
   */
  regularQs: number;
  /** regularQs / regularAttenders in [0, 1]; 0 when there are no regulars. */
  rate: number;
}

type Tier = 'healthy'|'watch'|'risk';

interface DisplayRow extends QDepthRow {
  tier: Tier;
  pct: number;          // rate * 100, rounded for display
  tooltip: string;
}

/**
 * "Q Depth" — among the regulars at an AO, what fraction also Q regularly?
 * Sorted descending and color-coded by health tier.
 */
@Component({
  selector: 'app-q-depth-chart',
  templateUrl: './q-depth-chart.component.html',
  styleUrls: ['./q-depth-chart.component.scss'],
})
export class QDepthChartComponent {
  rows: DisplayRow[] = [];

  @Input()
  set data(value: QDepthRow[]|null|undefined) {
    if (!value?.length) {
      this.rows = [];
      return;
    }
    this.rows = [...value]
                    .sort((a, b) => {
                      if (b.rate !== a.rate) return b.rate - a.rate;
                      return b.regularAttenders - a.regularAttenders;
                    })
                    .map(row => this.toDisplay(row));
  }

  private toDisplay(row: QDepthRow): DisplayRow {
    const pct = Math.round(row.rate * 1000) / 10;
    const tier: Tier = row.regularAttenders === 0 ?
        'risk' :
        row.rate >= 0.5 ? 'healthy' : row.rate >= 0.25 ? 'watch' : 'risk';
    const tooltip = row.regularAttenders === 0 ?
        `${row.ao}: no regulars in the trailing window` :
        `${row.ao}: ${pct}% — ${row.regularQs} of ${
            row.regularAttenders} regulars Q'd 2+ times`;
    return {...row, pct, tier, tooltip};
  }
}
