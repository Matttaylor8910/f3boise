import {Component} from '@angular/core';
import {DETAILS} from 'ao-schedule';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';

interface Ao {
  name: string;
  type: string;
  icon: string;
  address: string;
  addressLink: boolean;
  schedule: string[];
  averagePax: number;  // Math.ceil of average in last 90 days
  qTomorrow?: string;  // optional q
}

interface AoGrouping {
  title: string;
  aos: Ao[];
}

@Component({
  selector: 'app-workouts',
  templateUrl: './workouts.page.html',
  styleUrls: ['./workouts.page.scss'],
})
export class WorkoutsPage {
  groupings: AoGrouping[] = [];
  tomorrow = moment().add(1, 'day').format('dddd');

  constructor(
      public readonly utilService: UtilService,
      private readonly backblastService: BackblastService,
      private readonly qService: QService,
  ) {
    this.setAos();
  }

  async setAos() {
    // build up a map of aos to the list of pax counts per bd
    const aoMap = new Map<string, number[]>();
    const backblasts = await this.backblastService.getAllData();
    backblasts.forEach(bb => {
      const days = moment().diff(moment(bb.date), 'days');
      if (days < 90) {
        const existing = aoMap.get(bb.ao) ?? [];
        aoMap.set(bb.ao, existing.concat(bb.pax.length));
      }
    });

    // build up a map of aos with a q tomorrow
    const qMap = new Map<string, string>();
    const date = moment().add(1, 'day').format('YYYY-MM-DD');
    const qsTomorrow = await this.qService.getQLineUp(date, date);
    qsTomorrow.forEach(lineup => {
      const qs = lineup.qs || [];
      if (qs.length > 0) {
        const ao = this.utilService.normalizeName(lineup.ao);
        qMap.set(ao, qs.join(', '));
      }
    });

    const aos: Ao[] = []

    Array.from(aoMap).forEach(aoItem => {
      const [name, counts] = aoItem;
      const ao = (DETAILS as any)[name];

      if (ao !== undefined) {
        const schedule = Object.entries(ao.schedule)
                             .map(([day, time]) => `${day}: ${time}`)
                             .filter(item => !item.includes('null'));

        const averagePax =
            Math.ceil(counts.reduce((a, b) => a + b) / counts.length);

        aos.push({
          name,
          type: ao.type,
          icon: ao.icon,
          address: ao.address,
          addressLink: ao.addressLink,
          schedule,
          averagePax,
        });
      }
    });


    aos.sort((a, b) => a!.name.localeCompare(b!.name));

    // separate the aos into buckets
    const tomorrow: AoGrouping = {title: 'JOIN US TOMORROW', aos: []};
    const thisWeek: AoGrouping = {title: 'JOIN US THIS WEEK', aos: []};
    for (const ao of aos) {
      if (ao.schedule.some(day => day.includes(this.tomorrow))) {
        ao.qTomorrow = qMap.get(this.utilService.normalizeName(ao.name));
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
