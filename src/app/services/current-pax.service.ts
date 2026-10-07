import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {BehaviorSubject, combineLatest, from, Observable, of} from 'rxjs';
import {map, shareReplay, switchMap} from 'rxjs/operators';
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

/** Where the current PAX came from. */
export type PaxSource =
    /** Matched by the signed-in Firebase user's email: real auth. */
    'auth'|
    /** The user told us who they are, with no proof: personalization only. */
    'chosen';

export interface CurrentPax {
  pax: Pax;
  source: PaxSource;
}

/** localStorage key holding the self-identified PAX name. */
const CHOSEN_PAX_KEY = 'chosenPaxName';

/** How far back to look when deciding which AOs are "yours". */
export const MY_AOS_DAYS = 90;
/** How many AOs to pin as "yours". */
export const MY_AOS_LIMIT = 3;

/**
 * Resolves who is using the app to their PAX record and derives the AOs they
 * post at most. Shared by the sidebar, the tab bar and the personal dashboard
 * so the lookup only happens once.
 *
 * A signed-in Firebase user is matched by email. Failing that, a PAX the user
 * picked for themselves (kept in localStorage) is used, which is how the
 * installed app personalizes itself without the email-link dance. Only ever
 * use {@link current$}'s `source` for display: anything that writes data must
 * keep checking real auth (AuthService / UserPermissionsService).
 */
@Injectable({providedIn: 'root'})
export class CurrentPaxService {
  /** The current PAX and how we know, or undefined when nobody is known. */
  readonly current$: Observable<CurrentPax|undefined>;
  /** The current PAX, or undefined when signed out and nobody was chosen. */
  readonly pax$: Observable<Pax|undefined>;

  private readonly chosenName$ =
      new BehaviorSubject<string|null>(readChosenName());

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly backblastService: BackblastService,
      private readonly utilService: UtilService,
  ) {
    const authPax$ = this.authService.authState$.pipe(
        switchMap(user => {
          const email: string|undefined = user?.email;
          return email ? from(this.paxService.getPaxByEmail(email)) :
                         of(undefined);
        }),
    );
    this.current$ =
        combineLatest([authPax$, this.chosenName$])
            .pipe(
                switchMap(([authPax, chosenName]) => this.resolve(
                              authPax, chosenName)),
                shareReplay({bufferSize: 1, refCount: true}),
            );
    this.pax$ = this.current$.pipe(map(current => current?.pax));
  }

  /** Remember that the user says they are this PAX. */
  choose(pax: Pax): void {
    try {
      localStorage.setItem(CHOSEN_PAX_KEY, pax.name);
    } catch (e) {
      // private mode or storage disabled: the choice just won't persist
    }
    this.chosenName$.next(pax.name);
  }

  /** Forget the self-identified PAX. */
  clearChoice(): void {
    try {
      localStorage.removeItem(CHOSEN_PAX_KEY);
    } catch (e) {
      // nothing to clear
    }
    this.chosenName$.next(null);
  }

  private async resolve(authPax: Pax|undefined, chosenName: string|null):
      Promise<CurrentPax|undefined> {
    if (authPax) return {pax: authPax, source: 'auth'};
    if (!chosenName) return undefined;
    const pax = await this.paxService.getPax(chosenName);
    return pax ? {pax, source: 'chosen'} : undefined;
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

function readChosenName(): string|null {
  try {
    return localStorage.getItem(CHOSEN_PAX_KEY);
  } catch (e) {
    return null;
  }
}
