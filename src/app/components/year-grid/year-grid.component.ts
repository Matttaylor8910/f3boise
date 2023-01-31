import {Component, Input, OnInit} from '@angular/core';
import * as moment from 'moment';
import {Backblast} from 'types';

interface GridCell {
  color?: string;
  q?: boolean;
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

  constructor() {}

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
    const aos = new Set<string>();

    // fill in a grid with all weeks for the year
    const thisYear = moment(`${this.year}/01/01`);
    const grid: (GridCell|undefined)[][] = new Array(7).fill([]).map(() => {
      return new Array(thisYear.weeksInYear()).fill({});
    });

    // remove excess days from the start of the year
    let current = moment(thisYear).startOf('year').day();
    while (current > 0) {
      grid[--current][0] = undefined;
    }
    // remove excess days from the end of the year
    current = moment(thisYear).endOf('year').day();
    while (current++ < 6) {
      grid[current][grid[current].length - 1] = undefined;
    }

    // if we have the pax name and their bds, fill out the grid
    if (this.name && this.bds) {
      for (const bd of this.bds) {
        const m = moment(bd.date);
        if (m.year() === this.year) {
          grid[m.day()][m.week() - 1] = {
            q: bd.qs.includes(this.name),
            color: this.getColor(bd.ao),
          };
          aos.add(bd.ao);
        }
      }
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

  private getColor(ao: string): string {
    switch (ao) {
      case 'Backyard':
        return '#1ABC9C';
      case 'Bleach':
        return '#16A085';
      case 'Bellagio':
        return '#2ECC71';
      case 'Discovery':
        return '#27AE60';
      case 'Gem':
        return '#3498DB';
      case 'Iron Mountain':
        return '#2980B9';
      case 'Old Glory':
        return '#9B59B6';
      case 'Rebel':
        return '#8E44AD';
      case 'Rise':
        return '#F39C12';
      case 'Ruckership East':
        return '#E67E22';
      case 'Ruckership West':
        return '#D35400';
      case 'War Horse':
        return '#E74C3C';
      default:
        return 'black';
    }
  }
}
