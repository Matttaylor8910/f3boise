import {Component, Input, OnInit} from '@angular/core';
import {MonthlyData, DayOfWeek} from '../../../interfaces/wrapped-data.interface';

@Component({
  selector: 'app-combined-breakdown',
  templateUrl: './combined-breakdown.component.html',
  styleUrls: ['./combined-breakdown.component.scss'],
})
export class CombinedBreakdownComponent implements OnInit {
  @Input() monthlyData: MonthlyData[] = [];
  @Input() dayData: DayOfWeek[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';

  strongestMonth = '';
  strongestDay = '';
  monthlyPercentages: Array<{month: string, percentage: number, posts: number, isHighest: boolean}> = [];
  dayPercentages: Array<{day: string, percentage: number, posts: number, isHighest: boolean}> = [];
  maxMonthlyIndex = -1;
  maxDailyIndex = -1;

  ngOnInit() {
    this.calculateStrongestMonth();
    this.calculateStrongestDay();
    this.calculatePercentages();
  }

  private calculateStrongestMonth() {
    if (this.monthlyData.length > 0) {
      const maxData = this.monthlyData.reduce((max, current) =>
        current.posts > max.posts ? current : max
      );
      this.strongestMonth = this.getFullMonthName(maxData.month);
    }
  }

  private calculateStrongestDay() {
    if (this.dayData.length > 0) {
      const maxData = this.dayData.reduce((max, current) =>
        current.posts > max.posts ? current : max
      );
      this.strongestDay = this.getDayName(maxData.day) + 's';
    }
  }

  private calculatePercentages() {
    // Calculate monthly percentages
    if (this.monthlyData.length > 0) {
      const maxMonthly = Math.max(...this.monthlyData.map(d => d.posts));
      this.maxMonthlyIndex = this.monthlyData.findIndex(d => d.posts === maxMonthly);
      this.monthlyPercentages = this.monthlyData.map((d, index) => ({
        month: d.month.charAt(0), // Just first letter
        percentage: (d.posts / maxMonthly) * 100,
        posts: d.posts,
        isHighest: index === this.maxMonthlyIndex
      }));
    }

    // Calculate day percentages
    if (this.dayData.length > 0) {
      const maxDaily = Math.max(...this.dayData.map(d => d.posts));
      this.maxDailyIndex = this.dayData.findIndex(d => d.posts === maxDaily);
      this.dayPercentages = this.dayData.map((d, index) => ({
        day: d.day.charAt(0), // Just first letter
        percentage: (d.posts / maxDaily) * 100,
        posts: d.posts,
        isHighest: index === this.maxDailyIndex
      }));
    }
  }

  private getFullMonthName(month: string): string {
    const monthNames: {[key: string]: string} = {
      'Jan': 'January', 'Feb': 'February', 'Mar': 'March',
      'Apr': 'April', 'May': 'May', 'Jun': 'June',
      'Jul': 'July', 'Aug': 'August', 'Sep': 'September',
      'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
    };
    return monthNames[month] || month;
  }

  private getDayName(day: string): string {
    const dayNames: {[key: string]: string} = {
      'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
      'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
    };
    return dayNames[day] || day;
  }
}