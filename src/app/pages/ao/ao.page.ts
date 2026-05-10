import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {DateRange} from 'src/app/components/date-range-picker/date-range-picker.component';
import {DayOfWeekRow} from 'src/app/components/day-of-week-heatmap/day-of-week-heatmap.component';
import {QDepthRow} from 'src/app/components/q-depth-chart/q-depth-chart.component';
import {AuthService} from 'src/app/services/auth.service';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {AoPaxStats, Backblast, BBType} from 'types';

import {REGION_AGNOSTIC_AOS} from '../../../../constants';

interface AoStats {
  totalUniqueQs: number;      // count of unique qs
  totalUniquePax: number;     // count of unique pax
  totalBeatdowns: number;     // count of total beatdowns at this AO
  totalPosts: number;         // total of all beatdowns * participants
  averageAttendance: number;  // total posts / total beatdowns
}

const LIMIT = 10;

/** Charts at the top of the page always reflect this lookback. */
const TRAILING_DAYS = 90;

/**
 * "Regular attender" — posted ≥ this fraction of the AO's workouts in the
 * trailing window (e.g. 1/3 ⇒ shows up at least a third of the time).
 */
const REGULAR_ATTEND_FRACTION = 1 / 3;
/**
 * "Regular Q" — led ≥ this fraction of their fair-share Qs at this AO,
 * where fair-share = workouts / # of regular attenders.
 *
 * 1/2 means "led at least half what they'd lead if everyone Q'd equally".
 */
const REGULAR_Q_FAIR_SHARE_FRACTION = 1 / 2;

@Component({
  selector: 'app-ao',
  templateUrl: './ao.page.html',
  styleUrls: ['./ao.page.scss'],
})
export class AoPage {
  name: string;
  displayName: string;
  limit = LIMIT;

  selectedRange: DateRange = {startDate: null, endDate: null};

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

  // Toggle states for leaderboard views
  leaderboardViewByBdsPerWeek =
      false;                      // false = Total BDs, true = BDs per week
  topQsViewByPercentage = false;  // false = Total BDs (Qd), true = Percentage
  bottomQsViewByPercentage =
      false;                 // false = Total BDs (Qd), true = Percentage
  noQsViewByLastBd = false;  // false = Total BDs, true = Last BD

  recentBds?: Backblast[];

