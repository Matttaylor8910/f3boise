import {Injectable} from '@angular/core';
import {Workout} from 'types';

import {BASE_URL} from '../../../constants';

import {HttpService} from './http.service';

const URL = `${BASE_URL}/region/workouts`;

const DAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MAP = {
  'Sun': 'Sunday',
  'Mon': 'Monday',
  'Tue': 'Tuesday',
  'Wed': 'Wednesday',
  'Thu': 'Thursday',
  'Fri': 'Friday',
  'Sat': 'Saturday',
};

@Injectable({providedIn: 'root'})
export class WorkoutService {
  allData?: Workout[];

  constructor(
      private readonly http: HttpService,
  ) {}

  async loadAllData(): Promise<Workout[]> {
    this.allData =
        (await this.http.get(URL) as Workout[])
            .filter(workout => Object.keys(workout.workout_dates).length > 0)
            .map(this.mapWorkout.bind(this))
            .sort((a, b) => {
              return a.name.localeCompare(b.name);
            });
    return this.allData;
  }

  async getAllData(): Promise<Workout[]> {
    return this.allData ?? await this.loadAllData();
  }

  private mapWorkout(workout: Workout): Workout {
    // provide human readable schedule
    workout.schedule =
        Object.entries(workout.workout_dates)
            .sort((a, b) => {
              const [aDay] = a;
              const [bDay] = b;
              return DAY_ORDER.indexOf(aDay) - DAY_ORDER.indexOf(bDay);
            })
            .map(([day, times]) => {
              const [start, end] = times;
              const fullDay = DAY_MAP[day as keyof typeof DAY_MAP];
              return `${fullDay}: ${this.convertTime(start)} - ${
                  this.convertTime(end)}`;
            });

    // map the workout type to an ion-icon name
    workout.icon = this.getIcon(workout.workout_type);

    // determine if the workout is closed tomorrow
    if (workout.tomorrows_q === 'closed') {
      workout.closed = true;
      workout.is_tomorrow = false;
    }

    return workout;
  }

  private convertTime(time: string) {
    // Prepend any date. Use your birthday.
    return new Date(`1970-01-01T${time}Z`).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    });
  }

  private getIcon(workoutType: string) {
    switch (workoutType) {
      case 'High Intensity':
        return 'alert-circle-outline';
      case 'Ruck/Hike':
      case 'Running':
        return 'footsteps-outline';
      default:
        return 'barbell-outline';
    }
  }
}
