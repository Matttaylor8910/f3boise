import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';
import {IBackblast} from 'types';

interface AoPaxStats {
  name: string;
  bds: number;
  qs: number;
  qRate: number;
  firstBdDate: string;
  lastBdDate: string;
  firstQDate?: string;
  lastQDate?: string;
}

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
  limit = LIMIT;

  aoStats?: AoStats;
  paxStats?: AoPaxStats[];

  topQs: AoPaxStats[] = [];
  bottomQs: AoPaxStats[] = [];
  noQs: AoPaxStats[] = [];

  showMoreTop = false;
  showMoreBottom = false;
  showMoreNoQs = false;

  constructor(
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
  }

  ionViewDidEnter() {
    this.calculateAoStats();
  }

  async calculateAoStats() {
    const data = this.name === 'all' ?
        await this.backblastService.loadAllData() :
        await this.backblastService.getBackblastsForAo(this.name);

    // sort the data by date ascending
    data.sort((a, b) => a.date.localeCompare(b.date));

    const statsMap = new Map<string, AoPaxStats>();
    const uniqueQs = new Set<string>();
    const uniquePax = new Set<string>();
    const aoStats = this.newAoStats();

    for (const backblast of data) {
      // update AO stats for this beatdown
      aoStats.totalBeatdowns++;
      aoStats.totalPosts += backblast.pax.length;

      // update this HIM's stats
      for (const name of backblast.pax) {
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
    this.calculateQsCards();
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

  private newPaxStats(name: string, backblast: IBackblast): AoPaxStats {
    return {
      name,
      bds: 0,
      qs: 0,
      qRate: 0,
      firstBdDate: backblast.date,
      lastBdDate: backblast.date,
    };
  }
}
