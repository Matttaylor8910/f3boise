import {Component, Input, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { UtilService } from 'src/app/services/util.service';
import {Backblast} from 'types';

interface GridCell {
  date: string;
  color?: string;
  q?: boolean;
  bd?: Backblast;
}

interface LegendItem {
  name: string;
  color: string;
}

interface TimePeriod {
  name: string;
  year: number;
}

// boise started in 2021
const MIN_YEAR = 2021;
const MAX_YEAR = moment().year();
const THIS_PAST_YEAR = -1;
const FORMAT = 'YYYY/MM/DD';

@Component({
  selector: 'app-year-grid',
  templateUrl: './year-grid.component.html',
  styleUrls: ['./year-grid.component.scss'],
})
export class YearGridComponent implements OnInit {
  @Input() name?: string;
  @Input() bds?: Backblast[];

  year: number = THIS_PAST_YEAR;
  years: number[] = [];
  yearOptions: TimePeriod[] = [];

  grid: (GridCell|undefined)[][] = [];
  legend: LegendItem[] = [];

  constructor(
      private readonly router: Router,
      private readonly utilService: UtilService,
  ) {}

  ngOnInit() {
    this.calculateThisPastYear();
  }

  ngOnChanges() {
    this.calculateThisPastYear();
  }

  get yearLabel(): string {
    if (this.year === THIS_PAST_YEAR) return 'This Past Year';
    return String(this.year);
  }

  get canGoPrev(): boolean {
    return this.year > MIN_YEAR || this.year === THIS_PAST_YEAR;
  }

  get canGoNext(): boolean {
    return this.year <= MAX_YEAR && this.year !== THIS_PAST_YEAR;
  }

  calculateGrid(start = `${this.year}/01/01`, end = `${this.year}/12/31`) {
    // if we have the pax name and their bds, build up a map of those BDs
    const bdMap = new Map<string, GridCell>();
    const years = new Set<number>();
    const aos = new Set<string>();
    if (this.name && this.bds) {
      for (const bd of this.bds) {
        const m = moment(bd.date);
        years.add(m.year());

        if (this.inRange(m.format(FORMAT), start, end)) {
          const date = m.format(FORMAT);
          bdMap.set(date, {
            q: bd.qs.includes(this.name),
            color: this.getColor(bd.ao),
            date,
            bd,
          });
          aos.add(bd.ao);
        }
      }
    }

    // build up a row for each day of the week, and populate with undefineds
    // until the first day of the year
    let current = moment(start);
    const grid: (GridCell|undefined)[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < current.day(); i++) {
      grid[i].push(undefined);
    }

    // fill out the rest of the grid, adding BD info when possible
    while (current.format(FORMAT) <= end) {
      const date = current.format(FORMAT);
      const cell = bdMap.get(date);
      grid[current.day()].push(cell ?? {date});
      current = current.add(1, 'day');
    }

    // set the legend based on the AOs shown
    this.legend = Array.from(aos.values()).sort().map(name => {
      return {name, color: this.getColor(name)};
    });

    // set the grid and years options
    this.grid = grid;
    this.years = Array.from(years.values());
    this.yearOptions = [
      {name: 'This Past Year', year: THIS_PAST_YEAR},
      ...this.years.map(year => ({name: String(year), year})),
    ];
  }

  goPrev() {
    if (this.year === THIS_PAST_YEAR) {
      this.year = MAX_YEAR - 1;
    } else {
      this.year--;
    }
    this.calculateGrid();
  }

  goNext() {
    if (this.year === MAX_YEAR) {
      this.year = THIS_PAST_YEAR;
      this.calculateThisPastYear();
    } else {
      this.year++;
      this.calculateGrid();
    }
  }

  setYear(year: number) {
    this.year = year;
    if (year === THIS_PAST_YEAR) {
      this.calculateThisPastYear();
    } else {
      this.calculateGrid();
    }
  }

  cellClicked(cell?: GridCell) {
    if (cell) {
      if (cell?.bd) {
        this.router.navigateByUrl(`backblasts/${cell.bd.id}`);
      } else {
        const name = this.utilService.normalizeName(this.name!);
        const message = `${name} did not post anywhere on ${cell?.date}`;
        this.utilService.alert(message, '', 'Got It');
      }
    }
  }

  private calculateThisPastYear() {
    this.calculateGrid(
        moment().subtract(1, 'year').format(FORMAT), moment().format(FORMAT));
  }

  private inRange(date: string, start: string, end: string): boolean {
    return start <= date && date <= end;
  }

  private randomHexColorCode() {
    const n = (Math.random() * 0xfffff * 1000000).toString(16);
    return '#' + n.slice(0, 6);
  };

  private getColor(ao: string): string {
    switch (ao) {
      case 'Backyard':
        return '#014235';
      case 'Bellagio':
        return '#16A085';
      case 'Bleach':
        return '#8FFF5A';
      case 'Camels Back':
        return '#FFDD33 ';
      case 'Gem':
        return '#3498DB';
      case 'Goose Dynasty':
        return '#A8AAAF';
      case 'Iron Mountain':
        return '#002F4D';
      case 'Old Glory':
        return '#9B59B6';
      case 'Rebel':
        return '#E0C248';
      case 'Reid Merrill':
        return '#3C6F19 ';
      case 'Reta Huskey':
        return '#E75293';
      case 'Rise':
        return '#F39C12';
      case 'Ruckership East':
        return '#E67E22';
      case 'Ruckership West':
        return '#D35400';
      case 'Tower':
        return '#9CD6F1';
      case 'War Horse':
        return '#E74C3C';
      default:
        return this.randomHexColorCode();
    }
  }
}
