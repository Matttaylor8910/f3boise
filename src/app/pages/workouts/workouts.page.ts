import {Component} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';

const AO_DEETS = {
  'Backyard': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '2400 S Stoddard Rd, Meridian, ID 83642',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: '5:15am - 6:00am',
      Thursday: null,
      Friday: '5:15am - 6:00am',
      Saturday: null,
    },
  },
  'Bellagio': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: 'Kleiner Park Loop, Meridian, ID 83642',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: '5:15am - 6:00am',
      Wednesday: null,
      Thursday: '5:15am - 6:00am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Black Diamond': {
    type: 'High Intensity',
    icon: 'alert-circle-outline',
    address: 'Kleiner Park Loop, Meridian, ID 83642',
    schedule: {
      Monday: '5:00am - 6:00am',
      Tuesday: null,
      Wednesday: '5:00am - 6:00am',
      Thursday: null,
      Friday: null,
      Saturday: null,
    },
  },
  'Bleach': {
    type: 'Ruck/Sandbag',
    icon: 'barbell-outline',
    address: '801 Aurora Dr, Boise, ID 83709',
    addressLink: true,
    schedule: {
      Monday: '5:15am - 6:00am',
      Tuesday: null,
      Wednesday: '5:15am - 6:00am',
      Thursday: null,
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Discovery': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '2121 E Lake Hazel Rd, Meridian, ID 83642',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: null,
      Thursday: null,
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Gem': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '3423 N Meridian Rd, Meridian, ID 83642',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: '5:15am - 6:00am',
      Wednesday: null,
      Thursday: '5:15am - 6:00am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Iron Mountain': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '75 Marjorie Ave, Middleton, ID 83644',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: '5:30am - 6:15am',
      Wednesday: null,
      Thursday: '5:30am - 6:15am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Old Glory': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '3064 W Malta Dr, Meridian, ID 83646',
    addressLink: true,
    schedule: {
      Monday: '6:00am - 6:45am',
      Tuesday: null,
      Wednesday: '6:00am - 6:45am',
      Thursday: null,
      Friday: null,
      Saturday: null,
    },
  },
  'Rebel': {
    type: 'Running',
    icon: 'footsteps-outline',
    address: '3801 E Hill Park Street, Meridian, ID 83642',
    addressLink: true,
    schedule: {
      Monday: null,
      Tuesday: '5:15am - 6:00am',
      Wednesday: null,
      Thursday: '5:15am - 6:00am',
      Friday: null,
      Saturday: null,
    },
  },
  'Rise': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '4403 S Surprise Way, Boise, ID 83716',
    addressLink: true,
    schedule: {
      Monday: '5:15am - 6:00am',
      Tuesday: null,
      Wednesday: '5:15am - 6:00am',
      Thursday: null,
      Friday: null,
      Saturday: null,
    },
  },
  'Ruckership East': {
    type: 'Ruck/Hike',
    icon: 'footsteps-outline',
    address: 'Location changes every week',
    addressLink: false,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: null,
      Thursday: null,
      Friday: '5:30am - 6:30am',
      Saturday: null,
    },
  },
  'Ruckership West': {
    type: 'Ruck/Hike',
    icon: 'footsteps-outline',
    address: 'Location changes every week',
    addressLink: false,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: null,
      Thursday: null,
      Friday: '5:30am - 6:30am',
      Saturday: null,
    },
  },
  'War Horse': {
    type: 'Bootcamp',
    icon: 'barbell-outline',
    address: '1304 7th St N, Nampa, ID 83687',
    addressLink: true,
    schedule: {
      Monday: '5:15am - 6:00am',
      Tuesday: null,
      Wednesday: '5:15am - 6:00am',
      Thursday: null,
      Friday: null,
      Saturday: null,
    },
  },
};

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
      const ao = (AO_DEETS as any)[name];

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
