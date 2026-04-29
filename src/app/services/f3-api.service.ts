import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

// TODO: move bearer token to a backend secret rather than shipping it in the client bundle
const F3_BEARER_TOKEN = 'f3_13eff916823aab61bd149ba8eb4e2a09f1f3e0241b0ef440';

const F3_API_BASE = 'https://api.f3nation.com/v1';

/**
 * F3 Nation API region IDs for the Boise-area regions.
 */
export const BOISE_REGION_IDS = {
  cityOfTrees: 49583,
  settlers: 45177,
  highDesert: 45176,
  canyon: 50162,
} as const;

/** Website URL sent on org create/update payloads — required by the Nation API `website` field. */
export const F3_REGION_WEBSITE_URL = 'https://f3boise.com';

export type RegionId = (typeof BOISE_REGION_IDS)[keyof typeof BOISE_REGION_IDS];

export interface F3EventType {
  eventTypeId: number;
  eventTypeName: string;
  eventCategory: string;
}

export interface F3Event {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  isPrivate: boolean;
  parent: string;
  locationId: number;
  startDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  email: string|null;
  created: string;
  locationName: string;
  locationAddress: string;
  locationAddress2: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  location: string|null;
  parents: Array<{parentId: number; parentName: string}>;
  regions: Array<{regionId: number; regionName: string}>;
  eventTypes: F3EventType[];
}

export interface F3EventsResponse {
  events: F3Event[];
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
}

export interface ListEventsParams {
  regionIds?: RegionId[];
  statuses?: 'active'|'inactive'|'all';
  pageIndex?: number;
  pageSize?: number;
  searchTerm?: string;
  sorting?: string;
}

