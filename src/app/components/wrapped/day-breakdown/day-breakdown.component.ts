import {Component, Input, OnInit} from '@angular/core';
import {DayOfWeek} from '../../../interfaces/wrapped-data.interface';

@Component({
  selector: 'app-day-breakdown',
  templateUrl: './day-breakdown.component.html',
  styleUrls: ['./day-breakdown.component.scss'],
})
export class DayBreakdownComponent implements OnInit {
  @Input() data: DayOfWeek[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)';

  bestDay = '';

  ngOnInit() {
    if (this.data.length > 0) {
      const maxData = this.data.reduce((max, current) => 
        current.posts > max.posts ? current : max
      );
      this.bestDay = this.getDayName(maxData.day);
    }
  }

  private getDayName(day: string): string {
    const dayNames: {[key: string]: string} = {
      'Mon': 'Monday',
      'Tue': 'Tuesday', 
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday',
      'Sun': 'Sunday'
    };
    return dayNames[day] || day;
  }
}