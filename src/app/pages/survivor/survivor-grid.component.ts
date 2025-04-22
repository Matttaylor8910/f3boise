import {Component, Input, OnChanges, OnInit} from '@angular/core';
import {QLineUp, Workout} from 'types';

import {UtilService} from '../../services/util.service';
import {WorkoutService} from '../../services/workout.service';

interface GridData {
  aoWithDay: string;  // e.g. "Bellagio (Tue)"
  ao: string;         // e.g. "Bellagio"
  id: string;         // e.g. "bellagio" - used for matching with Q data
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

  constructor(
      private readonly workoutService: WorkoutService,
      private readonly utilService: UtilService) {}

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
    console.log('Starting processQLineUps');
    console.log('Q lineups:', this.qLineUps);
    console.log('Workouts:', this.workouts);

    // Get AO + day of week combinations from workouts
    const aosByDay = new Map<string, {ao: string, id: string, day: number}>();

    this.workouts.forEach(workout => {
      const workoutDays = Object.keys(workout.workout_dates);
      console.log(
          'Processing workout:',
          {name: workout.name, id: workout.id, days: workoutDays});

      workoutDays.forEach(day => {
        const dayIndex = this.dayNames.indexOf(day);
        aosByDay.set(
            `${workout.name}-${dayIndex}`,
            {ao: workout.name, id: workout.id, day: dayIndex});
      });
    });

    // Sort by AO name and then by day of week
    const sortedAosByDay = Array.from(aosByDay.values()).sort((a, b) => {
      if (a.ao === b.ao) {
        return a.day - b.day;
      }
      return a.ao.localeCompare(b.ao);
    });

    // Get unique weeks starting from first Sunday
    const startDate = new Date('2025-05-04');  // First Sunday
    const endDate = new Date('2025-12-31');
    this.weekDates = this.getWeekDates(startDate, endDate);

    // Create grid data with empty Q slots
    this.gridData = sortedAosByDay.map(({ao, id, day}) => {
      const weekData = this.weekDates.map(weekStart => {
        const targetDate = new Date(weekStart);
        targetDate.setDate(targetDate.getDate() + day);
        return {date: targetDate.toISOString(), q: null};
      });

      return {
        aoWithDay: `${ao} (${this.dayNames[day]})`,
        ao,
        id,
        dayOfWeek: day,
        weekData
      };
    });

    // Now process each Q lineup
    this.qLineUps.forEach(q => {
      if (!q.qs || q.qs.length === 0) {
        return;
      }

      console.log('Processing Q lineup:', {ao: q.ao, date: q.date, qs: q.qs});

      // Find the matching row
      const row = this.gridData.find(
          r => this.utilService.normalizeName(r.ao) ===
              this.utilService.normalizeName(q.ao));

      if (!row) {
        return;
      }

      // Find the matching date in the row's weekData
      const qDate = new Date(q.date);
      const cellIndex = row.weekData.findIndex(
          cell => this.isSameDay(new Date(cell.date), qDate));

      if (cellIndex === -1) {
        return;
      }

      // Set the Q
      row.weekData[cellIndex].q = q.qs[0];
    });
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    const matches = date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
    return matches;
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