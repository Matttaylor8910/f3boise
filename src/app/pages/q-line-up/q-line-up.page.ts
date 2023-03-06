import {Component} from '@angular/core';
import * as moment from 'moment';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';
import {QLineUp} from 'types';

interface DateRow {
  date: string;
  displayDate: string;
  cols: QCell[];
  qs: Set<string>;
  hidden: boolean;
}

interface QCell extends QLineUp {
  warning: boolean;
  taken: boolean;
  hidden: boolean;
  hideText: boolean;
  transparent: boolean;
}

interface AoColumn {
  name: string;
  qs: Set<string>;
  hidden: boolean;
}

const FORMAT = 'YYYY-MM-DD';

@Component({
  selector: 'app-q-line-up',
  templateUrl: './q-line-up.page.html',
  styleUrls: ['./q-line-up.page.scss'],
})
export class QLineUpPage {
  days = 50;  // days to load at a time
  warningDays = 2;

  filterText = '';
  everythingHidden = false;

  aos: AoColumn[] = [];
  dates: DateRow[] = [];

  constructor(
      public readonly utilService: UtilService,
      private readonly qService: QService,
  ) {
    this.loadQLineup();
  }

  async loadQLineup(from = moment().format(FORMAT)) {
    // a map whose key is the date, the value is another map where the key is
    // the ao and the value the text to display
    const dateMap = new Map<string, Map<string, QCell>>();
    const aos = new Map<string, AoColumn>();
    if (this.aos) {
      this.aos.forEach(ao => aos.set(ao.name, ao));
    }

    const to = moment(from).add(this.days, 'days').format(FORMAT);
    const qs = await this.qService.getQLineUp(from, to);

    qs.forEach(q => {
      const days = moment(q.date).diff(moment().startOf('day'), 'days');
      const taken = q.qs !== null && q.qs.length > 0;
      const warning = days <= this.warningDays && !taken;
      const aoMap = dateMap.get(q.date) ?? new Map<string, QCell>();
      aoMap.set(q.ao, {
        ...q,
        warning,
        taken,
        hidden: false,
        transparent: false,
        hideText: false,
      });
      dateMap.set(q.date, aoMap);

      const ao = aos.get(q.ao) ?? {
        name: q.ao,
        qs: new Set<string>(),
        hidden: false,
      };
      q.qs?.forEach(name => ao.qs.add(name));
      aos.set(q.ao, ao);
    });

    this.aos =
        Array.from(aos.values()).sort((a, b) => a.name.localeCompare(b.name));

    let lastDate: string;
    Array.from(dateMap).map(item => {
      const [date, aoMap] = item;

      // build up the cols for this date
      const cols: QCell[] = [];
      for (let i = 0; i < this.aos.length; i++) {
        cols.push(this.getCell(date, this.aos[i].name, aoMap));
      }

      // add in empty days if they're missing
      while (lastDate !== date) {
        if (lastDate) {
          const lastMoment = moment(lastDate).add(1, 'day');
          const diff = moment(date).diff(lastMoment, 'day');
          lastDate = lastMoment.format(FORMAT);
          if (diff > 0) {
            this.addDate(lastDate, this.aos.map(ao => {
              return this.getCell(lastDate, ao.name);
            }));
          }
        } else {
          lastDate = date;
        }
      }

      // finally push this date
      this.addDate(date, cols);
    });

    this.applyFilter();
  }

  loadMore() {
    const {date} = this.dates[this.dates.length - 1];
    this.loadQLineup(moment(date).add(1, 'day').format(FORMAT));
  }

  addDate(date: string, cols: QCell[]) {
    let displayDate = moment(date).format('ddd, M/D');
    if (date === moment().format(FORMAT)) {
      displayDate = `Today, ${moment(date).format('M/D')}`
    }

    const qs = new Set<string>();
    cols.forEach(col => {
      col.qs?.forEach(q => {
        if (q) qs.add(q);
      });
    });

    this.dates.push({date, displayDate, cols, qs, hidden: false});
  }

  applyFilter() {
    for (const ao of this.aos) {
      ao.hidden = this.shouldBeHidden(ao.qs, this.filterText);
    }
    for (const date of this.dates) {
      date.hidden = this.shouldBeHidden(date.qs, this.filterText);

      for (const cell of date.cols) {
        cell.hidden = this.aos.find(ao => ao.name === cell.ao)?.hidden ?? false;
        cell.hideText = this.filterText.length > 0 && !cell.qs?.some(q => {
          return q.toLowerCase().includes(this.filterText.toLowerCase());
        });
      }
    }

    this.everythingHidden = this.aos.every(ao => ao.hidden);
  }

  private getCell(date: string, ao: string, aoMap = new Map<string, QCell>()):
      QCell {
    return aoMap.get(ao) ?? {
      warning: false,
      taken: false,
      hidden: false,
      hideText: false,
      ao,
      date,
      closed: false,
      text: null,
      qs: [],
      transparent: true,
    };
  }

  private shouldBeHidden(set: Set<string>, text: string) {
    // if there's no filter text, always show every item
    if (text.length === 0) return false;

    // hide empty rows/cols when there is a filter text
    if (text.length > 0 && set.size === 0) return true;

    return ![...set.values()].some(name => {
      return name.toLowerCase().includes(text.toLowerCase());
    });
  }
}
