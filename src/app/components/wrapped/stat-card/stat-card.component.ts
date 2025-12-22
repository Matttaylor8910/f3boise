import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss'],
})
export class StatCardComponent {
  @Input() eyebrow: string = '';
  @Input() bigStat: string | number = '';
  @Input() statLabel: string = '';
  @Input() description: string = '';
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() decorationIcon: string = '';
}