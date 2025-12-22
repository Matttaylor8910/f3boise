import {Component} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';

const GTE_DATE = '09/16/2023';

@Component({
  selector: 'app-gte',
  templateUrl: './gte.page.html',
  styleUrls: ['./gte.page.scss'],
})
export class GtePage {
  gteMoment = moment(GTE_DATE);
  formattedDate = this.gteMoment.format('dddd, MMM DD yyyy');
  currentYear = new Date().getFullYear();

  countdown: string;

  constructor(
      private readonly router: Router,
  ) {
    this.countdown = this.getCountdown();
  }

  getCountdown(): string {
    const days = this.gteMoment.diff(moment().startOf('day'), 'days');

    if (days > 1) return `${days} days!`;
    if (days === 1) return `Starts tomorrow!`;
    return this.formattedDate;
  }

  navTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
