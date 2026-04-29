/**
 * Role encoding (stored as plain strings in `userProfiles.roles[]`):
 *   "admin"        — full access across all regions
 *   "nantan:49583" — Nantan of one region (region ID as number string)
 *   "aoq:12345"    — AOQ of one AO org (org ID as number string)
 */

import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {distinctUntilChanged, filter, map, switchMap} from 'rxjs/operators';

import {BOISE_REGION_IDS} from 'src/app/services/f3-api.service';

import {AuthService} from './auth.service';
import {UserProfile, UserProfilesService} from './user-profiles.service';

// ── Role string helpers ────────────────────────────────────────────────────

export const BOISE_REGIONS: ReadonlyArray<{id: number; name: string}> = [
  {id: BOISE_REGION_IDS.cityOfTrees, name: 'City of Trees'},
  {id: BOISE_REGION_IDS.settlers, name: 'Settlers'},
  {id: BOISE_REGION_IDS.highDesert, name: 'High Desert'},
  {id: BOISE_REGION_IDS.canyon, name: 'Canyon'},
];

export function makeNantanRole(regionId: number): string {
  return `nantan:${regionId}`;
}

export function makeAoqRole(orgId: number): string {
  return `aoq:${orgId}`;
}

export function parseNantanRegionIds(roles: string[]): number[] {
  return roles
      .filter(r => r.startsWith('nantan:'))
      .map(r => parseInt(r.split(':')[1], 10))
      .filter(n => !isNaN(n));
}

export function parseAoqOrgIds(roles: string[]): number[] {
  return roles
      .filter(r => r.startsWith('aoq:'))
      .map(r => parseInt(r.split(':')[1], 10))
      .filter(n => !isNaN(n));
}

/** True when roles include admin, Nantan, or AOQ — can open Admin (/admin). */
export function rolesGrantAdminAccess(roles: string[]): boolean {
  return roles.includes('admin') ||
      roles.some(r => r.startsWith('nantan:')) ||
      roles.some(r => r.startsWith('aoq:'));
}

/** Human-readable summary of a role string array for the users table. */
export function rolesDisplayLabel(roles: string[]): string {
  if (!roles.length) return '—';
  const parts: string[] = [];
  if (roles.includes('admin')) parts.push('Admin');
  const nantanIds = parseNantanRegionIds(roles);
  for (const id of nantanIds) {
    const r = BOISE_REGIONS.find(x => x.id === id);
    parts.push(`Nantan (${r?.name ?? id})`);
  }
  const aoqIds = parseAoqOrgIds(roles);
  for (const id of aoqIds) {
    parts.push(`AOQ (org ${id})`);
  }
  // any unknown roles
  const known = new Set(
      ['admin', ...nantanIds.map(makeNantanRole), ...aoqIds.map(makeAoqRole)]);
  for (const r of roles) {
    if (!known.has(r)) parts.push(r);
  }
  return parts.join(', ') || '—';
}

// ── Permissions model ──────────────────────────────────────────────────────

export interface MapPermissions {
  /** Can click empty map to create a new AO */
  canCreate: boolean;
  /**
   * Metro region IDs where the user may parent a new AO org. Empty when
   * `canCreate` is false. Admins get all Boise regions; Nantans get only their
   * assigned region(s). New-AO UI should list only these.
   */
  creatableRegionIds: readonly number[];
  /** Can edit the given AO (metadata / location / schedule days) */
  canEditAo(ao: {regionId: number; orgId?: number; parentAoId?: number}):
      boolean;
  /** Can delete the given AO */
  canDeleteAo(ao: {regionId: number}): boolean;
  /** Can add/edit/remove a day on the given AO */
  canEditDay(ao: {regionId: number; orgId?: number; parentAoId?: number}):
      boolean;
  /** Can delete a day on the given AO */
  canDeleteDay(ao: {regionId: number; orgId?: number; parentAoId?: number}):
      boolean;
}

const NO_ACCESS: MapPermissions = {
  canCreate: false,
  creatableRegionIds: [],
  canEditAo: () => false,
  canDeleteAo: () => false,
  canEditDay: () => false,
  canDeleteDay: () => false,
};

/** Map edit powers come only from Firestore `roles` — never from bootstrap emails.
 * `/map` is public; without roles the map page is read-only. AdminGuard handles `/admin`. */
function permissionsFromProfile(profile: UserProfile|null): MapPermissions {
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes('admin');

  if (isAdmin) {
    const creatableRegionIds =
        BOISE_REGIONS.map(r => r.id) as readonly number[];
    return {
      canCreate: true,
      creatableRegionIds,
      canEditAo: () => true,
      canDeleteAo: () => true,
      canEditDay: () => true,
      canDeleteDay: () => true,
    };
  }

  const nantanRegionIds = new Set(parseNantanRegionIds(roles));
  const aoqOrgIds = new Set(parseAoqOrgIds(roles));

  if (nantanRegionIds.size === 0 && aoqOrgIds.size === 0) return NO_ACCESS;

  const creatableRegionIds: number[] =
      BOISE_REGIONS.filter(r => nantanRegionIds.has(r.id)).map(r => r.id);

  return {
    canCreate: nantanRegionIds.size > 0,
    creatableRegionIds,

    canEditAo(ao) {
      if (nantanRegionIds.has(ao.regionId)) return true;
      const orgId = ao.orgId ?? ao.parentAoId;
      if (orgId !== undefined && aoqOrgIds.has(orgId)) return true;
      return false;
    },

    canDeleteAo(ao) {
      return nantanRegionIds.has(ao.regionId);
    },

    canEditDay(ao) {
      if (nantanRegionIds.has(ao.regionId)) return true;
      const orgId = ao.orgId ?? ao.parentAoId;
      if (orgId !== undefined && aoqOrgIds.has(orgId)) return true;
      return false;
    },

    canDeleteDay(ao) {
      // AOQs can remove days from their own AO
      if (nantanRegionIds.has(ao.regionId)) return true;
      const orgId = ao.orgId ?? ao.parentAoId;
      if (orgId !== undefined && aoqOrgIds.has(orgId)) return true;
      return false;
    },
  };
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable({providedIn: 'root'})
export class UserPermissionsService {
  constructor(
      private readonly auth: AuthService,
      private readonly profiles: UserProfilesService,
  ) {}

  /** Live permissions for the currently signed-in user. Emits NO_ACCESS when
   *  signed out, or when profile hasn't loaded yet. */
  readonly mapPermissions$: Observable<MapPermissions> =
      this.auth.authState$.pipe(
          switchMap(user => {
            if (!user?.uid) return of(NO_ACCESS);
            return this.profiles.getProfile$(user.uid).pipe(
                map(p => permissionsFromProfile(p)),
            );
          }),
          distinctUntilChanged(),
      );
}
