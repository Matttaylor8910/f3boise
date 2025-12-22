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
  isSingleType = false;

  ngOnInit() {
    if (this.workoutTypes.length > 0) {
      this.topType = this.workoutTypes[0].type;
      this.isSingleType = this.workoutTypes.length === 1;
    }
  }
}

