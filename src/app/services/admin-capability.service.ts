import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';

import {
  BOISE_REGIONS,
  parseAoqOrgIds,
  parseNantanRegionIds,
} from 'src/app/services/user-permissions.service';

import {AuthService} from './auth.service';
import {UserProfilesService} from './user-profiles.service';

/** Permissions for the Admin page (role edits, org chart assignments). */
export interface AdminCapabilities {
  /** Full CRUD on any user's roles — Firestore `admin` role only. */
  canEditArbitraryRoles: boolean;
  /**
   * Region IDs where the current user may assign/remove AOQ roles.
   * Admins get all Boise regions; Nantans get only their assigned region(s).
   */
  assignableAoqRegionIds: ReadonlySet<number>;
  /** Nantan region IDs held by the current user — used for transfer detection. */
  ownNantanRegionIds: ReadonlySet<number>;
  /** AOQ org IDs held by the current user — used for transfer detection. */
  ownAoqOrgIds: ReadonlySet<number>;
  /** UID of the currently signed-in user, or null when signed out. */
  currentUid: string|null;
}

export const NO_ADMIN_CAPABILITIES: AdminCapabilities = {
  canEditArbitraryRoles: false,
  assignableAoqRegionIds: new Set(),
  ownNantanRegionIds: new Set(),
  ownAoqOrgIds: new Set(),
  currentUid: null,
};

@Injectable({providedIn: 'root'})
export class AdminCapabilityService {
  constructor(
      private readonly auth: AuthService,
      private readonly profiles: UserProfilesService,
  ) {}

  readonly capabilities$: Observable<AdminCapabilities> =
      this.auth.authState$.pipe(
          switchMap(user => {
            if (!user?.uid) return of(NO_ADMIN_CAPABILITIES);
            const uid = user.uid;
            return this.profiles.getProfile$(uid).pipe(
                map(profile => {
                  const roles = profile?.roles ?? [];
                  const isAdmin = roles.includes('admin');
                  const nantanRegionIds = new Set(parseNantanRegionIds(roles));
                  const aoqOrgIds = new Set(parseAoqOrgIds(roles));
                  const assignableAoqRegionIds: ReadonlySet<number> = isAdmin ?
                      new Set(BOISE_REGIONS.map(r => r.id)) :
                      nantanRegionIds;
                  return {
                    canEditArbitraryRoles: isAdmin,
                    assignableAoqRegionIds,
                    ownNantanRegionIds: nantanRegionIds,
                    ownAoqOrgIds: aoqOrgIds,
                    currentUid: uid,
                  };
                }),
            );
          }),
          distinctUntilChanged((a, b) => {
            return a.canEditArbitraryRoles === b.canEditArbitraryRoles &&
                a.currentUid === b.currentUid &&
                setsEqual(a.ownNantanRegionIds, b.ownNantanRegionIds) &&
                setsEqual(a.ownAoqOrgIds, b.ownAoqOrgIds) &&
                setsEqual(a.assignableAoqRegionIds, b.assignableAoqRegionIds);
          }),
      );
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
