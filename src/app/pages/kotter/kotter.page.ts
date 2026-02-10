import {Component, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {IonInfiniteScroll} from '@ionic/angular';
import * as moment from 'moment';
import {CANYON_AOS, CITY_OF_TREES_AOS, HIGH_DESERT_AOS, REGION, SETTLERS_AOS} from '../../../../constants';
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
  /** Post count per AO (normalized AO name -> count) */
  aoPostCounts: Map<string, number>;
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
  @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll|undefined;

  name: string;
  displayName: string;
  isRegion: boolean;

  sort = Sort.TIME;
  // Full sorted list; used for infinite scroll source and total count
  inactivePax?: PaxStats[];
  // Slice of inactivePax actually rendered for performance
  displayedPax: PaxStats[] = [];

  readonly pageSize = 25;
  private currentIndex = 0;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
    this.displayName = this.utilService.normalizeName(this.name);
    this.isRegion = Object.values(REGION).includes(this.name as REGION);
  }

  ionViewDidEnter() {
    this.calculateStats();
  }

  get explanation(): string {
    return this.name === 'all' ?
        `Showing all PAX that haven't posted in the last two weeks` :
        this.isRegion ?
        `Showing PAX for whom ${
            this.displayName} is their top region, who haven't posted anywhere in the past two weeks.` :
        `Showing PAX who have ${this.displayName} in their top 3 AOs, who haven't posted anywhere in the past two weeks.`;
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
    this.resetAndLoad();
  }

  private resetAndLoad() {
    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
    this.displayedPax = [];
    this.currentIndex = 0;
    this.loadNextChunk();
  }

  private loadNextChunk() {
    if (!this.inactivePax) return;
    const nextChunk = this.inactivePax.slice(
        this.currentIndex, this.currentIndex + this.pageSize);
    this.displayedPax = [...this.displayedPax, ...nextChunk];
    this.currentIndex += this.pageSize;
  }

  loadMore(event: any) {
    this.loadNextChunk();
    event.target.complete();
    if (this.inactivePax && this.currentIndex >= this.inactivePax.length) {
      event.target.disabled = true;
    }
  }

  async calculateStats() {
    const allData = await this.backblastService.getAllData();

    // the key of this map is the PAX's name
    // the value is a map where each key points to a number of shared BDs
    const buddyMap = new Map<string, Map<string, number>>();
    const paxMap = new Map<string, PaxStats>();

    for (const backblast of allData) {
      const normalizedAo = this.utilService.normalizeName(backblast.ao);
      for (const name of backblast.pax) {
        // the list is sorted by most recent, so pax stats are creted from your
        // most recent bd
        const paxStats = paxMap.get(name) ?? this.newPaxStats(name, backblast);
        paxStats.visitedAos.add(normalizedAo);
        const aoCount = paxStats.aoPostCounts.get(normalizedAo) ?? 0;
        paxStats.aoPostCounts.set(normalizedAo, aoCount + 1);
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

    const regionAos = this.getRegionAos();
    const inactivePax: PaxStats[] = [];
    for (const [name, pax] of Array.from(paxMap)) {
      // don't add pax to the list that have posted in the last 2 weeks
      if (pax.daysAgo < 14) continue;

      // filter by AO/region context: 'all' shows everyone; AO must be in top 3;
      // region must be PAX's top region
      if (!this.qualifiesForContext(pax, regionAos)) continue;

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

  private getRegionAos(): Set<string>|null {
    if (!this.isRegion) return null;
    let aos: Set<string>;
    switch (this.name) {
      case REGION.CITY_OF_TREES:
        aos = CITY_OF_TREES_AOS;
        break;
      case REGION.HIGH_DESERT:
        aos = HIGH_DESERT_AOS;
        break;
      case REGION.SETTLERS:
        aos = SETTLERS_AOS;
        break;
      case REGION.CANYON:
        aos = CANYON_AOS;
        break;
      default:
        return null;
    }
    return new Set([...aos].map(ao => this.utilService.normalizeName(ao)));
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
      aoPostCounts: new Map<string, number>(),
    };
  }

  private getRegionForAO(aoName: string): string|null {
    const normalizedAO = aoName.toLowerCase().trim();
    if (CITY_OF_TREES_AOS.has(normalizedAO)) return REGION.CITY_OF_TREES;
    if (HIGH_DESERT_AOS.has(normalizedAO)) return REGION.HIGH_DESERT;
    if (SETTLERS_AOS.has(normalizedAO)) return REGION.SETTLERS;
    if (CANYON_AOS.has(normalizedAO)) return REGION.CANYON;
    return null;
  }

  /**
   * Returns true if this PAX qualifies for the current AO/region context.
   * - 'all': everyone qualifies
   * - AO: this AO is in the PAX's top 3 AOs by post count
   * - region: this region is the PAX's top region by post count
   */
  private qualifiesForContext(pax: PaxStats, regionAos: Set<string>|null): boolean {
    if (this.name === 'all') return true;

    if (regionAos !== null) {
      // Region context: must be PAX's top region
      const regionPostCounts = new Map<string, number>();
      for (const [ao, count] of pax.aoPostCounts) {
        const region = this.getRegionForAO(ao);
        if (region) {
          regionPostCounts.set(region, (regionPostCounts.get(region) ?? 0) + count);
        }
      }
      const sortedRegions = [...regionPostCounts.entries()]
          .sort((a, b) => b[1] - a[1]);
      const topRegion = sortedRegions[0]?.[0];
      return topRegion === this.name;
    } else {
      // AO context: must be in PAX's top 3 AOs
      const targetAo = this.utilService.normalizeName(this.name);
      if (!pax.visitedAos.has(targetAo)) return false;
      const sortedAos = [...pax.aoPostCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
      return sortedAos.some(([ao]) => ao === targetAo);
    }
  }
}
