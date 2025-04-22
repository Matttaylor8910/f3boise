import {Component, Input, OnChanges, OnInit} from '@angular/core';
import {QLineUp, Workout} from 'types';

import {WorkoutService} from '../../services/workout.service';

interface GridData {
  aoWithDay: string;  // e.g. "Bellagio (Tue)"
  ao: string;         // e.g. "Bellagio"
  dayOfWeek: number;  // 0-6, where 0 is Sunday
  weekData: {
    date: string; q: string | null;  // Single Q name or null
  }[];
}

@Component({
  selector: 'app-survivor-grid',
  template: `
    <div class="grid-container">
      <table>
        <thead>
          <tr>
            <th>AO</th>
            <th *ngFor="let week of weekDates">
              Week of {{week | date:'shortDate'}}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of gridData">
            <td>{{row.aoWithDay}}</td>
            <td *ngFor="let week of row.weekData"
                [class.has-q]="week.q">
              {{week.q || ''}}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .grid-container {
      overflow-x: auto;
      margin: 1rem;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      min-width: 800px;
    }

    th, td {
      border: 1px solid var(--ion-color-medium);
      padding: 8px;
      text-align: left;
      font-size: 0.9em;
    }

    th {
      background-color: var(--ion-color-light);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .has-q {
      background-color: var(--ion-color-success-tint);
    }
  `]
})
export class SurvivorGridComponent implements OnChanges, OnInit {
  @Input() qLineUps: QLineUp[] = [];

  weekDates: Date[] = [];
  gridData: GridData[] = [];
  workouts: Workout[] = [];

  private readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(private readonly workoutService: WorkoutService) {}

  async ngOnInit() {
    this.workouts = await this.workoutService.getAllData();
    if (this.qLineUps.length) {
      this.processQLineUps();
    }
  }

  ngOnChanges() {
    if (this.qLineUps.length && this.workouts.length) {
      this.processQLineUps();
    }
  }

  private processQLineUps() {
    // Get AO + day of week combinations from workouts
    const aosByDay = new Map<string, {ao: string, day: number}>();

    this.workouts.forEach(workout => {
      const workoutDays = Object.keys(workout.workout_dates);
      workoutDays.forEach(day => {
        const dayIndex = this.dayNames.indexOf(day);
        const key = `${workout.name}-${dayIndex}`;
        aosByDay.set(key, {ao: workout.name, day: dayIndex});
      });
    });

    // Sort by AO name and then by day of week
    const sortedAosByDay = Array.from(aosByDay.values()).sort((a, b) => {
      if (a.ao === b.ao) {
        return a.day - b.day;
      }
      return a.ao.localeCompare(b.ao);
    });

    // Get unique weeks starting from first Monday
    const startDate = new Date('2025-05-05');  // First Monday
    const endDate = new Date('2025-12-31');
    this.weekDates = this.getWeekDates(startDate, endDate);

    // Create grid data
    this.gridData = sortedAosByDay.map(({ao, day}) => {
      const weekData = this.weekDates.map(weekStart => {
        // Get the specific day in this week
        const targetDate = new Date(weekStart);
        targetDate.setDate(
            targetDate.getDate() + ((7 + day - weekStart.getDay()) % 7));

        // Find Q for this specific day
        const qForDay = this.qLineUps.find(q => {
          const qDate = new Date(q.date);
          return q.ao.toLowerCase() === ao.toLowerCase() &&
              qDate.getFullYear() === targetDate.getFullYear() &&
              qDate.getMonth() === targetDate.getMonth() &&
              qDate.getDate() === targetDate.getDate();
        });

        return {date: targetDate.toISOString(), q: qForDay?.qs?.[0] || null};
      });

      return {
        aoWithDay: `${ao} (${this.dayNames[day]})`,
        ao,
        dayOfWeek: day,
        weekData
      };
    });
  }

  private getWeekDates(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }

    return dates;
  }
}