import {Component, OnDestroy, OnInit} from '@angular/core';
import * as moment from 'moment';
import {Subscription} from 'rxjs';
import {CurrentPaxService, MyAo} from 'src/app/services/current-pax.service';
import {UpcomingBd, UpcomingBdService} from 'src/app/services/upcoming-bd.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax} from 'types';

import {CANYON_AOS, CITY_OF_TREES_AOS, HIGH_DESERT_AOS, SETTLERS_AOS} from '../../../../constants';

interface TomorrowBd extends UpcomingBd {
  region: string;
}

interface TomorrowGroup {
  title: string;
  subtitle: string;
  route: string|null;
  bds: TomorrowBd[];
}

const REGIONS: Array<{name: string, route: string, aos: Set<string>}> = [
  {name: 'City of Trees', route: '/region/city-of-trees', aos: CITY_OF_TREES_AOS},
  {name: 'High Desert', route: '/region/high-desert', aos: HIGH_DESERT_AOS},
  {name: 'Settlers', route: '/region/settlers', aos: SETTLERS_AOS},
  {name: 'Canyon', route: '/region/canyon', aos: CANYON_AOS},
];

/**
 * Every beatdown happening tomorrow, grouped by region, with the Q named or
 * the slot flagged as open. When the viewer is a linked PAX, their AOs come
 * first.
 */
@Component({
  selector: 'app-tomorrow',
  templateUrl: './tomorrow.page.html',
  styleUrls: ['./tomorrow.page.scss'],
})
export class TomorrowPage implements OnInit, OnDestroy {
  loaded = false;
  tomorrowLabel = moment().add(1, 'day').format('dddd, MMMM D');
  groups: TomorrowGroup[] = [];
  openCount = 0;

  private all: TomorrowBd[] = [];
  private myAos: MyAo[] = [];
  private paxSubscription?: Subscription;

  constructor(
      public readonly utilService: UtilService,
      private readonly upcomingBdService: UpcomingBdService,
      private readonly currentPaxService: CurrentPaxService,
  ) {}

  ngOnInit() {
    this.paxSubscription =
        this.currentPaxService.pax$.subscribe(async (pax: Pax|undefined) => {
          this.myAos = pax ? await this.currentPaxService.getMyAos(pax.name) :
                             [];
          this.buildGroups();
        });
  }

  ngOnDestroy() {
    this.paxSubscription?.unsubscribe();
  }

  async ionViewDidEnter() {
    const tomorrow = await this.upcomingBdService.getTomorrow();
    this.all = tomorrow.bds.map(bd => this.toBd(bd));
    this.openCount = this.all.filter(bd => !bd.q).length;
    this.buildGroups();
    this.loaded = true;

    // HCs hit the network, so fill them in after the list is up
    await this.upcomingBdService.fillHcs(this.all);
    // the region subtitles count HCs, so refresh them
    this.buildGroups();
  }

  private toBd(bd: UpcomingBd): TomorrowBd {
    const region = REGIONS.find(r => r.aos.has(bd.route));
    return {...bd, region: region?.name ?? 'Other'};
  }

  private buildGroups() {
    const groups: TomorrowGroup[] = [];

    if (this.myAos.length > 0) {
      const mine = new Set(this.myAos.map(ao => ao.name));
      const bds = this.all.filter(
          bd => mine.has(this.utilService.normalizeName(bd.ao).toLowerCase()));
      if (bds.length > 0) {
        groups.push({
          title: 'At your AOs',
          subtitle: 'Where you post most',
          route: null,
          bds,
        });
      }
    }

    for (const region of REGIONS) {
      const bds = this.all.filter(bd => bd.region === region.name);
      if (bds.length > 0) {
        groups.push({
          title: region.name,
          subtitle: this.groupSubtitle(bds),
          route: region.route,
          bds,
        });
      }
    }

    const other = this.all.filter(bd => bd.region === 'Other');
    if (other.length > 0) {
      groups.push({
        title: 'Elsewhere',
        subtitle: this.groupSubtitle(other),
        route: null,
        bds: other,
      });
    }

    this.groups = groups;
  }

  /** "3 beatdowns · 7 HCs": how much of the region is already committed. */
  private groupSubtitle(bds: TomorrowBd[]): string {
    const count = bds.length;
    const hcs = bds.reduce((sum, bd) => sum + this.committedCount(bd), 0);
    const parts = [`${count} beatdown${count === 1 ? '' : 's'}`];
    if (hcs > 0) parts.push(`${hcs} HC${hcs === 1 ? '' : 's'}`);
    return parts.join(' \u00b7 ');
  }

  /** The Q plus everyone who HC'd, the same count the pill under each shows. */
  private committedCount(bd: TomorrowBd): number {
    const q = bd.q?.trim().toLowerCase();
    const others = bd.hcs.filter(name => name.toLowerCase() !== q).length;
    return (q ? 1 : 0) + others;
  }
}
