import {Component, Input} from '@angular/core';

export interface QDepthRow {
  ao: string;
  /** Lowercase segment for `/ao/:name` (matches backblast / sidebar keys). */
  aoRoute: string;
  /** Total workouts at this AO across the trailing window. */
  workouts: number;
  /**
   * Regular attenders — posted at ≥ ⅓ of this AO's workouts in the
   * trailing window.
   */
  regularAttenders: number;
  /**
   * Subset of regular attenders who also led ≥ half their fair share
   * (workouts ÷ # regulars) of Qs at this AO.
   */
  regularQs: number;
  /** The dynamic minimum-Q cutoff used for "regular Q" at this AO. */
  regularQCutoff: number;
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
        row.rate >= 0.5 ? 'healthy' : row.rate >= 0.3 ? 'watch' : 'risk';

    let tooltip: string;
    if (row.regularAttenders === 0) {
      tooltip = `${row.ao}: no regulars in the trailing window`;
    } else {
      const fairShare = row.workouts / row.regularAttenders;
      const fairShareStr = fairShare >= 10 ?
          fairShare.toFixed(0) :
          fairShare.toFixed(1);
      const cutoffWord = row.regularQCutoff === 1 ? 'workout' : 'workouts';
      tooltip = `${row.ao}: ${row.regularQs} of ${row.regularAttenders} regulars led regularly`;
    }
    return {...row, pct, tier, tooltip};
  }
}
