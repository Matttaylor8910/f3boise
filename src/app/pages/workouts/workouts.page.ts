import {Component} from '@angular/core';
import * as moment from 'moment';
import {UtilService} from 'src/app/services/util.service';
import {WorkoutService} from 'src/app/services/workout.service';
import {Workout} from 'types';

interface AoGrouping {
  title: string;
  aos: Workout[];
}

@Component({
  selector: 'app-workouts',
  templateUrl: './workouts.page.html',
  styleUrls: ['./workouts.page.scss'],
})
export class WorkoutsPage {
  groupings: AoGrouping[] = [];
  tomorrow = moment().add(1, 'day').format('dddd');
  currentYear = new Date().getFullYear();

  constructor(
      public readonly utilService: UtilService,
      private readonly workoutService: WorkoutService,
  ) {
    this.setWorkouts();
  }

  async setWorkouts() {
    const aos = await this.workoutService.getAllData();

    const filteredAos = aos.filter(
        ao => ao.workout_dates && Object.keys(ao.workout_dates).length > 0);

    // separate the aos into buckets
    const tomorrow: AoGrouping = {title: 'JOIN US TOMORROW', aos: []};
    const thisWeek: AoGrouping = {title: 'JOIN US THIS WEEK', aos: []};
    for (const ao of filteredAos) {
      if (ao.is_tomorrow) {
        tomorrow.aos.push(ao);
      } else {
        thisWeek.aos.push(ao);
      }
    }

    // depending on if there are workouts tomorrow, show multiple buckets
    if (tomorrow.aos.length === 0) {
      this.groupings = [thisWeek];
    } else {
      thisWeek.title = 'OR ANOTHER TIME';
      this.groupings = [tomorrow, thisWeek];
    }
  }
}
