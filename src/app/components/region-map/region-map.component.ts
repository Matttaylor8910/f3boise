import {Component, Input, OnChanges, SimpleChanges, ViewChild} from '@angular/core';
import {GoogleMap} from '@angular/google-maps';
import {BOISE_REGION_IDS, F3ApiService, F3Event, F3Location, NationRegionId} from 'src/app/services/f3-api.service';
import {UtilService} from 'src/app/services/util.service';

import {buildAoMarkerOptions} from '../../pages/map/map-markers.helpers';
import {AoDay} from '../../pages/map/map.page';

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

interface MapAo {
  name: string;
  days: AoDay[];
  position: google.maps.LatLngLiteral;
  markerOptions: google.maps.MarkerOptions;
}

/**
 * Read-only embedded version of the full map page. Loads its own data from
 * F3ApiService and renders pins with the same SVG markers, but does not
 * mount any click handlers (no editing, no detail panel).
 *
 * Inputs:
 *   - regionIds: which Boise regions to load (defaults to all four)
 *   - aoNameFilter: when set, only AOs whose normalized name fuzzy-matches
 *     this string are rendered (used by single-AO pages).
 */
@Component({
  selector: 'app-region-map',
  templateUrl: './region-map.component.html',
  styleUrls: ['./region-map.component.scss'],
})
export class RegionMapComponent implements OnChanges {
  @Input() regionIds: NationRegionId[] =
      Object.values(BOISE_REGION_IDS) as NationRegionId[];
  @Input() aoNameFilter: string|null = null;
  /** Map height in pixels — controllable from parent layouts */
  @Input() height = 320;

  loading = true;
  error: string|null = null;
  aos: MapAo[] = [];

  mapCenter: google.maps.LatLngLiteral = {lat: 43.615, lng: -116.35};

  readonly mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    zoomControl: true,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    gestureHandling: 'cooperative',
    clickableIcons: false,
    keyboardShortcuts: false,
  };

  @ViewChild('mapRef') private readonly mapComponent?: GoogleMap;

  private fitBoundsTimer?: number;

  constructor(
      private readonly f3Api: F3ApiService,
      private readonly utilService: UtilService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['regionIds'] || changes['aoNameFilter']) {
      void this.loadData();
    }
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const ids = this.regionIds?.length ?
          this.regionIds :
          (Object.values(BOISE_REGION_IDS) as NationRegionId[]);

      const [{events}, {locations}] = await Promise.all([
        this.f3Api.listEvents({regionIds: ids, pageSize: 500}),
        this.f3Api.listLocations({regionIds: ids, pageSize: 500}),
      ]);

      this.aos = this.buildAos(events, locations);
      this.loading = false;
      this.scheduleFitBounds();
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to load map';
      this.loading = false;
    }
  }

  private buildAos(events: F3Event[], locations: F3Location[]): MapAo[] {
    const locationById = new Map(locations.map(l => [l.id, l]));

    // Group events by location id
    const byLocation = new Map<number, F3Event[]>();
    for (const ev of events) {
      const list = byLocation.get(ev.locationId) ?? [];
      list.push(ev);
      byLocation.set(ev.locationId, list);
    }

    const out: MapAo[] = [];
    const filterKey = this.aoNameFilter ?
        slugifyAoKey(this.utilService.normalizeName(this.aoNameFilter)) :
        null;

    for (const [locationId, evts] of byLocation) {
      const loc = locationById.get(locationId);
      if (!loc?.latitude || !loc?.longitude) continue;
      if (loc.latitude === 0 && loc.longitude === 0) continue;

      const first = evts[0];
      const dayMap = new Map<number, F3Event>();
      for (const ev of evts) {
        const idx = DAY_INDEX[ev.dayOfWeek?.toLowerCase()];
        if (idx !== undefined && !dayMap.has(idx)) dayMap.set(idx, ev);
      }
      const days: AoDay[] = DAYS.map((dayName, i) => ({
                                       dayIndex: i,
                                       dayName,
                                       event: dayMap.get(i) ?? null,
                                     }));

      const aoName = first.locationName || first.name;

      if (filterKey && !this.aoNameMatches(aoName, evts, filterKey)) continue;

      const position: google.maps.LatLngLiteral = {
        lat: loc.latitude,
        lng: loc.longitude,
      };
      const markerOptions = buildAoMarkerOptions({name: aoName, days});

      out.push({
        name: aoName,
        days,
        position,
        markerOptions,
      });
    }

    return out;
  }

  private aoNameMatches(
      aoName: string, evts: F3Event[], filterKey: string): boolean {
    const candidates = [aoName];
    for (const ev of evts) {
      const p = ev.parents?.[0]?.parentName;
      if (p) candidates.push(p);
      if (ev.name) candidates.push(ev.name);
    }
    for (const c of candidates) {
      const k = slugifyAoKey(this.utilService.normalizeName(c));
      if (!k) continue;
      if (k === filterKey) return true;
      if (k.length >= 4 && filterKey.length >= 4 &&
          (k.includes(filterKey) || filterKey.includes(k))) {
        return true;
      }
    }
    return false;
  }

  scheduleFitBounds(): void {
    window.clearTimeout(this.fitBoundsTimer);
    this.fitBoundsTimer = window.setTimeout(() => {
      this.fitBoundsTimer = undefined;
      this.fitBounds();
    }, 120);
  }

  private fitBounds(): void {
    const gmap = this.mapComponent?.googleMap;
    if (!gmap) return;
    if (!this.aos.length) {
      gmap.setCenter(this.mapCenter);
      gmap.setZoom(10);
      return;
    }
    if (this.aos.length === 1) {
      gmap.setCenter(this.aos[0].position);
      gmap.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const a of this.aos) bounds.extend(a.position);
    const PAD = 28;
    gmap.fitBounds(bounds, {top: PAD, bottom: PAD, left: PAD, right: PAD});
    google.maps.event.addListenerOnce(gmap, 'idle', () => {
      const z = gmap.getZoom();
      if (z !== undefined && z > 15) gmap.setZoom(15);
    });
  }
}

/** Collapse to lowercase alphanumerics for forgiving AO name matching. */
function slugifyAoKey(raw: string): string {
  return raw.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]/g, '');
}
