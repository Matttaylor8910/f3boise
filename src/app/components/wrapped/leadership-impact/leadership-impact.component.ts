import {Component, Input} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-leadership-impact',
  templateUrl: './leadership-impact.component.html',
  styleUrls: ['./leadership-impact.component.scss'],
})
export class LeadershipImpactComponent {
  @Input() eyebrow: string = 'LEADERSHIP IMPACT';
  @Input() bigStat: string|number = '';
  @Input() statLabel: string = '';
  @Input() description: string = '';
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
  @Input() callouts: Array<{message: string; rank: number}> = [];
  @Input() simpleCallout: string = ''; // Simple callout for encouragement messages
  @Input() qCountMaps: {
    overall: Map<string, number>;
    regions: Map<string, Map<string, number>>;
    aos: Map<string, Map<string, number>>;
  } = {
    overall: new Map(),
    regions: new Map(),
    aos: new Map(),
  };

  constructor(public readonly utilService: UtilService) {}

  getCalloutClass(rank: number): string {
    if (rank === 1) return 'callout-badge callout-gold';
    if (rank === 2) return 'callout-badge callout-silver';
    if (rank === 3) return 'callout-badge callout-bronze';
    return 'callout-badge';
  }

}
