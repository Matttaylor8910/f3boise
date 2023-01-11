import {Injectable} from '@angular/core';
import {QLineUp} from 'types';

import {HttpService} from './http.service';
import {UtilService} from './util.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/q_line_up/list';

@Injectable({providedIn: 'root'})
export class QService {
  constructor(
      private readonly http: HttpService,
      private readonly utilService: UtilService,
  ) {}

  /**
   * Get the Q lineup for a provided date range and an optional ao param
   * @param start date in the format YYYY-MM-DD
   * @param end date in the format YYYY-MM-DD
   * @param ao any ao param
   */
  getQLineUp(start: string, end: string, ao?: string): Promise<QLineUp[]> {
    // set up the URL with optional ao param
    let url = `${URL}?start=${start}&end=${end}`;
    if (ao) url += `&ao=${ao}`;

    return this.http.get(url).then((data: QLineUp[]) => {
      return data.map(lineup => {
        lineup.ao = this.utilService.normalizeName(lineup.ao);
        return lineup;
      });
    });
  }
}
