import {Component} from '@angular/core';
import * as moment from 'moment';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';
import {QLineUp} from 'types';

interface DateRow {
  date: string;
  displayDate: string;
  cols: (QCell|undefined)[];
}

interface QCell extends QLineUp {
  warning: boolean;
  taken: boolean;
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

  aos: string[] = [];
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
    const aos = new Set<string>();

    const to = moment(from).add(this.days, 'days').format(FORMAT);
    const qs = await this.qService.getQLineUp(from, to);

    qs.forEach(q => {
      const days = moment(q.date).diff(moment().startOf('day'), 'days');
      const taken = q.qs !== null && q.qs.length > 0;
      const warning = days <= this.warningDays && !taken;
      if (warning) {
        console.log(days, q.date, moment().startOf('day').format(FORMAT));
      }
      const aoMap = dateMap.get(q.date) ?? new Map<string, QCell>();
      aoMap.set(q.ao, {...q, warning, taken});
      dateMap.set(q.date, aoMap);
      aos.add(q.ao);
    });

    this.aos = Array.from(aos).sort((a, b) => a.localeCompare(b));

    let lastDate: string;
    Array.from(dateMap).map(item => {
      const [date, aoMap] = item;

      // build up the cols for this date
      const cols: (QCell|undefined)[] = [];
      for (let i = 0; i < this.aos.length; i++) {
        cols.push(aoMap.get(this.aos[i]));
      }

      // add in empty days if they're missing
      while (lastDate !== date) {
        if (lastDate) {
          const lastMoment = moment(lastDate).add(1, 'day');
          const diff = moment(date).diff(lastMoment, 'day');
          lastDate = lastMoment.format(FORMAT);
          if (diff > 0) {
            this.addDate(lastDate, new Array(this.aos.length));
          }
        } else {
          lastDate = date;
        }
      }

      // finally push this date
      this.addDate(date, cols);
    });
  }

  loadMore() {
    const {date} = this.dates[this.dates.length - 1];
    this.loadQLineup(moment(date).add(1, 'day').format(FORMAT));
  }

  addDate(date: string, cols: (QCell|undefined)[]) {
    let displayDate = moment(date).format('ddd, M/D');
    if (date === moment().format(FORMAT)) {
      displayDate = `Today, ${moment(date).format('M/D')}`
    }
    this.dates.push({date, displayDate, cols});
  }
}
