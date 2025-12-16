import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {DateRange} from 'src/app/components/date-range-picker/date-range-picker.component';
import {AuthService} from 'src/app/services/auth.service';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
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

  recentBds?: Backblast[];

  // Precomputed properties instead of getters
  all = false;
  bbShort = '';
  bbSingular = '';
  bbPlural = '';

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
    this.bbType =
        location.href.includes('/dd/') ? BBType.DOUBLEDOWN : BBType.BACKBLAST;
    this.updateBBProperties();
    this.all = this.name === 'all';
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

    if (allData.length === 0) {
      return;
    }

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

    // sort and set stats
    hasQd.sort((a, b) => a.qs - b.qs);
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
