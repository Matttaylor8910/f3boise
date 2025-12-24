import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-regional-growth-stats',
  templateUrl: './regional-growth-stats.component.html',
  styleUrls: ['./regional-growth-stats.component.scss'],
})
export class RegionalGrowthStatsComponent {
  @Input() region: string = '';
  @Input() totalBDs: number = 0;
  @Input() totalPax: number = 0;
  @Input() totalAOs: number = 0;
  @Input() newAOs: string[] = [];
  @Input() totalFNGs: number = 0;
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';

  getRegionDisplayName(): string {
    const regionMap: {[key: string]: string} = {
      'city-of-trees': 'City of Trees',
      'high-desert': 'High Desert',
      'settlers': 'Settlers',
      'canyon': 'Canyon',
    };
    return regionMap[this.region] || this.region;
  }
}
