import {Component} from '@angular/core';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';

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

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrls: ['./summary.page.scss'],
})
export class SummaryPage {
  monthlyStats?: MonthlyStats[];

  constructor(
      public readonly utilService: UtilService,
      private readonly backblastService: BackblastService,
  ) {
    this.calculateStats();
  }

  async calculateStats() {
    const allData = await this.backblastService.getAllData();

    const monthlyStats = new Map<string, MonthlyStats>();
    const uniquePax = new Set<string>();

    for (const backblast of allData.reverse()) {
      const month = moment(backblast.date).format('MMMM YYYY');
      const monthStats = monthlyStats.get(month) ?? this.newMonthlyStats(month);

      // update the monthly stats as well
      monthStats.totalPosts += backblast.pax.length;

      for (const name of backblast.pax) {
        // keep track of all PAX and new FNGs
        monthStats.allPax.add(name);
        if (!uniquePax.has(name)) {
          monthStats.fngs.add(name);
        }

        // save their Q stats as well if applicable
        if (backblast.qs.includes(name)) {
          monthStats.qs.add(name);
        }
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

    this.monthlyStats = Array.from(monthlyStats.values()).reverse();
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
}
