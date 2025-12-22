import {Component, Input} from '@angular/core';
import {WorkoutBuddy} from '../../../interfaces/wrapped-data.interface';

@Component({
  selector: 'app-pax-network',
  templateUrl: './pax-network.component.html',
  styleUrls: ['./pax-network.component.scss'],
})
export class PaxNetworkComponent {
  @Input() totalPax: number = 0;
  @Input() workoutBuddies: WorkoutBuddy[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
}