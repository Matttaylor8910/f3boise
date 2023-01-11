import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast} from 'types';

interface PaxStats {
  name: string;
  daysAgo: number;
  lastBdDate: string;
  firstBdDate: string;
  totalPosts: number;
  lastAo: string;
  buddies: Buddy[];
  visitedAos: Set<string>;
}

interface Buddy {
  name: string;
  count: number;
}

enum Sort {
  TIME = 'Time',
  POSTS = 'Posts',
}

@Component({
  selector: 'app-kotter',
  templateUrl: './kotter.page.html',
  styleUrls: ['./kotter.page.scss'],
})
export class KotterPage {
  name: string;
  displayName: string;

  sort = Sort.TIME;
  inactivePax?: PaxStats[];

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
    this.displayName = this.utilService.normalizeName(this.name);
  }

  ionViewDidEnter() {
    this.calculateStats();
  }

  get explanation(): string {
    return this.name === 'all' ?
        `Showing all PAX that haven't posted in the last two weeks` :
        `Showing all PAX that have posted at least once at ${
            this.displayName} and haven't posted anywhere in the past two weeks.`;
  }

  toggleSort() {
    this.sort = this.sort === Sort.POSTS ? Sort.TIME : Sort.POSTS;
    this.handleSort(this.inactivePax ?? []);
  }

  handleSort(pax: PaxStats[]) {
    this.inactivePax = pax.sort((a, b) => {
      // handle sorting by days ago, asc
      if (this.sort === Sort.TIME && a.daysAgo !== b.daysAgo) {
        return a.daysAgo - b.daysAgo;
      }
      // handle sorting by # of posts, desc
      if (this.sort === Sort.POSTS && a.totalPosts !== b.totalPosts) {
        return b.totalPosts - a.totalPosts;
      }

      return a.name.localeCompare(b.name);
    });
  }

  async calculateStats() {
    const allData = await this.backblastService.getAllData();

    // the key of this map is the PAX's name
    // the value is a map where each key points to a number of shared BDs
    const buddyMap = new Map<string, Map<string, number>>();
    const paxMap = new Map<string, PaxStats>();

    for (const backblast of allData) {
      for (const name of backblast.pax) {
        // the list is sorted by most recent, so pax stats are creted from your
        // most recent bd
        const paxStats = paxMap.get(name) ?? this.newPaxStats(name, backblast);
        paxStats.visitedAos.add(this.utilService.normalizeName(backblast.ao));
        paxStats.firstBdDate = backblast.date;
        paxStats.totalPosts++;
        paxMap.set(name, paxStats);

        // calculate which guys have the most overlap with this pax in their
        // previous 6 months before their last beatdown
        const daysAgo =
            moment(paxStats.lastBdDate).diff(moment(backblast.date), 'days');
        if (daysAgo <= 183) {
          const counts = buddyMap.get(name) ?? new Map<string, number>();
          for (const buddy of backblast.pax) {
            if (buddy === name) continue;  // don't count yourself

            const count = counts.get(buddy) ?? 0;
            counts.set(buddy, count + 1);
          }
          buddyMap.set(name, counts);
        }
      }
    }

    const inactivePax: PaxStats[] = [];
    for (const [name, pax] of Array.from(paxMap)) {
      // don't add pax to the list that have posted in the last 2 weeks
      if (pax.daysAgo < 14) continue;

      // if we're not showing the report for all AOs, exclude pax that have
      // never visited this AO
      const normalized = this.utilService.normalizeName(this.name);
      if (normalized !== 'All' && !pax.visitedAos.has(normalized)) continue;

      const buddies = buddyMap.get(name) ?? new Map<string, number>();
      pax.buddies = Array.from(buddies)
                        .map(([buddy, count]) => {
                          return {name: buddy, count};
                        })
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3);

      inactivePax.push(pax);
    }

    this.handleSort(inactivePax);
  }

  private newPaxStats(name: string, backblast: Backblast): PaxStats {
    return {
      name,
      daysAgo: moment().diff(moment(backblast.date), 'days'),
      lastBdDate: backblast.date,
      firstBdDate: backblast.date,
      totalPosts: 0,
      lastAo: this.utilService.normalizeName(backblast.ao),
      buddies: [],
      visitedAos: new Set<string>(),
    };
  }
}
