import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';

import {REGION} from '../../../../constants';

interface MonthlyStats {
  // the display name of this month like January 2021
  displayName: string;

  // PAX that posted at least once this month
  allPax: Set<string>;

  qs: Set<string>;

  // new guys to the region, showing up for the first time
  fngs: Set<string>;
  fngAoMap: Map<string, string[]>;
  fngsByAo: {name: string, fngs: string[]}[];
  breakdownFngsByAo: boolean;

  // PAX that were missing last month that came back this month
  returnedPax: Set<string>;

  // PAX that were present last month but didn't post this month
  missingPax: Set<string>;

  // The total number of posts for the month
  totalPosts: number;

  // The total number of posts for the month
  totalBeatdowns: number;

  // PAX that hit milestones this month, grouped by milestone
  milestonePax: {milestone: number, pax: string[], paxNames: string}[];

  // Total number of PAX who hit milestones this month
  totalMilestonePax: number;

  // VQ tracking
  vqs: {name: string, ao: string}[];
  totalVQs: number;
}

interface DateRangeStats {
  // PAX that posted at least once in this period
  allPax: Set<string>;
  qs: Set<string>;
  fngs: Set<string>;
  returnedPax: Set<string>;
  missingPax: Set<string>;
  totalPosts: number;
  totalBeatdowns: number;
  milestonePax: {milestone: number, pax: string[], paxNames: string}[];
  totalMilestonePax: number;
  vqs:
      {name: string,
       ao: string,
       normalizedName: string,
       normalizedAo: string}[];
  totalVQs: number;
  // Add normalized names for display
  normalizedFngs: string[];
  normalizedReturnedPax: string[];
  normalizedMissingPax: string[];
  fngsByAo: {name: string, fngs: string[]}[];
  breakdownFngsByAo: boolean;
}

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrls: ['./summary.page.scss'],
})
export class SummaryPage {
  ao: string;
  region: REGION;
  monthlyStats?: MonthlyStats[];
  dateRangeStats?: DateRangeStats;
  startDate?: string;
  endDate?: string;
  selectedTab: 'monthly'|'range' = 'monthly';
  tabs = [
    {label: 'Monthly Breakdown', value: 'monthly'},
    {label: 'Custom Range', value: 'range'}
  ];

  constructor(
      public readonly utilService: UtilService,
      private readonly backblastService: BackblastService,
      private readonly route: ActivatedRoute,
  ) {
    this.region = this.route.snapshot.queryParamMap.get('region') as REGION;
    this.ao = this.route.snapshot.queryParamMap.get('ao') as string;
    this.startDate =
        this.route.snapshot.queryParamMap.get('startDate') ?? undefined;
    this.endDate =
        this.route.snapshot.queryParamMap.get('endDate') ?? undefined;
    // Default to monthly tab
    this.selectedTab = this.isValidDateRange() ? 'range' : 'monthly';
  }

  async ngOnInit() {
    await this.calculateMonthlyStats();
    if (this.showDateRange() && this.isValidDateRange()) {
      await this.calculateDateRangeStats();
    }
  }

  isValidDateRange(): boolean {
    return !!(this.startDate && this.endDate && this.startDate < this.endDate);
  }

  async onTabChange(tab: 'monthly'|'range') {
    this.selectedTab = tab;
    if (tab === 'range') {
      if (this.isValidDateRange()) {
        await this.calculateDateRangeStats();
      } else {
        this.dateRangeStats = undefined;
      }
    }
  }

  async onDateChange() {
    if (this.selectedTab === 'range' && this.isValidDateRange()) {
      await this.calculateDateRangeStats();
    } else if (this.selectedTab === 'range') {
      this.dateRangeStats = undefined;
    }
  }

