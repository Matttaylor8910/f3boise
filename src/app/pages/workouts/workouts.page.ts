import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';

const AO_DEETS = {
  'Backyard': {
    type: 'Bootcamp',
    address: '2400 S Stoddard Rd, Meridian, ID 83642',
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
    address: 'Kleiner Park Loop, Meridian, ID 83642',
    schedule: {
      Monday: null,
      Tuesday: '5:15am - 6:00am',
      Wednesday: null,
      Thursday: '5:15am - 6:00am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'Bleach': {
    type: 'Ruck/Sandbag',
    address: '801 Aurora Dr, Boise, ID 83709',
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
    address: '2121 E Lake Hazel Rd, Meridian, ID 83642',
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
    address: '3423 N Meridian Rd, Meridian, ID 83642',
    schedule: {
      Monday: null,
      Tuesday: '5:15am - 6:00am',
      Wednesday: null,
      Thursday: '5:15am - 6:00am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'IronMountain': {
    type: 'Bootcamp',
    address: '75 Marjorie Ave, Middleton, ID 83644',
    schedule: {
      Monday: null,
      Tuesday: '5:30am - 6:15am',
      Wednesday: null,
      Thursday: '5:30am - 6:15am',
      Friday: null,
      Saturday: '6:00am - 7:00am',
    },
  },
  'OldGlory': {
    type: 'Bootcamp',
    address: '3064 W Malta Dr, Meridian, ID 83646',
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
    type: 'Speed/Strength training',
    address: '3801 E Hill Park Street, Meridian, ID 83642',
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
    address: '4403 S Surprise Way, Boise, ID 83716',
    schedule: {
      Monday: '5:15am - 6:00am',
      Tuesday: null,
      Wednesday: '5:15am - 6:00am',
      Thursday: null,
      Friday: null,
      Saturday: null,
    },
  },
  'RuckershipEast': {
    type: 'Ruck - location changes every week',
    address: null,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: null,
      Thursday: null,
      Friday: '5:30am - 6:30am',
      Saturday: null,
    },
  },
  'RuckershipWest': {
    type: 'Ruck - location changes every week',
    address: null,
    schedule: {
      Monday: null,
      Tuesday: null,
      Wednesday: null,
      Thursday: null,
      Friday: '5:30am - 6:30am',
      Saturday: null,
    },
  },
  'WarHorse': {
    type: 'Bootcamp',
    address: '1304 7th St N, Nampa, ID 83687',
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
  address: string;
  schedule: string[];
}

@Component({
  selector: 'app-workouts',
  templateUrl: './workouts.page.html',
  styleUrls: ['./workouts.page.scss'],
})
export class WorkoutsPage {
  aos: Ao[] = [];

  constructor(
      public readonly backblastService: BackblastService,
      private readonly router: Router,
  ) {
    this.setAos();
  }

  async setAos() {
    const aos = new Set<string>();

    const data = await this.backblastService.getAllData();
    data.forEach(bb => {
      aos.add(bb.ao);
    });

    this.aos = Array.from(aos)
                   .sort((a, b) => a.localeCompare(b))
                   .map(name => {
                     const ao = (AO_DEETS as any)[name];

                     const schedule =
                         Object.entries(ao.schedule)
                             .map(([day, time]) => `${day}: ${time}`)
                             .filter(item => !item.includes('null'));

                     const details =
                         {name, type: ao.type, address: ao.address, schedule};

                     return details;
                   })
                   .filter(ao => ao.type);
  }
}
