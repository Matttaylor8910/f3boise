import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {BASE_URL} from '../../../constants';

import {parsePreblastHcs} from './preblast-hc.parser';

const URL = `${BASE_URL}/reactions_log/pre-blast-data`;

/** Who has HC'd (hard committed) to a day's preblasts, per AO. */
@Injectable({providedIn: 'root'})
export class PreblastHcService {
  private readonly cache = new Map<string, Promise<Map<string, Set<string>>>>();

  constructor(private readonly http: HttpClient) {}

  /**
   * PAX names holding an HC on each AO's preblast for a date, keyed by
   * backblast AO name (lowercase). Empty when the scraper is unreachable.
   * Fetched once per date per page load.
   * @param date YYYY-MM-DD
   */
  getHcs(date: string): Promise<Map<string, Set<string>>> {
    let pending = this.cache.get(date);
    if (!pending) {
      pending = this.fetch(date);
      this.cache.set(date, pending);
    }
    return pending;
  }

  /** The HC names for one AO on a date, in a stable order. */
  async getHcsForAo(date: string, aoKey: string): Promise<string[]> {
    const hcs = await this.getHcs(date);
    return Array.from(hcs.get(aoKey) ?? []).sort();
  }

  private async fetch(date: string): Promise<Map<string, Set<string>>> {
    try {
      const summary = await firstValueFrom(
          this.http.get(URL, {params: {date}, responseType: 'text'}));
      return parsePreblastHcs(summary);
    } catch (e) {
      this.cache.delete(date);  // let the next page load try again
      return new Map();
    }
  }
}
