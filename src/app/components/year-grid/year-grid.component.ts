import {Component, Input, OnInit} from '@angular/core';
import * as moment from 'moment';
import {UtilService} from 'src/app/services/util.service';
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

// boise started in 2021
const MIN_YEAR = 2021;
const MAX_YEAR = moment().year();

@Component({
  selector: 'app-year-grid',
  templateUrl: './year-grid.component.html',
  styleUrls: ['./year-grid.component.scss'],
})
export class YearGridComponent implements OnInit {
  @Input() name?: string;
  @Input() bds?: Backblast[];

  year = MAX_YEAR;

  grid: (GridCell|undefined)[][] = [];
  legend: LegendItem[] = [];

  constructor(
      private readonly utilService: UtilService,
  ) {}

  ngOnInit() {
    this.calculateGrid();
  }

  ngOnChanges() {
    this.calculateGrid();
  }

  get canGoPrev(): boolean {
    return this.year > MIN_YEAR;
  }

  get canGoNext(): boolean {
    return this.year < MAX_YEAR;
  }

  calculateGrid() {
    // if we have the pax name and their bds, build up a map of those BDs
    const bdMap = new Map<string, GridCell>();
    const aos = new Set<string>();
    if (this.name && this.bds) {
      for (const bd of this.bds) {
        const m = moment(bd.date);
        if (m.year() === this.year) {
          const date = m.format('YYYY/MM/DD');
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
    let current = moment(`${this.year}/01/01`);
    const grid: (GridCell|undefined)[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < current.day(); i++) {
      grid[i].push(undefined);
    }

    // fill out the rest of the grid, adding BD info when possible
    while (current.year() === this.year) {
      const date = current.format('YYYY/MM/DD');
      const cell = bdMap.get(date);
      grid[current.day()].push(cell ?? {date});
      current = current.add(1, 'day');
    }

    // set the legend based on the AOs shown
    this.legend = Array.from(aos.values()).sort().map(name => {
      return {name, color: this.getColor(name)};
    });

    this.grid = grid;
  }

  goPrev() {
    this.year--;
    this.calculateGrid();
  }

  goNext() {
    this.year++;
    this.calculateGrid();
  }

  cellClicked(cell?: GridCell) {
    if (cell) {
      const name = this.utilService.normalizeName(this.name!);
      let message = `${name} did not post anywhere on ${cell?.date}`;
      if (cell?.bd) {
        message = name;
        message += cell.q ? ' Q\'d ' : ' posted ';
        message += `at ${cell.bd.ao} on ${cell.date}`;
      }
      this.utilService.alert(message, '', 'Got It');
    }
  }

  private getColor(ao: string): string {
    switch (ao) {
      case 'Backyard':
        return '#014235';
      case 'Bellagio':
        return '#16A085';
      case 'Bleach':
        return '#8FFF5A';
      case 'Discovery':
        return '#9CD6F1';
      case 'Gem':
        return '#3498DB';
      case 'Iron Mountain':
        return '#002F4D';
      case 'Old Glory':
        return '#9B59B6';
      case 'Rebel':
        return '#E0C248';
      case 'Rise':
        return '#F39C12';
      case 'Ruckership East':
        return '#E67E22';
      case 'Ruckership West':
        return '#D35400';
      case 'War Horse':
        return '#E74C3C';
      default:
        return '#000';
    }
  }
}