  async calculateMonthlyStats() {
    const allData = await this.getAllData();
    const monthlyStats = new Map<string, MonthlyStats>();
    const uniquePax = new Set<string>();
    const paxTotalBeatdowns = new Map<string, number>();
    const paxQCount = new Map<string, number>();
    const paxVQedAos = new Map<string, Set<string>>();

    for (const backblast of allData.reverse()) {
      const month = moment(backblast.date).format('MMMM YYYY');
      const monthStats = monthlyStats.get(month) ?? this.newMonthlyStats(month);

      // update the monthly stats
      monthStats.totalPosts += backblast.pax.length;
      monthStats.totalBeatdowns++;

      for (const name of backblast.pax) {
        // keep track of all PAX and new FNGs
        monthStats.allPax.add(name);

        // Track total beatdowns for this PAX
        const currentTotal = paxTotalBeatdowns.get(name) ?? 0;
        const newTotal = currentTotal + 1;
        paxTotalBeatdowns.set(name, newTotal);

        // Check if this PAX hit a milestone this month
        const previousMilestone = Math.floor(currentTotal / 100) * 100;
        const newMilestone = Math.floor(newTotal / 100) * 100;
        if (newMilestone > previousMilestone) {
          const milestoneGroup =
              monthStats.milestonePax.find(g => g.milestone === newMilestone);
          if (milestoneGroup) {
            milestoneGroup.pax.push(name);
          } else {
            monthStats.milestonePax.push({
              milestone: newMilestone,
              pax: [name],
              paxNames: this.utilService.normalizeName(name)
            });
          }
        }

        if (!uniquePax.has(name)) {
          monthStats.fngs.add(name);
          uniquePax.add(name);

          // also store the fngs per ao
          const aoFngs = monthStats.fngAoMap.get(backblast.ao) ?? [];
          monthStats.fngAoMap.set(backblast.ao, [...aoFngs, name]);
        }

        // Track Q stats
        if (backblast.qs.includes(name)) {
          monthStats.qs.add(name);

          // Track Q count and VQs
          const qCount = paxQCount.get(name) ?? 0;
          paxQCount.set(name, qCount + 1);

          // If this is their second Q, it's a VQ
          if (qCount === 1) {
            const vqedAos = paxVQedAos.get(name) ?? new Set<string>();
            vqedAos.add(backblast.ao);
            paxVQedAos.set(name, vqedAos);

            monthStats.vqs.push({name, ao: backblast.ao});
            monthStats.totalVQs++;
          }
        }
      }

      monthlyStats.set(month, monthStats);
    }

    let lastMonth: MonthlyStats;
    monthlyStats.forEach(thisMonth => {
      // sort the fngs by ao
      thisMonth.fngsByAo = Array.from(thisMonth.fngAoMap.entries())
                               .map(([name, fngs]) => ({name, fngs}))
                               .sort((a, b) => b.fngs.length - a.fngs.length);

      // Sort milestone PAX by milestone (descending)
      thisMonth.milestonePax.sort((a, b) => b.milestone - a.milestone);

      // Calculate total milestone PAX and add normalized names
      thisMonth.totalMilestonePax =
          thisMonth.milestonePax.reduce((sum, group) => {
            // Add normalized names for this group
            group.paxNames =
                group.pax.map(name => this.utilService.normalizeName(name))
                    .join(', ');
            return sum + group.pax.length;
          }, 0);

      // Sort VQs by AO name
      thisMonth.vqs.sort((a, b) => a.ao.localeCompare(b.ao));

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

    this.monthlyStats = Array.from(monthlyStats.values()).reverse();
  }

  async calculateDateRangeStats() {
    const allData = await this.getAllData();
    const startMoment = moment(this.startDate);
    const endMoment = moment(this.endDate);

    // Build PAX history from all data
    interface PaxHistory {
      firstPost: moment.Moment;
      firstQ: moment.Moment|null;
      totalPostsBefore: number;
      totalQsBefore: number;
      totalPostsInRange: number;
      totalQsInRange: number;
      aosFng: Set<string>;  // AOs where FNG in range
    }
    const paxHistory = new Map<string, PaxHistory>();
    const aoFngMap = new Map<string, string[]>();

    // First pass: build full history
    for (const bb of allData) {
      const date = moment(bb.date);
      for (const name of bb.pax) {
        let hist = paxHistory.get(name);
        if (!hist) {
          hist = {
            firstPost: date,
            firstQ: null,
            totalPostsBefore: 0,
            totalQsBefore: 0,
            totalPostsInRange: 0,
            totalQsInRange: 0,
            aosFng: new Set<string>(),
          };
          paxHistory.set(name, hist);
        }
        // Update first post
        if (date.isBefore(hist.firstPost)) hist.firstPost = date;
      }
      for (const name of bb.qs) {
        let hist = paxHistory.get(name);
        if (!hist) {
          hist = {
            firstPost: date,
            firstQ: date,
            totalPostsBefore: 0,
            totalQsBefore: 0,
            totalPostsInRange: 0,
            totalQsInRange: 0,
            aosFng: new Set<string>(),
          };
          paxHistory.set(name, hist);
        }
        // Update first Q
        if (!hist.firstQ || date.isBefore(hist.firstQ)) hist.firstQ = date;
      }
    }

    // Second pass: count posts/Qs before and in range, and collect FNG AOs
    for (const bb of allData) {
      const date = moment(bb.date);
      for (const name of bb.pax) {
        const hist = paxHistory.get(name)!;
        if (date.isBefore(startMoment)) {
          hist.totalPostsBefore++;
          if (bb.qs.includes(name)) hist.totalQsBefore++;
        } else if (
            date.isSameOrAfter(startMoment) && date.isSameOrBefore(endMoment)) {
          hist.totalPostsInRange++;
          if (bb.qs.includes(name)) hist.totalQsInRange++;
          // FNG by AO
          if (hist.firstPost.isSame(date, 'day')) {
            const aoFngs = aoFngMap.get(bb.ao) ?? [];
            if (!aoFngs.includes(name)) {
              aoFngs.push(name);
              aoFngMap.set(bb.ao, aoFngs);
            }
            hist.aosFng.add(bb.ao);
          }
        }
      }
    }

    // Now, build the stats for the range
    const allPax = new Set<string>();
    const qs = new Set<string>();
    const fngs = new Set<string>();
    const vqs:
        {name: string,
         ao: string,
         normalizedName: string,
         normalizedAo: string}[] = [];
    const milestones: {milestone: number, pax: string[], paxNames: string}[] =
        [];
    let totalPosts = 0;
    let totalBeatdowns = 0;
    let totalVQs = 0;
    let totalMilestonePax = 0;

    // For milestone grouping
    const milestoneMap = new Map<number, string[]>();

    for (const [name, hist] of paxHistory.entries()) {
      // FNG: first post in range
      if (hist.firstPost.isSameOrAfter(startMoment) &&
          hist.firstPost.isSameOrBefore(endMoment)) {
        fngs.add(name);
      }
      // VQ: first Q in range
      if (hist.firstQ && hist.firstQ.isSameOrAfter(startMoment) &&
          hist.firstQ.isSameOrBefore(endMoment)) {
        // Find the AO for their first Q
        const firstQAo = allData
                             .find(
                                 bb => moment(bb.date).isSame(hist.firstQ!) &&
                                     bb.qs.includes(name))
                             ?.ao ||
            '';
        vqs.push({
          name,
          ao: firstQAo,
          normalizedName: this.utilService.normalizeName(name),
          normalizedAo: this.utilService.normalizeName(firstQAo)
        });
        totalVQs++;
      }
      // Milestones: check if they cross a 100s boundary in the range
      const before = hist.totalPostsBefore;
      const after = before + hist.totalPostsInRange;
      for (let m = Math.floor((before + 1) / 100) * 100; m <= after; m += 100) {
        if (m > before && m <= after) {
          if (!milestoneMap.has(m)) milestoneMap.set(m, []);
          milestoneMap.get(m)!.push(name);
          totalMilestonePax++;
        }
      }
      // All PAX and Qs in range
      if (hist.totalPostsInRange > 0) allPax.add(name);
      if (hist.totalQsInRange > 0) qs.add(name);
    }

    // Build milestone groups
    for (const [milestone, paxArr] of milestoneMap.entries()) {
      milestones.push({
        milestone,
        pax: paxArr,
        paxNames: paxArr.map(n => this.utilService.normalizeName(n)).join(', ')
      });
    }
    milestones.sort((a, b) => b.milestone - a.milestone);

    // Count posts and beatdowns in range
    for (const bb of allData) {
      const date = moment(bb.date);
      if (date.isSameOrAfter(startMoment) && date.isSameOrBefore(endMoment)) {
        totalPosts += bb.pax.length;
        totalBeatdowns++;
      }
    }

    // FNGs by AO
    const fngsByAo = Array.from(aoFngMap.entries())
                         .map(([name, fngs]) => ({name, fngs}))
                         .sort((a, b) => b.fngs.length - a.fngs.length);

    // Returned and missing PAX
    const baselinePax = new Set<string>();
    for (const [name, hist] of paxHistory.entries()) {
      if (hist.totalPostsBefore > 0) baselinePax.add(name);
    }
    const returnedPax = new Set(
        [...allPax].filter(name => !fngs.has(name) && !baselinePax.has(name)));
    const missingPax =
        new Set([...baselinePax].filter(name => !allPax.has(name)));

    // Pre-calculate normalized names for display
    const normalizedFngs =
        Array.from(fngs).map(name => this.utilService.normalizeName(name));
    const normalizedReturnedPax =
        Array.from(returnedPax)
            .map(name => this.utilService.normalizeName(name));
    const normalizedMissingPax =
        Array.from(missingPax)
            .map(name => this.utilService.normalizeName(name));

    this.dateRangeStats = {
      allPax,
      qs,
      fngs,
      returnedPax,
      missingPax,
      totalPosts,
      totalBeatdowns,
      milestonePax: milestones,
      totalMilestonePax,
      vqs,
      totalVQs,
      normalizedFngs,
      normalizedReturnedPax,
      normalizedMissingPax,
      // For card UI:
      fngsByAo,
      breakdownFngsByAo: false,
    } as any;
  }

  private async getAllData() {
    return Object.values(REGION).includes(this.region) ?
        await this.backblastService.getBackblastsForAo(this.region) :
        this.ao ? await this.backblastService.getBackblastsForAo(this.ao) :
                  await this.backblastService.getAllData();
  }

  get title(): string {
    let scope = 'Region';
    if (this.ao) scope = this.utilService.normalizeName(this.ao);
    if (this.region) scope = this.utilService.normalizeName(this.region);
    let dateRange = '';
    if (this.startDate && this.endDate) {
      dateRange = ` (${moment(this.startDate).format('MM/DD')} - ${
          moment(this.endDate).format('MM/DD')})`;
    }
    return `${scope} Summary${dateRange}`;
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

    // Add milestone information if there are any
    if (thisMonth.milestonePax.length > 0) {
      string += `Milestone Achievements in ${thisName}:\n`;
      thisMonth.milestonePax.forEach(group => {
        string += `${group.paxNames} hit ${group.milestone} posts!\n`;
      });
      string += '\n';
    }

    // Add VQ information if there are any
    if (thisMonth.vqs.length > 0) {
      string += `VQ Achievements in ${thisName}:\n`;
      thisMonth.vqs.forEach(vq => {
        string +=
            `${this.utilService.normalizeName(vq.name)} VQ'd at ${vq.ao}\n`;
      });
      string += '\n';
    }

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

  copyDateRangeCard() {
    if (!this.dateRangeStats) return;
    const start = this.startDate ? moment(this.startDate).format('MM/DD') : '';
    const end = this.endDate ? moment(this.endDate).format('MM/DD') : '';
    let string = `We had ${this.dateRangeStats.allPax.size} PAX from ${
        start} to ${end}, ${
        this.dateRangeStats.qs.size} of which Qd at least one BD, and we had ${
        this.dateRangeStats.returnedPax
            .size} PAX come back out in this period that didn't post before!\n\n`;

    // Add milestone information if there are any
    if (this.dateRangeStats.milestonePax.length > 0) {
      string += `Milestone Achievements in this period:\n`;
      this.dateRangeStats.milestonePax.forEach(group => {
        string += `${group.paxNames} hit ${group.milestone} posts!\n`;
      });
      string += '\n';
    }

    // Add VQ information if there are any
    if (this.dateRangeStats.vqs.length > 0) {
      string += `VQ Achievements in this period:\n`;
      this.dateRangeStats.vqs.forEach(vq => {
        string += `${vq.normalizedName} VQ'd at ${vq.normalizedAo}\n`;
      });
      string += '\n';
    }

    const fngs = this.dateRangeStats.normalizedFngs;
    string += `We had ${
        fngs.length} FNGs in this period! If you met one of these HIMs, keep encouraging them to come out and push them towards joining slack as we see more stickiness that way!\n${
        fngs.join('\n')}\n\n`;

    const missing = this.dateRangeStats.normalizedMissingPax;
    string += `We had ${
        missing
            .length} PAX drop off in this period that came out at least once before. If you know one of the HIMs below, maybe give em a shout to encourage them to come join us in the gloom again:\n${
        missing.join('\n')}`;

    this.utilService.copyToClipboard(
        string, 'Copied the details to the clipboard');
  }

  private newMonthlyStats(displayName: string): MonthlyStats {
    return {
      displayName,
      allPax: new Set<string>(),
      qs: new Set<string>(),
      fngs: new Set<string>(),
      fngAoMap: new Map<string, string[]>(),
      fngsByAo: [],
      breakdownFngsByAo: false,
      returnedPax: new Set<string>(),
      missingPax: new Set<string>(),
      totalPosts: 0,
      totalBeatdowns: 0,
      milestonePax: [],
      totalMilestonePax: 0,
      vqs: [],
      totalVQs: 0,
    };
  }

  showDateRange(): boolean {
    return this.selectedTab === 'range';
  }
}