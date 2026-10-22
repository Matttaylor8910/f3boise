import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {BASE_URL} from '../../../constants';

import {parsePreblastHcs} from './preblast-hc.parser';

const URL = `${BASE_URL}/reactions_log/pre-blast-data`;

/**
 * How long a day's HCs are reused before the next request fetches them
 * again. PAX keep HC'ing right up until the beatdown and a home-screen PWA
 * can stay alive for days, so the list can't live for the whole session;
 * a short window still lets a page's own lookups share one request.
 */
const MAX_AGE_MS = 60 * 1000;

interface CachedHcs {
  fetchedAt: number;
  hcs: Promise<Map<string, Set<string>>>;
}

/** Who has HC'd (hard committed) to a day's preblasts, per AO. */
@Injectable({providedIn: 'root'})
export class PreblastHcService {
  private readonly cache = new Map<string, CachedHcs>();

  constructor(private readonly http: HttpClient) {}

  /**
   * PAX names holding an HC on each AO's preblast for a date, keyed by
   * backblast AO name (lowercase). Empty when the scraper is unreachable.
   * Fetched again once the last fetch is older than `MAX_AGE_MS`.
   * @param date YYYY-MM-DD
   */
  getHcs(date: string): Promise<Map<string, Set<string>>> {
    const cached = this.cache.get(date);
    if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) {
      return cached.hcs;
    }
    const hcs = this.fetch(date);
    this.cache.set(date, {fetchedAt: Date.now(), hcs});
    return hcs;
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
      this.cache.delete(date);  // let the next lookup try again
      return new Map();
    }
  }
}
