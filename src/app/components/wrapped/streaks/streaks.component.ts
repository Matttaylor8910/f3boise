import {Component, Input} from '@angular/core';
import * as moment from 'moment';

@Component({
  selector: 'app-streaks',
  templateUrl: './streaks.component.html',
  styleUrls: ['./streaks.component.scss'],
})
export class StreaksComponent {
  @Input() longestStreak: number = 0;
  @Input() longestStreakStart: string = '';
  @Input() longestStreakEnd: string = '';
  @Input() yearActiveWeeks: number = 0;
  @Input() yearTotalWeeks: number = 0;
  @Input() yearActivePercentage: number = 0;
  @Input() weeklyData: Array<{weekStart: string; weekEnd: string; isActive: boolean}> = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() year: number = 0;

  formatDate(dateStr: string): string {
    return moment(dateStr).format('M/D/YYYY');
  }

  getWeekTooltip(week: {weekStart: string; weekEnd: string; isActive: boolean}): string {
    const start = moment(week.weekStart).format('M/D');
    const end = moment(week.weekEnd).format('M/D');
    return week.isActive ? `Active: ${start} - ${end}` : `Inactive: ${start} - ${end}`;
  }
}

