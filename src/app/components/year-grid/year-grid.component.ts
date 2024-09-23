import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';
import {UtilService} from 'src/app/services/util.service';

import {AO} from '../../../../constants';
import {Backblast} from '../../../../types';

interface GridCell {
  date: string;
  popover?: string;
  color?: string;
  text?: string;
  backblastId?: string;
  count?: number;
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

// shades of green from lightest to darkest
const HEATMAP_COLORS = [
  '#e0f8e0', '#c8f0c8', '#b0e8b0', '#98e098', '#80d880', '#68d068', '#50c850',
  '#38c038', '#20b820', '#08b008'
];

@Component({
  selector: 'app-year-grid',
  templateUrl: './year-grid.component.html',
  styleUrls: ['./year-grid.component.scss'],
})
export class YearGridComponent implements OnInit {
  // the list of bds
  @Input() bds?: Backblast[];

  // when a name is passed in, we filter the BDs and only show this in the
  // context of a PAX
  @Input() name?: string;

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
    const aoColorMap = new Map<string, string>();
    let largestPaxCount = 0;

    if (this.bds) {
      for (let bd of this.bds) {
        bd = {...bd};  // clone it
        const m = moment(bd.date);
        years.add(m.year());

        if (this.inRange(m.format(FORMAT), start, end)) {
          const date = m.format(FORMAT);

          // PAX grid
          if (this.name) {
            // show when they Q and show the date as a popover
            const text = bd.qs.includes(this.name) ? 'Q' : '';
            const popover = date;

            // load the color for this ao, and save it to to a map for future
            // bds at the same ao
            let color = aoColorMap.get(bd.ao);
            if (color === undefined) {
              color = this.getColor(bd);
              aoColorMap.set(bd.ao, color);
            }

            bdMap.set(date, {text, popover, color, date, backblastId: bd.id});
            aos.add(bd.ao);
          }

          // non-PAX grid
          else {
            // if there's already other BDs for this day, aggregate the total
            // count of PAX for the day
            let count = bd.pax.length;
            const existing = bdMap.get(date);
            if (existing?.count) {
              count += existing.count;
            }

            // show the # of PAX in the popover and leave the text blank
            const text = '';
            const popover = `${count} PAX`;

            // keep track of the largest count
            if (count > largestPaxCount) {
              largestPaxCount = count;
            }

            // set the color to a blank string, we will set colors based on
            // total counts at the end
            bdMap.set(date, {text, popover, color: '', date, count});
          }
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

      // calculate non-PAX grid colors for cells with
      if (cell && !this.name) {
        const paxCount = cell.count || 0;
        cell.color = this.getHeatmapColor(paxCount, largestPaxCount);
      }

      grid[current.day()].push(cell ?? {date});
      current = current.add(1, 'day');
    }

    // set the legend based on the AOs shown
    this.legend = Array.from(aos.values()).sort().map(name => {
      return {name, color: aoColorMap.get(name)!};
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
      if (cell?.backblastId) {
        this.router.navigateByUrl(`backblasts/${cell.backblastId}`);
      } else if (this.name) {
        const name = this.utilService.normalizeName(this.name!);
        const message = `${name} did not post anywhere on ${cell?.date}`;
        this.utilService.alert(message, '', 'Got It');
      } else {
        const {count = 0} = cell;
        const message = count > 0 ? `${count} PAX posted on ${cell?.date}` :
                                    `No PAX posted on ${cell?.date}`;
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

  private getColor(bd: Backblast): string {
    switch (bd.ao.toLowerCase()) {
      case AO.BACKYARD:
        return '#014235';
      case AO.BELLAGIO:
        return '#16A085';
      case AO.BERNIE_FISHER:
        return '#720374';
      case AO.BLACK_DIAMOND:
      case AO.BLACK_OPS:
        return '#000000';
      case AO.BLEACH:
        return '#8FFF5A';
      case AO.CAMELS_BACK:
        return '#FFDD33 ';
      case AO.CAPITOL:
        return '#1e0697';
      case AO.COOP:
        return '#3C6F19 ';
      case AO.DARK_STRIDE:
        return '#E75293';
      case AO.EMMETT_CITY_PARK:
        return '#3067e6';
      case AO.GEM:
        return '#3498DB';
      case AO.GOOSE_DYNASTY:
        return '#A8AAAF';
      case AO.IRON_MOUNTAIN:
        return '#002F4D';
      case AO.OLD_GLORY:
        return '#9B59B6';
      case AO.REBEL:
        return '#E0C248';
      case AO.RISE:
        return '#F39C12';
      case AO.RUCKERSHIP_EAST:
        return '#E67E22';
      case AO.RUCKERSHIP_WEST:
        return '#D35400';
      case AO.TOWER:
        return '#9CD6F1';
      case AO.WAR_HORSE:
        return '#E74C3C';
      case AO.WEST_CANYON_ELEMENTARY:
        return '#7fd7ab';
      default:
        return this.randomHexColorCode();
    }
  }

  private getHeatmapColor(count: number, max: number): string {
    // Calculate the index of the color based on the count, returning a lighter
    // color the closer the count is to 0, darker the closer it is to "max"
    const index = Math.floor((count / max) * (HEATMAP_COLORS.length - 1));
    return HEATMAP_COLORS[index];
  }
}