  // Trailing-90-day region/AO snapshot — independent of the date range picker
  qDepthRows: QDepthRow[] = [];
  dowRows: DayOfWeekRow[] = [];
  // Precomputed properties instead of getters
  all = false;
  bbShort = '';
  bbSingular = '';
  bbPlural = '';
  isRegion = false;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly authService: AuthService,
      private readonly toastController: ToastController,
  ) {
    this.name = this.route.snapshot.params['name'];
    this.displayName = this.utilService.normalizeName(this.name);
    this.bbType = window.location.href.includes('/dd/') ? BBType.DOUBLEDOWN :
                                                          BBType.BACKBLAST;
    this.updateBBProperties();
    this.all = this.name === 'all';
    this.isRegion = window.location.href.includes('/region/');
  }

  get kotterRoute(): string {
    return this.isRegion ? `/region/${this.name}/kotter` : `/ao/${this.name}/kotter`;
  }

  private updateBBProperties() {
    this.bbShort = this.bbType === BBType.BACKBLAST ? 'BD' : 'DD';
    this.bbSingular =
        this.bbType === BBType.BACKBLAST ? 'beatdown' : 'double down';
    this.bbPlural =
        this.bbType === BBType.BACKBLAST ? 'beatdowns' : 'double downs';
  }

  async ionViewDidEnter() {
    // Check if this is an email link sign-in
    await this.handleEmailLinkSignIn();
    this.calculateStats(this.selectedRange);
  }

  private async handleEmailLinkSignIn() {
    if (this.authService.isSignInWithEmailLink()) {
      try {
        await this.authService.signInWithEmailLink();
        const toast = await this.toastController.create({
          message: 'Successfully signed in!',
          duration: 3000,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        // Clean up the URL by removing the query parameters
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      } catch (error: any) {
        const toast = await this.toastController.create({
          message: error.message || 'Failed to sign in. Please try again.',
          duration: 5000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      }
    }
  }

  onDateRangeChange(range: DateRange) {
    this.selectedRange = range;
    this.calculateStats(range);
  }

  goToPaxPage(name: string) {
    localStorage.setItem('BBTYPE', this.bbType);
    this.router.navigateByUrl(`/pax/${name}`);
  }

  async calculateStats(range: DateRange) {
    // reset the data if the range changed
    const rangeChanged = range.startDate !== this.selectedRange.startDate ||
        range.endDate !== this.selectedRange.endDate;
    if (rangeChanged) {
      this.reset();
    }

    const allData = this.all ?
        await this.backblastService.getAllData(this.bbType) :
        await this.backblastService.getBackblastsForAo(this.name, this.bbType);

    // sort the data by date ascending
    const data: Backblast[] = [];
    for (const backblast of allData) {
      // handle filtering by date range
      if (range.startDate || range.endDate) {
        const backblastDate = moment(backblast.date);

        if (range.startDate) {
          const startDate = moment(range.startDate);
          if (backblastDate.isBefore(startDate, 'day')) {
            continue;
          }
        }

        if (range.endDate) {
          const endDate = moment(range.endDate);
          if (backblastDate.isAfter(endDate, 'day')) {
            continue;
          }
        }
      }
      data.unshift(backblast);
    }

    // If there's no data after filtering, set empty stats and return
    if (data.length === 0) {
      this.aoStats = this.newAoStats();
      this.paxStats = [];
      this.leaderboard = [];
      this.topQs = [];
      this.bottomQs = [];
      this.noQs = [];
      this.recentBds = [];
      // Snapshot charts use the unfiltered allData (trailing 90 days), so
      // they may still render even when the picked range is empty.
      this.computeTrailingSnapshots(allData);
      return;
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
        stats.parent = await this.paxService.getParent(name);
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
    const paxStatsArray = Array.from(statsMap.values());
    this.paxStats = location.href.includes('?parentless') ?
        paxStatsArray.filter(pax => !pax.parent) :
        paxStatsArray;
    this.calculatePaxBdsPerWeek();
    this.calculateQsCards();

    // after everything renders, then set recent BDs for the grid
    setTimeout(() => {
      this.recentBds = allData.slice(0, 20);
    }, 500);

    // Charts always show trailing-90-day snapshot, independent of the date
    // range picker (subtitle is fixed as "trailing 90 days").
    this.computeTrailingSnapshots(allData);
  }

  /**
   * Computes the Q-depth and day-of-week aggregates over the trailing 90 days
   * for whatever AOs are scoped to this page (region, single AO, or all).
   */
  private computeTrailingSnapshots(allData: Backblast[]): void {
    const cutoff = moment().subtract(TRAILING_DAYS, 'days').startOf('day');
    const recent =
        allData.filter(bb => moment(bb.date).isSameOrAfter(cutoff, 'day'));

    interface PerAo {
      bdsCount: number;
      // pax name → posts/Qs at this AO in window
      pax: Map<string, {posts: number; qs: number}>;
      // dayIndex 0..6 → {paxSum, bdsCount}
      dowSum: Array<{paxSum: number; bds: number}>;
    }

    const byAo = new Map<string, PerAo>();

    // Region-agnostic AOs (e.g. Black Ops) are excluded from per-AO charts
    // when the page scope is broader than a single AO — they would skew the
    // comparison. On a single-AO page we keep the AO's own data.
    const filterAgnostic = this.all || this.isRegion;

    for (const bb of recent) {
      if (filterAgnostic && REGION_AGNOSTIC_AOS.has(bb.ao.toLowerCase())) {
        continue;
      }
      const aoKey = this.utilService.normalizeName(bb.ao);
      let entry = byAo.get(aoKey);
      if (!entry) {
        entry = {
          bdsCount: 0,
          pax: new Map(),
          dowSum: Array.from({length: 7}, () => ({paxSum: 0, bds: 0})),
        };
        byAo.set(aoKey, entry);
      }
      entry.bdsCount++;
      const qSet = new Set(bb.qs ?? []);
      for (const name of bb.pax ?? []) {
        const stat = entry.pax.get(name) ?? {posts: 0, qs: 0};
        stat.posts++;
        if (qSet.has(name)) stat.qs++;
        entry.pax.set(name, stat);
      }
      const dow = moment(bb.date).day();  // 0..6 (Sun..Sat)
      entry.dowSum[dow].paxSum += (bb.pax ?? []).length;
      entry.dowSum[dow].bds++;
    }

    const qDepth: QDepthRow[] = [];
    const dow: DayOfWeekRow[] = [];

    for (const [ao, entry] of byAo) {
      if (entry.bdsCount === 0) continue;
      const W = entry.bdsCount;

      // Pass 1: AO-relative "regular attender" threshold.
      const regularPostsCutoff = Math.max(1, Math.ceil(W * REGULAR_ATTEND_FRACTION));
      const regulars: Array<{posts: number; qs: number}> = [];
      for (const stat of entry.pax.values()) {
        if (stat.posts >= regularPostsCutoff) regulars.push(stat);
      }

      // Pass 2: "regular Q" cutoff = ceil(fairShare * fraction).
      // Fair share = workouts / number of regulars. Floor of 1 — even at
      // very low fair share, a regular Q must have led at least once.
      const regularsCount = regulars.length;
      const fairShare = regularsCount > 0 ? W / regularsCount : 0;
      const regularQsCutoff =
          Math.max(1, Math.ceil(fairShare * REGULAR_Q_FAIR_SHARE_FRACTION));
      const regularQsCount = regulars.filter(r => r.qs >= regularQsCutoff).length;

      const rate = regularsCount > 0 ? regularQsCount / regularsCount : 0;

      qDepth.push({
        ao,
        regularAttenders: regularsCount,
        regularQs: regularQsCount,
        rate,
      });
      dow.push({
        ao,
        averages: entry.dowSum.map(
            d => (d.bds > 0 ? d.paxSum / d.bds : null)),
      });
    }

    this.qDepthRows = qDepth;
    this.dowRows = dow;
  }

  calculatePaxBdsPerWeek() {
    this.paxStats?.forEach(stats => {
      // calculate bds per week
      if (stats.firstBdDate === stats.lastBdDate) {
        stats.bdsPerWeek = 1;
      } else {
        const startMoment = moment(stats.firstBdDate);
        const days = moment(stats.lastBdDate).diff(startMoment, 'days') + 1;

        // ceiling the days / 7 to get the number of weeks in the range
        // if we don't do this, the bds divided by the duration can make it look
        // like the PAX were able to attend more BDs that were offered
        // i.e. if you attend Tue/Thu that's 2 beatdowns in 3 days, we should
        // show 2 BDs per week and not extrapolate the daily BD rate to the
        // whole week making it (2/3)*7 -> 4.66
        stats.bdsPerWeek = stats.bds / Math.ceil(days / 7);
      }
    });
  }

  calculateQsCards() {
    const noQs: AoPaxStats[] = [];
    const hasQd = [];
    for (const pax of this.paxStats ?? []) {
      if (pax.qs > 0) {
        hasQd.push(pax);
      } else {
        // Precompute relative date for noQs items
        const paxWithDate: AoPaxStats = {
          ...pax,
          lastBdRelativeDate: pax.lastBdDate ?
              this.utilService.getRelativeDate(pax.lastBdDate) :
              undefined,
        };
        noQs.push(paxWithDate);
      }
    }

    // Sort noQs based on toggle state with fallback sorting
    if (this.noQsViewByLastBd) {
      // Sort by last BD date (most recent first), fallback to total BDs
      this.noQs = noQs.sort((a, b) => {
        if (!a.lastBdDate && !b.lastBdDate) {
          return b.bds - a.bds;  // Fallback to BDs
        }
        if (!a.lastBdDate) return 1;
        if (!b.lastBdDate) return -1;
        const dateDiff =
            moment(b.lastBdDate).valueOf() - moment(a.lastBdDate).valueOf();
        if (dateDiff === 0) {
          return b.bds - a.bds;  // Same date, fallback to BDs
        }
        return dateDiff;
      });
    } else {
      // Sort by total BDs (default), fallback to last BD date
      this.noQs = noQs.sort((a, b) => {
        if (b.bds === a.bds) {
          // Same BDs, fallback to most recent last BD
          if (!a.lastBdDate && !b.lastBdDate) return 0;
          if (!a.lastBdDate) return 1;
          if (!b.lastBdDate) return -1;
          return moment(b.lastBdDate).valueOf() -
              moment(a.lastBdDate).valueOf();
        }
        return b.bds - a.bds;
      });
    }

    // Sort Top Qs based on toggle state - always descending (highest first)
    if (this.topQsViewByPercentage) {
      // Sort by percentage descending, fallback to total Qs descending
      this.topQs = [...hasQd].sort((a, b) => {
        if (b.qRate === a.qRate) {
          return b.qs - a.qs;  // Same percentage, fallback to total Qs
        }
        return b.qRate - a.qRate;
      });
    } else {
      // Sort by total Qs descending, fallback to percentage descending
      this.topQs = [...hasQd].sort((a, b) => {
        if (b.qs === a.qs) {
          return b.qRate - a.qRate;  // Same Qs, fallback to percentage
        }
        return b.qs - a.qs;
      });
    }

    // Sort Bottom Qs based on toggle state - always ascending (lowest first)
    if (this.bottomQsViewByPercentage) {
      // Sort by percentage ascending, fallback to total Qs ascending
      this.bottomQs = [...hasQd].sort((a, b) => {
        if (a.qRate === b.qRate) {
          return a.qs - b.qs;  // Same percentage, fallback to total Qs
        }
        return a.qRate - b.qRate;
      });
    } else {
      // Sort by total Qs ascending, fallback to percentage ascending
      this.bottomQs = [...hasQd].sort((a, b) => {
        if (a.qs === b.qs) {
          return a.qRate - b.qRate;  // Same Qs, fallback to percentage
        }
        return a.qs - b.qs;
      });
    }

    // leaderboard is sorted by highest # of bds attended, with tie breaks on
    // the highest bds per week, or by bds per week if toggle is on
    if (this.leaderboardViewByBdsPerWeek) {
      this.leaderboard = [...noQs, ...hasQd].sort((a, b) => {
        if (b.bdsPerWeek === a.bdsPerWeek) {
          return b.bds - a.bds;
        } else {
          return b.bdsPerWeek - a.bdsPerWeek;
        }
      });
    } else {
      this.leaderboard = [...noQs, ...hasQd].sort((a, b) => {
        if (b.bds === a.bds) {
          return b.bdsPerWeek - a.bdsPerWeek;
        } else {
          return b.bds - a.bds;
        }
      });
    }
  }

  private reset() {
    delete this.aoStats;
    delete this.paxStats;

    this.leaderboard = [];
    this.topQs = [];
    this.bottomQs = [];
    this.noQs = [];
    this.qDepthRows = [];
    this.dowRows = [];

    this.showMoreLeaderboard = false;
    this.showMoreTop = false;
    this.showMoreBottom = false;
    this.showMoreNoQs = false;

    // Reset toggle states
    this.leaderboardViewByBdsPerWeek = false;
    this.topQsViewByPercentage = false;
    this.bottomQsViewByPercentage = false;
    this.noQsViewByLastBd = false;
  }

  toggleLeaderboardView() {
    this.leaderboardViewByBdsPerWeek = !this.leaderboardViewByBdsPerWeek;
    this.calculateQsCards();
  }

  toggleTopQsView() {
    this.topQsViewByPercentage = !this.topQsViewByPercentage;
    this.calculateQsCards();
  }

  toggleBottomQsView() {
    this.bottomQsViewByPercentage = !this.bottomQsViewByPercentage;
    this.calculateQsCards();
  }

  toggleNoQsView() {
    this.noQsViewByLastBd = !this.noQsViewByLastBd;
    this.calculateQsCards();
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
