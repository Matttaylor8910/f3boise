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
  @Input()
  weeklyData: Array<{weekStart: string; weekEnd: string; isActive: boolean}> =
      [];
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() year: number = 0;

  formatDate(dateStr: string): string {
    return moment(dateStr).format('M/D/YYYY');
  }

  getWeekTooltip(week: {weekStart: string; weekEnd: string; isActive: boolean}):
      string {
    const start = moment(week.weekStart).format('M/D');
    const end = moment(week.weekEnd).format('M/D');
    return week.isActive ? `Active: ${start} - ${end}` :
                           `Inactive: ${start} - ${end}`;
  }

  /**
   * Checks if a week is part of the longest streak
   * Highlights all weeks in the streak period, even if the streak started in a
   * previous year
   */
  isInLongestStreak(week: {
    weekStart: string; weekEnd: string; isActive: boolean
  }): boolean {
    if (!this.longestStreakStart || !this.longestStreakEnd) {
      return false;
    }

    const weekStart = moment(week.weekStart);
    const streakStart = moment(this.longestStreakStart);
    const streakEnd = moment(this.longestStreakEnd);

    // Check if this week's start date falls within the streak period
    // This highlights all weeks in the streak, regardless of year
    return weekStart.isSameOrAfter(streakStart) &&
        weekStart.isSameOrBefore(streakEnd);
  }

  /**
   * Checks if a week is in the provided year
   */
  isInYear(week: {weekStart: string; weekEnd: string; isActive: boolean}):
      boolean {
    if (!this.year) return false;
    const weekStart = moment(week.weekStart);
    return weekStart.year() === this.year;
  }

  /**
   * Checks if a week is both in the longest streak AND in the provided year
   */
  isStreakInYear(week: {weekStart: string; weekEnd: string; isActive: boolean}):
      boolean {
    return this.isInLongestStreak(week) && this.isInYear(week);
  }
}
