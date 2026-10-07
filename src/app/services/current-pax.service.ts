import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {from, Observable, of} from 'rxjs';
import {shareReplay, switchMap} from 'rxjs/operators';
import {Backblast, Pax} from 'types';

import {AuthService} from './auth.service';
import {BackblastService} from './backblast.service';
import {PaxService} from './pax.service';
import {UtilService} from './util.service';

/** An AO the current PAX posts at regularly. */
export interface MyAo {
  /** Raw AO name as it appears in backblasts (lowercase, e.g. "bleach"). */
  name: string;
  /** Display name, e.g. "Bleach". */
  normalizedName: string;
  /** Posts at this AO inside the lookback window. */
  posts: number;
}

/** How far back to look when deciding which AOs are "yours". */
export const MY_AOS_DAYS = 90;
/** How many AOs to pin as "yours". */
export const MY_AOS_LIMIT = 3;

/**
 * Resolves the signed-in Firebase user to their PAX record (matched by
 * email) and derives the AOs they post at most. Shared by the sidebar, the
 * tab bar and the personal dashboard so the lookup only happens once.
 */
@Injectable({providedIn: 'root'})
export class CurrentPaxService {
  /** The linked PAX, or undefined when signed out or not matched. */
  readonly pax$: Observable<Pax|undefined>;

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly backblastService: BackblastService,
      private readonly utilService: UtilService,
  ) {
    this.pax$ = this.authService.authState$.pipe(
        switchMap(user => {
          const email: string|undefined = user?.email;
          return email ? from(this.paxService.getPaxByEmail(email)) :
                         of(undefined);
        }),
        shareReplay({bufferSize: 1, refCount: true}),
    );
  }

  /**
   * The AOs this PAX has posted at most in the last MY_AOS_DAYS days. Falls
   * back to their all-time favorites when they haven't posted recently, so a
   * returning PAX still gets a useful list.
   */
  async getMyAos(paxName: string, limit = MY_AOS_LIMIT): Promise<MyAo[]> {
    const bds = await this.backblastService.getBackblastsForPax(paxName);
    const recent = this.countAos(
        bds, bd => moment().diff(moment(bd.date), 'days') <= MY_AOS_DAYS);
    const source = recent.length > 0 ? recent : this.countAos(bds, () => true);
    return source.slice(0, limit);
  }

  private countAos(bds: Backblast[], include: (bd: Backblast) => boolean):
      MyAo[] {
    const counts = new Map<string, MyAo>();
    for (const bd of bds) {
      if (!include(bd)) continue;
      const name = bd.ao.toLowerCase();
      const entry = counts.get(name) ?? {
        name,
        normalizedName: this.utilService.normalizeName(bd.ao),
        posts: 0,
      };
      entry.posts++;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).sort((a, b) => b.posts - a.posts);
  }
}
