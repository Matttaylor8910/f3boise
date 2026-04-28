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
