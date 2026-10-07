import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {BASE_URL} from '../../../constants';

import {parsePreblastHcs} from './preblast-hc.parser';

const URL = `${BASE_URL}/reactions_log/pre-blast-data`;

/** Who has HC'd (hard committed) to tomorrow's preblasts, per AO. */
@Injectable({providedIn: 'root'})
export class PreblastHcService {
  constructor(private readonly http: HttpClient) {}

  /**
   * PAX names (lowercase) holding an HC on each AO's preblast for a date,
   * keyed by backblast AO name. Empty when the scraper is unreachable.
   * @param date YYYY-MM-DD
   */
  async getHcs(date: string): Promise<Map<string, Set<string>>> {
    try {
      const summary = await firstValueFrom(
          this.http.get(URL, {params: {date}, responseType: 'text'}));
      return parsePreblastHcs(summary);
    } catch (e) {
      return new Map();
    }
  }
}