export interface CreateOrUpdateEventRequest {
  /** Omit (or 0) to create; provide the existing event id to update. */
  id?: number;
  aoId: number;
  regionId: number;
  locationId: number;
  eventTypeIds: number[];
  name: string;
  description: string;
  isActive: boolean;
  isPrivate: boolean;
  highlight: boolean;
  startDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface CreateOrUpdateEventResponse {
  event: F3Event;
}

export interface F3Org {
  id: number;
  parentId: number;
  name: string;
  orgType: string;
  defaultLocationId: number|null;
  isActive: boolean;
  website: string|null;
  description: string;
}

export interface F3Location {
  id: number;
  /** API returns `locationName` */
  locationName: string;
  regionId: number;
  regionName: string;
  description: string;
  isActive: boolean;
  latitude: number|null;
  longitude: number|null;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}

export interface ListOrgsParams {
  orgTypes?: string[];
  onlyMine?: boolean;
  parentOrgIds?: number[];
  statuses?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface ListLocationsParams {
  regionIds?: number[];
  onlyMine?: boolean;
  statuses?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface CreateOrgRequest {
  id?: number;
  parentId: number;
  defaultLocationId?: number;
  name: string;
  description?: string;
  isActive: boolean;
  logoUrl?: string|null;
  /** API rejects requests without this — use '' or your region URL */
  website: string;
  email?: string|null;
  twitter: string;
  facebook: string;
  instagram: string;
  lastAnnualReview?: string|null;
  aoCount?: number;
  meta?: Record<string, unknown>|null;
  orgType: 'ao'|'region'|'area'|'sector'|'nation';
}

export interface CreateOrgResponse {
  org: {id: number; parentId: number; name: string; orgType: string; defaultLocationId: number};
}

export interface CreateLocationRequest {
  id?: number;
  orgId: number;
  name: string;
  description?: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  addressStreet?: string;
  addressStreet2?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  meta?: Record<string, unknown>|null;
  email?: string|null;
}

export interface CreateLocationResponse {
  location: {id: number; orgId: number; name: string; latitude: number; longitude: number};
}

@Injectable({providedIn: 'root'})
export class F3ApiService {
  private readonly headers = new HttpHeaders({
    'Accept': 'application/json',
    'Authorization': `Bearer ${F3_BEARER_TOKEN}`,
    'client': 'scalar-api',
  });

  private readonly postHeaders = new HttpHeaders({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${F3_BEARER_TOKEN}`,
    'client': 'scalar-api',
  });

  constructor(private readonly http: HttpClient) {}

  /**
   * Fetches workouts (events) from the F3 Nation API.
   * Defaults to all four Boise-area regions with active status.
   */
  async listEvents(params: ListEventsParams = {}): Promise<F3EventsResponse> {
    const {
      regionIds = Object.values(BOISE_REGION_IDS) as RegionId[],
      statuses = 'active',
      pageIndex,
      pageSize,
      searchTerm,
      sorting,
    } = params;

    let httpParams = new HttpParams().set('statuses', statuses);
    for (const id of regionIds) {
      httpParams = httpParams.append('regionIds', String(id));
    }
    if (pageIndex !== undefined) httpParams = httpParams.set('pageIndex', pageIndex);
    if (pageSize !== undefined) httpParams = httpParams.set('pageSize', pageSize);
    if (searchTerm) httpParams = httpParams.set('searchTerm', searchTerm);
    if (sorting) httpParams = httpParams.set('sorting', sorting);

    return firstValueFrom(
        this.http.get<F3EventsResponse>(`${F3_API_BASE}/event`, {
          headers: this.headers,
          params: httpParams,
        }),
    );
  }

  listOrgs(params: ListOrgsParams = {}): Promise<{orgs: F3Org[]; total: number}> {
    const {orgTypes = ['ao'], onlyMine, parentOrgIds, statuses = 'active', pageIndex, pageSize} = params;
    let p = new HttpParams().set('statuses', statuses);
    for (const t of orgTypes) p = p.append('orgTypes', t);
    if (onlyMine) p = p.set('onlyMine', 'true');
    if (parentOrgIds?.length) for (const id of parentOrgIds) p = p.append('parentOrgIds', String(id));
    if (pageIndex !== undefined) p = p.set('pageIndex', pageIndex);
    if (pageSize  !== undefined) p = p.set('pageSize',  pageSize);
    return firstValueFrom(
        this.http.get<{orgs: F3Org[]; total: number}>(`${F3_API_BASE}/org`, {headers: this.headers, params: p}),
    );
  }

  listLocations(params: ListLocationsParams = {}): Promise<{locations: F3Location[]; totalCount: number}> {
    const {regionIds, onlyMine, statuses = 'active', pageIndex, pageSize} = params;
    let p = new HttpParams().set('statuses', statuses);
    if (onlyMine) p = p.set('onlyMine', 'true');
    if (regionIds?.length) for (const id of regionIds) p = p.append('regionIds', String(id));
    if (pageIndex !== undefined) p = p.set('pageIndex', pageIndex);
    if (pageSize  !== undefined) p = p.set('pageSize',  pageSize);
    return firstValueFrom(
        this.http.get<{locations: F3Location[]; totalCount: number}>(
            `${F3_API_BASE}/location`, {headers: this.headers, params: p}),
    );
  }

  createOrg(body: CreateOrgRequest): Promise<CreateOrgResponse> {
    return firstValueFrom(
        this.http.post<CreateOrgResponse>(`${F3_API_BASE}/org`, body, {headers: this.postHeaders}),
    );
  }

  createLocation(body: CreateLocationRequest): Promise<CreateLocationResponse> {
    return firstValueFrom(
        this.http.post<CreateLocationResponse>(
            `${F3_API_BASE}/location`, body, {headers: this.postHeaders}),
    );
  }

  /**
   * Creates or updates an event. Pass `id` in the body to update an existing
   * event; omit it (or pass 0) to create a new one.
   */
  createOrUpdateEvent(
      body: CreateOrUpdateEventRequest,
      ): Promise<CreateOrUpdateEventResponse> {
    return firstValueFrom(
        this.http.post<CreateOrUpdateEventResponse>(
            `${F3_API_BASE}/event`,
            body,
            {headers: this.postHeaders},
            ),
    );
  }
}
