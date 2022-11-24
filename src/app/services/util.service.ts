import {Injectable} from '@angular/core';
import * as moment from 'moment';

@Injectable({providedIn: 'root'})
export class UtilService {
  constructor() {}

  getRelativeDate(date?: string): string {
    // no-op if no date given
    if (!date) return '';

    const postMoment = moment(date);
    const days = moment().startOf('day').diff(postMoment, 'days');
    let dateString = '';

    // relative times
    if (days === 0) {
      dateString = 'Today';
    } else if (days === 1) {
      dateString = 'Yesterday';
    } else if (days > 1 && days < 7) {
      dateString = postMoment.format('dddd');
    } else {
      dateString = postMoment.format('ddd, MMM D');
    }

    // dates a year in the past should include year to be more clear
    if (days >= 365) {
      dateString += ` ${postMoment.format('YYYY')}`;
    }

    return dateString;
  }
}
