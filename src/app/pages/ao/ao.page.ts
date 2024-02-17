import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';
import {AoPaxStats, Backblast, BBType} from 'types';

interface AoStats {
  totalUniqueQs: number;      // count of unique qs
  totalUniquePax: number;     // count of unique pax
  totalBeatdowns: number;     // count of total beatdowns at this AO
  totalPosts: number;         // total of all beatdowns * participants
  averageAttendance: number;  // total posts / total beatdowns
}

const LIMIT = 10;

enum TimeRange {
  ALL_TIME = 'All Time',
  DAYS_90 = '90 Days',
  DAYS_30 = '30 Days',
}

@Component({
  selector: 'app-ao',
  templateUrl: './ao.page.html',
  styleUrls: ['./ao.page.scss'],
})
export class AoPage {
  name: string;
  displayName: string;
  limit = LIMIT;

  thisMonth = moment().format('MMMM');
  thisYear = moment().format('YYYY');
  timeRanges = [...Object.values(TimeRange), this.thisMonth];
  selectedRange = this.timeRanges[0];

  aoStats?: AoStats;
  paxStats?: AoPaxStats[];

  leaderboard: AoPaxStats[] = [];
  topQs: AoPaxStats[] = [];
  bottomQs: AoPaxStats[] = [];
  noQs: AoPaxStats[] = [];

  showMoreLeaderboard = false;
  showMoreTop = false;
  showMoreBottom = false;
  showMoreNoQs = false;
  bbType: BBType;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
    this.displayName = this.utilService.normalizeName(this.name);
    this.bbType =
        location.href.includes('/dd/') ? BBType.DOUBLEDOWN : BBType.BACKBLAST;
  }

  ionViewDidEnter() {
    this.calculateStats(this.selectedRange);
  }

  get bbShort(): string {
    return this.bbType === BBType.BACKBLAST ? 'BD' : 'DD';
  }

  get bbSingular(): string {
    return this.bbType === BBType.BACKBLAST ? 'beatdown' : 'double down';
  }

  get bbPlural(): string {
    return this.bbType === BBType.BACKBLAST ? 'beatdowns' : 'double downs';
  }

  goToPaxPage(name: string) {
    localStorage.setItem('BBTYPE', this.bbType);
    this.router.navigateByUrl(`/pax/${name}`);
  }

  async calculateStats(range: string) {
    // reset the data if the range changed
    if (range !== this.selectedRange) {
      this.reset();
    }
    this.selectedRange = range as TimeRange;

    const allData = this.name === 'all' ?
        await this.backblastService.getAllData(this.bbType) :
        await this.backblastService.getBackblastsForAo(this.name, this.bbType);

    // sort the data by date ascending
    const data: Backblast[] = [];
    const now = moment();
    for (const backblast of allData) {
      // handle filtering down the days
      if (range !== TimeRange.ALL_TIME) {
        const days = now.diff(moment(backblast.date), 'days');
        switch (range) {
          case TimeRange.DAYS_30:
            if (days > 30) continue;
            break;
          case (TimeRange.DAYS_90):
            if (days > 90) continue;
            break;
          default:
            // the last case is this month, filter to just this month
            const thisMoment = moment(backblast.date);
            const month = thisMoment.format('MMMM');
            const year = thisMoment.format('YYYY');
            if (month !== this.thisMonth || year !== this.thisYear) {
              continue;
            }
        }
      }
      data.unshift(backblast);
    }

    const statsMap = new Map<string, AoPaxStats>();
    const uniqueQs = new Set<string>();
    const uniquePax = new Set<string>();
    const aoStats = this.newAoStats();

    for (const backblast of data) {
      // update AO stats for this beatdown
      aoStats.totalBeatdowns++;
      aoStats.totalPosts += backblast.pax.length;

      for (const name of backblast.pax) {
        // update this HIM's stats
        const stats = statsMap.get(name) ?? this.newPaxStats(name, backblast);
        stats.lastBdDate = backblast.date;
        stats.bds++;

        // save their Q stats as well if applicable
        if (backblast.qs.includes(name)) {
          uniqueQs.add(name);
          stats.qs++;
          stats.lastQDate = backblast.date;

          if (!stats.firstQDate) {
            stats.firstQDate = backblast.date;
          }
        }
        stats.qRate = stats.qs / stats.bds;
        statsMap.set(name, stats);
        uniquePax.add(name);
      }
    }

    // update aggregate AO stats
    aoStats.totalUniqueQs = uniqueQs.size;
    aoStats.totalUniquePax = uniquePax.size;
    aoStats.averageAttendance = aoStats.totalPosts / aoStats.totalBeatdowns;

    // spin off some other stats
    this.aoStats = aoStats;
    this.paxStats = Array.from(statsMap.values());
    this.calculatePaxBdsPerWeek();
    this.calculateQsCards();
  }

  calculatePaxBdsPerWeek() {
    this.paxStats?.forEach(stats => {
      // calculate bds per week
      if (stats.firstBdDate === stats.lastBdDate) {
        stats.bdsPerWeek = 1;
      } else {
        const comparisonMoment = moment(stats.firstBdDate);
        const days = moment(stats.lastBdDate).diff(comparisonMoment, 'days');
        stats.bdsPerWeek = (stats.bds / days) * 7;
      }
    });
  }

  calculateQsCards() {
    const noQs = [];
    const hasQd = [];
    for (const pax of this.paxStats ?? []) {
      if (pax.qs > 0) {
        hasQd.push(pax);
      } else {
        noQs.push(pax);
      }
    }

    // sort and set stats
    hasQd.sort((a, b) => a.qRate - b.qRate);
    this.noQs = noQs.sort((a, b) => b.bds - a.bds);
    this.bottomQs = [...hasQd];
    this.topQs = [...hasQd].reverse();

    // leaderboard is sorted by highest # of bds attended, with tie breaks on
    // the highest bds per week
    this.leaderboard = [...noQs, ...hasQd].sort((a, b) => {
      if (b.bds === a.bds) {
        return b.bdsPerWeek - a.bdsPerWeek;
      } else {
        return b.bds - a.bds
      }
    });
  }

  private reset() {
    delete this.aoStats;
    delete this.paxStats;

    this.leaderboard = [];
    this.topQs = [];
    this.bottomQs = [];
    this.noQs = [];

    this.showMoreLeaderboard = false;
    this.showMoreTop = false;
    this.showMoreBottom = false;
    this.showMoreNoQs = false;
  }

  private newAoStats(): AoStats {
    return {
      totalUniqueQs: 0,
      totalBeatdowns: 0,
      totalPosts: 0,
      totalUniquePax: 0,
      averageAttendance: 0,
    };
  }

  private newPaxStats(name: string, backblast: Backblast): AoPaxStats {
    return {
      name,
      bds: 0,
      qs: 0,
      qRate: 0,
      bdsPerWeek: 0,
      firstBdDate: backblast.date,
      lastBdDate: backblast.date,
    };
  }
}
