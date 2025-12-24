import {Component, Input, OnInit} from '@angular/core';
import {WorkoutType} from '../../../interfaces/wrapped-data.interface';

@Component({
  selector: 'app-workout-type-breakdown',
  templateUrl: './workout-type-breakdown.component.html',
  styleUrls: ['./workout-type-breakdown.component.scss'],
})
export class WorkoutTypeBreakdownComponent implements OnInit {
  @Input() workoutTypes: WorkoutType[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  topType = '';
  topTypeIcon = '';
  isSingleType = false;

  ngOnInit() {
    if (this.workoutTypes.length > 0) {
      this.topType = this.workoutTypes[0].type;
      this.topTypeIcon = this.getIconForWorkoutType(this.topType);
      this.isSingleType = this.workoutTypes.length === 1;
    }
  }

  private getIconForWorkoutType(type: string): string {
    const iconMap: {[key: string]: string} = {
      'Bootcamp': '💪',
      'High Intensity': '🔥',
      'Ruck/Sandbag': '🎒',
      'Running': '🏃',
      'Black Ops': '⚫',
    };
    return iconMap[type] || '💪';
  }
}

