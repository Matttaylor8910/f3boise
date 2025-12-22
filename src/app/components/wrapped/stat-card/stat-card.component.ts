import {Component, Input} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

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
  @Input() photoUrl: string|null = null;
  @Input() paxName: string = '';
  @Input() largeStat: boolean = false;

  constructor(private readonly utilService: UtilService) {}

  get normalizedName(): string {
    return this.paxName ? this.utilService.normalizeName(this.paxName) : '';
  }
}