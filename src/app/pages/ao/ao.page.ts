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

interface MonthlyStats {
  // the display name of this month like January 2021
  displayName: string;

  // PAX that posted at least once this month
  allPax: Set<string>;

  qs: Set<string>;

  // new guys to the region, showing up for the first time
  fngs: Set<string>;

  // PAX that were missing last month that came back this month
  returnedPax: Set<string>;

  // PAX that were present last month but didn't post this month
  missingPax: Set<string>;

  // The total number of posts for the month
  totalPosts: number;
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

  timeRanges = Object.values(TimeRange)
  selectedRange = this.timeRanges[0];

  aoStats?: AoStats;
  paxStats?: AoPaxStats[];
  monthlyStats?: MonthlyStats[];

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

  get showMonthlyStats(): boolean {
    return false;  // this.displayName === 'All' && this.selectedRange ===
                   // TimeRange.ALL_TIME;
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
        if (range === TimeRange.DAYS_30 && days > 30) continue;
        if (range === TimeRange.DAYS_90 && days > 90) continue;
      }
      data.unshift(backblast);
    }

    const statsMap = new Map<string, AoPaxStats>();
    const uniqueQs = new Set<string>();
    const uniquePax = new Set<string>();
    const monthlyStats = new Map<string, MonthlyStats>();
    const aoStats = this.newAoStats();

    for (const backblast of data) {
      const month = moment(backblast.date).format('MMMM YYYY');
      const monthStats = monthlyStats.get(month) ?? this.newMonthlyStats(month);

      // update AO stats for this beatdown
      aoStats.totalBeatdowns++;
      aoStats.totalPosts += backblast.pax.length;

      // update the monthly stats as well
      monthStats.totalPosts += backblast.pax.length;

      for (const name of backblast.pax) {
        // keep track of all PAX and new FNGs
        monthStats.allPax.add(name);
        if (!uniquePax.has(name)) {
          monthStats.fngs.add(name);
        }

        // update this HIM's stats
        const stats = statsMap.get(name) ?? this.newPaxStats(name, backblast);
        stats.lastBdDate = backblast.date;
        stats.bds++;

        // save their Q stats as well if applicable
        if (backblast.qs.includes(name)) {
          uniqueQs.add(name);
          monthStats.qs.add(name);
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

      monthlyStats.set(month, monthStats);
    }

    let lastMonth: MonthlyStats;
    monthlyStats.forEach(thisMonth => {
      if (lastMonth) {
        // store the PAX that posted last month but didn't post this month
        thisMonth.missingPax = new Set([...lastMonth.allPax.values()].filter(
            name => !thisMonth.allPax.has(name)));
        // store the non-FNG PAX that came back and posted this month
        thisMonth.returnedPax = new Set([...thisMonth.allPax.values()].filter(
            name => !thisMonth.fngs.has(name) && !lastMonth.allPax.has(name)));
      }
      lastMonth = thisMonth;
    });

    // update aggregate AO stats
    aoStats.totalUniqueQs = uniqueQs.size;
    aoStats.totalUniquePax = uniquePax.size;
    aoStats.averageAttendance = aoStats.totalPosts / aoStats.totalBeatdowns;

    // spin off some other stats
    this.aoStats = aoStats;
    this.paxStats = Array.from(statsMap.values());
    this.monthlyStats = Array.from(monthlyStats.values()).reverse();
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

  copyMonthCard(index: number) {
    const thisMonth = this.monthlyStats![index];
    const prevMonth = this.monthlyStats![index + 1];
    const [thisName] = thisMonth.displayName.split(' ');
    const [prevName] = prevMonth.displayName.split(' ');

    let string = `We had ${thisMonth.allPax.size} PAX in ${thisName}, ${
        thisMonth.qs.size} of which Qd at least one BD, and we had ${
        thisMonth.returnedPax.size} PAX come back out in ${
        thisName} that didn't post in ${prevName}!\n\n`;

    const fngs =
        Array.from(thisMonth.fngs.values()).map(this.utilService.normalizeName);
    string += `We had ${fngs.length} FNGs in ${
        thisName}! If you met one of these HIMs, keep encouraging them to come out and push them towards joining slack as we see more stickiness that way!\n${
        fngs.join('\n')}\n\n`;

    const missing = Array.from(thisMonth.missingPax.values())
                        .map(this.utilService.normalizeName);
    string += `We had ${missing.length} PAX drop off in ${
        thisName} that came out at least once in ${
        prevName}. If you know one of the HIMs below, maybe give em a shout to encourage them to come join us in the gloom again:\n${
        missing.join('\n')}`;

    this.utilService.copyToClipboard(
        string, 'Copied the deails to the clipboard');
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

  private newMonthlyStats(displayName: string): MonthlyStats {
    return {
      displayName,
      allPax: new Set<string>(),
      qs: new Set<string>(),
      fngs: new Set<string>(),
      returnedPax: new Set<string>(),
      missingPax: new Set<string>(),
      totalPosts: 0,
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
