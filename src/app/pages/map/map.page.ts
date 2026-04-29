import {Component, OnInit, ViewChild} from '@angular/core';
import {AlertController, ToastController} from '@ionic/angular';
import {
  BOISE_REGION_IDS,
  CreateOrUpdateEventRequest,
  F3ApiService,
  F3Event,
  F3Location,
  F3Org,
} from 'src/app/services/f3-api.service';
import {GoogleMap} from '@angular/google-maps';

interface NewAoForm {
  name: string;
  regionId: number;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export const EVENT_TYPES = [
  {id: 1, name: 'Bootcamp'},
  {id: 2, name: 'Run'},
  {id: 3, name: 'Ruck'},
  {id: 9, name: 'Wild Card'},
  {id: 21, name: 'Run/Ruck'},
];

export interface AoDay {
  dayIndex: number;
  dayName: string;
  event: F3Event|null;
}

export interface GroupedAo {
  locationId: number;
  orgId?: number;  // org ID returned from POST /v1/org; used as aoId in event payloads
  /** AO org ID from events API parents chain when present */
  parentAoId?: number;
  regionId: number;
  name: string;
  /** Formatted address for display */
  address: string;
  /** Structured address parts for editing */
  addressStreet?: string;
  addressCity?: string;
  addressZip?: string;
  region: string;
  description: string;
  eventTypes: string[];
  days: AoDay[];
  position?: google.maps.LatLngLiteral;
  markerOptions?: google.maps.MarkerOptions;
}

export interface DayForm {
  enabled: boolean;
  name: string;
  startTime: string;
  endTime: string;
  eventTypeId: number;
}

@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
})
export class MapPage implements OnInit {
  loading = true;
  error: string|null = null;
  aos: GroupedAo[] = [];
  selectedAo: GroupedAo|null = null;

  // Day editing state
  editingDay: AoDay|null = null;
  modalOpen = false;
  dayForm: DayForm = this.emptyForm();
  saving = false;
  deleting = false;
  saveError: string|null = null;

  // New AO state
  newAoModalOpen = false;
  creatingAo = false;
  createAoError: string|null = null;
  newAoForm: NewAoForm = this.emptyNewAoForm();
  private pendingLatLng: google.maps.LatLngLiteral|null = null;

  // AO detail inline editing
  isEditingAo = false;
  aoEditName = '';
  aoEditDescription = '';
  aoEditAddressStreet = '';
  aoEditAddressCity = '';
  aoEditAddressZip = '';
  aoSaving = false;
  aoSaveError: string|null = null;
  isDeletingAo = false;

  readonly eventTypes = EVENT_TYPES;
  readonly boiseRegions = [
    {id: BOISE_REGION_IDS.cityOfTrees, name: 'City of Trees'},
    {id: BOISE_REGION_IDS.settlers,    name: 'Settlers'},
    {id: BOISE_REGION_IDS.highDesert,  name: 'High Desert'},
    {id: BOISE_REGION_IDS.canyon,      name: 'Canyon'},
  ];

  readonly mapCenter: google.maps.LatLngLiteral = {lat: 43.615, lng: -116.35};
  /** Omit zoom — `fitBounds` sets viewport; avoids fighting programmatic fitting. */
  readonly mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  };

  @ViewChild('mapRef')
  private readonly mapComponent?: GoogleMap;

  /** Coalesce rapid pin updates from parallel geocoder callbacks */
  private fitBoundsTimer?: number;

  private geocoder!: google.maps.Geocoder;

  constructor(
      private readonly f3Api: F3ApiService,
      private readonly alertController: AlertController,
      private readonly toastController: ToastController,
  ) {}

  async ngOnInit() {
    this.geocoder = new google.maps.Geocoder();
    try {
      const boiseRegionIds = Object.values(BOISE_REGION_IDS) as number[];
      const [{events}, {orgs}, regionalLocs, mineLocs] = await Promise.all([
        this.f3Api.listEvents({pageSize: 500}),
        this.f3Api.listOrgs({orgTypes: ['ao'], onlyMine: true, pageSize: 200}),
        this.f3Api.listLocations({regionIds: boiseRegionIds, pageSize: 500}),
        // AO locations we created can have regionId = AO org id (not Boise metro IDs)
        // and are omitted from regional list — merge onlyMine coords for pin placement.
        this.f3Api.listLocations({onlyMine: true, pageSize: 500}),
      ]);

      const locations = this.mergeLocationsById(regionalLocs.locations, mineLocs.locations);

      this.aos = this.mergeAll(events, orgs, locations);
      this.loading = false;
      this.geocodeAll();
    } catch (e: any) {
      this.error = e.message ?? 'Failed to load events';
      this.loading = false;
    }
  }

  // ── Grouping ────────────────────────────────────────────────────

  // ── Grouping ────────────────────────────────────────────────────

  private groupEvents(events: F3Event[]): GroupedAo[] {
    const byLocation = new Map<number, F3Event[]>();
    for (const event of events) {
      const group = byLocation.get(event.locationId) ?? [];
      group.push(event);
      byLocation.set(event.locationId, group);
    }

    return Array.from(byLocation.entries()).map(([locationId, evts]) => {
      const first = evts[0];
      const dayMap = new Map<number, F3Event>();
      for (const ev of evts) {
        const idx = DAY_INDEX[ev.dayOfWeek.toLowerCase()];
        if (idx !== undefined && !dayMap.has(idx)) dayMap.set(idx, ev);
      }

      const days: AoDay[] = DAYS.map((dayName, i) => ({
        dayIndex: i, dayName, event: dayMap.get(i) ?? null,
      }));

      const allEventTypes = new Set<string>();
      for (const ev of evts) {
        for (const et of (ev.eventTypes ?? [])) allEventTypes.add(et.eventTypeName);
      }

      const aoName = first.locationName || first.name;
      // Prefer structured address for maps; prose-only location strings (e.g. "meet near
      // Gem Island…") confuse Geocoder — "Gem Island" can resolve outside Idaho.
      const structuredAddress = [
        first.locationAddress,
        first.locationCity,
        first.locationState,
        first.locationZip,
      ].filter(Boolean).join(', ');
      const address =
          structuredAddress || first.location ||
          '';

      let parentAoId: number|undefined;
      for (const ev of evts) {
        const p = ev.parents?.[0]?.parentId;
        if (p != null && p > 0) {
          parentAoId = p;
          break;
        }
      }

      const regionPick = this.pickBoiseRegion(evts);
      return {
        locationId,
        parentAoId,
        regionId: regionPick.id,
        name: aoName,
        address,
        addressStreet: first.locationAddress || undefined,
        addressCity: first.locationCity || undefined,
        addressZip: first.locationZip || undefined,
        region: regionPick.name,
        description: first.description,
        eventTypes: Array.from(allEventTypes),
        days,
      };
    });
  }

  /**
   * Merges two location arrays; second array overwrites duplicates by id
   * (onlyMine payloads can include rows missing from regional-filter lists).
   */
  private mergeLocationsById(a: F3Location[], b: F3Location[]): F3Location[] {
    const map = new Map<number, F3Location>();
    for (const loc of a) map.set(loc.id, loc);
    for (const loc of b) map.set(loc.id, loc);
    return Array.from(map.values());
  }

  /**
   * Merges event-based AOs with orgs/locations that have no events yet.
   * Orgs fetched via onlyMine give us AOs we own; locations supply lat/lng directly.
   */
  private mergeAll(events: F3Event[], orgs: F3Org[], locations: F3Location[]): GroupedAo[] {
    const eventAos = this.groupEvents(events);

    // Index locations and event-based AOs for quick lookup
    const locationById = new Map(locations.map(l => [l.id, l]));
    const eventLocationIds = new Set(eventAos.map(a => a.locationId));
    const boiseRegionIds = new Set<number>(Object.values(BOISE_REGION_IDS));

    const emptyAos: GroupedAo[] = [];
    for (const org of orgs) {
      if (!boiseRegionIds.has(org.parentId)) continue;  // AO not under Boise metros

      const locId = org.defaultLocationId;
      if (!locId) continue;
      if (eventLocationIds.has(locId)) continue;  // already represented

      const loc = locationById.get(locId);
      if (!loc) continue;
      // Do not gate on loc.regionId — new locations sometimes use AO org id as regionId.

      const address = [loc.addressStreet, loc.addressCity, loc.addressState]
          .filter(Boolean).join(', ');

      const parentRegion = this.boiseRegions.find(r => r.id === org.parentId);

      const ao: GroupedAo = {
        locationId: locId,
        orgId: org.id,
        regionId: org.parentId,
        name: org.name,
        address,
        addressStreet: loc.addressStreet || undefined,
        addressCity: loc.addressCity || undefined,
        addressZip: loc.addressZip || undefined,
        region: parentRegion?.name ?? loc.regionName,
        description: org.description ?? '',
        eventTypes: [],
        days: DAYS.map((dayName, i) => ({dayIndex: i, dayName, event: null})),
      };

      // Use lat/lng directly — no geocoding needed
      if (loc.latitude && loc.longitude) {
        ao.position = {lat: loc.latitude, lng: loc.longitude};
        ao.markerOptions = this.buildMarkerOptions(ao);
      }

      emptyAos.push(ao);
    }

    // Canonical coordinates from Locations API override Geocoder for events at that id
    for (const ao of eventAos) {
      const loc = locationById.get(ao.locationId);
      if (
        loc?.latitude != null &&
        loc.longitude != null &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
      ) {
        ao.position = {lat: loc.latitude!, lng: loc.longitude!};
        ao.markerOptions = this.buildMarkerOptions(ao);
      }
    }

    return [...eventAos, ...emptyAos];
  }

  /** Prefer a Boise-area region; API may list other metros first. */
  private pickBoiseRegion(evts: F3Event[]): {id: number; name: string} {
    const allowed = new Set<number>(Object.values(BOISE_REGION_IDS));
    for (const ev of evts) {
      for (const r of ev.regions ?? []) {
        if (allowed.has(r.regionId)) {
          return {id: r.regionId, name: r.regionName};
        }
      }
    }
    const r0 = evts[0].regions?.[0];
    return {id: r0?.regionId ?? 0, name: r0?.regionName ?? ''};
  }

  /** Region id for POST: prefer a Boise id on the event; never pick a random `regions[0]`. */
  private regionIdForPayload(ev: F3Event|null|undefined, fallbackAo: GroupedAo): number {
    const allowed = new Set<number>(Object.values(BOISE_REGION_IDS));
    if (ev?.regions?.length) {
      const hit = ev.regions.find(r => allowed.has(r.regionId));
      if (hit) return hit.regionId;
    }
    return fallbackAo.regionId;
  }

  private aoIdForPayload(ev: F3Event|null|undefined, ao: GroupedAo): number {
    const parent = ev?.parents?.[0]?.parentId;
    if (parent != null && parent > 0) return parent;
    if (ev?.locationId) return ev.locationId;
    // For freshly-created AOs, use the org ID (not locationId) as aoId
    if (ao.orgId) return ao.orgId;
    return ao.locationId;
  }

  // ── Geocoding ────────────────────────────────────────────────────

  private geocodeAll() {
    for (const ao of this.aos) {
      if (ao.position) continue;  // Locations API coords or newly created AO coords
      if (ao.address) this.geocodeAo(ao);
    }
  }

  private geocodeAo(ao: GroupedAo) {
    this.geocoder.geocode({address: ao.address + ', Idaho, USA'}, (
        results: google.maps.GeocoderResult[]|null,
        status: string,
        ) => {
      if (status === 'OK' && results?.length) {
        const loc = results[0].geometry.location;
        ao.position = {lat: loc.lat(), lng: loc.lng()};
        ao.markerOptions = this.buildMarkerOptions(ao);
        // Trigger change detection by reassigning the array reference
        this.aos = [...this.aos];
        this.scheduleFitMapToPins();
      }
    });
  }

  /** Fit viewport to every pin (as zoomed as possible subject to fitting all markers). */
  scheduleFitMapToPins(): void {
    window.clearTimeout(this.fitBoundsTimer);
    this.fitBoundsTimer = window.setTimeout(() => {
      this.fitBoundsTimer = undefined;
      this.fitMapToPins();
    }, 170);
  }

  private fitMapToPins(): void {
    const gmap = this.mapComponent?.googleMap;
    if (!gmap) return;

    const coords = this.aos
        .filter(
            (ao): ao is GroupedAo&{position: google.maps.LatLngLiteral} => !!ao.position,
        )
        .map(ao => ao.position);
    if (coords.length === 0) return;

    const PAD = 56;

    if (coords.length === 1) {
      gmap.setCenter(coords[0]);
      gmap.setZoom(MapPage.SINGLE_AO_ZOOM);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    coords.forEach(c => bounds.extend(c));

    gmap.fitBounds(bounds, {top: PAD, bottom: PAD, left: PAD, right: PAD});
    google.maps.event.addListenerOnce(gmap, 'idle', () => {
      const z = gmap.getZoom();
      if (z !== undefined && z > MapPage.MULTI_PIN_MAX_ZOOM) {
        gmap.setZoom(MapPage.MULTI_PIN_MAX_ZOOM);
      }
    });
  }

  private static readonly SINGLE_AO_ZOOM = 14;
  /** Keeps clustered markers visible when overlapping pins inflate zoom */
  private static readonly MULTI_PIN_MAX_ZOOM = 17;

  // Per-day colors matching maps.html
  private static readonly DAY_COLORS = [
    '#c084fc',  // Sunday    — purple
    '#ff6b6b',  // Monday    — red
    '#4ecdc4',  // Tuesday   — teal
    '#45b7d1',  // Wednesday — blue
    '#96ceb4',  // Thursday  — green
    '#f0a500',  // Friday    — amber
    '#ff9ff3',  // Saturday  — pink
  ];

  private static readonly DAY_ABBREVS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

  private buildMarkerOptions(ao: GroupedAo): google.maps.MarkerOptions {
    const activeDays = ao.days.filter(d => d.event);

    if (activeDays.length === 0) {
      // "New / empty" pin — a simple circle with a + sign
      const SIZE = 32, CARET_H = 7, totalH = SIZE + CARET_H;
      const cx = SIZE / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${totalH}">
  <circle cx="${cx}" cy="${cx}" r="${cx - 1.5}" fill="#2196f3" stroke="white" stroke-width="2"
          style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))"/>
  <text x="${cx}" y="${cx + 5}" font-size="18" font-weight="700" fill="white"
        text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">+</text>
  <path d="M${cx - 5} ${SIZE} L${cx} ${totalH} L${cx + 5} ${SIZE} Z" fill="#2196f3"/>
</svg>`;
      return {
        title: ao.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(SIZE, totalH),
          anchor: new google.maps.Point(cx, totalH),
        },
      };
    }

    const n = activeDays.length;
    const PILL_W = 24, PILL_H = 20, PAD = 3, GAP = 2, CARET_H = 7;
    const boxW = n * PILL_W + (n - 1) * GAP + PAD * 2;
    const boxH = PILL_H + PAD * 2;
    const totalH = boxH + CARET_H;

    return {
      title: ao.name,
      icon: {
        url: this.buildMarkerSvgUri(activeDays, {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP, CARET_H}),
        scaledSize: new google.maps.Size(boxW, totalH),
        anchor: new google.maps.Point(boxW / 2, totalH),
      },
    };
  }

  /**
   * Generates an SVG callout marker: one colored pill per active day,
   * with a downward-pointing caret anchored at the location point.
   */
  private buildMarkerSvgUri(
      activeDays: AoDay[],
      dim: {boxW: number, boxH: number, totalH: number, PILL_W: number, PILL_H: number, PAD: number, GAP: number, CARET_H: number},
      ): string {
    const {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP, CARET_H} = dim;

    const pills = activeDays.map((d, i) => {
      const color = MapPage.DAY_COLORS[d.dayIndex] ?? '#aaa';
      const abbrev = MapPage.DAY_ABBREVS[d.dayIndex];
      const x = PAD + i * (PILL_W + GAP);
      const y = PAD;
      const cx = x + PILL_W / 2;
      return `<rect x="${x}" y="${y}" width="${PILL_W}" height="${PILL_H}" rx="4" fill="${color}"/>` +
          `<text x="${cx}" y="${y + 14}" font-size="9.5" font-weight="700" fill="white" ` +
          `text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${abbrev}</text>`;
    }).join('');

    // Caret: gray outline triangle then white-fill triangle to simulate a border
    const cx = boxW / 2;
    const caretOuter =
        `M${cx - 7} ${boxH} L${cx} ${totalH} L${cx + 7} ${boxH} Z`;
    const caretInner =
        `M${cx - 5} ${boxH - 1} L${cx} ${totalH - 2} L${cx + 5} ${boxH - 1} Z`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${totalH}">
  <rect width="${boxW}" height="${boxH}" rx="6" fill="white" stroke="#ccc" stroke-width="1.5"
        style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.18))"/>
  ${pills}
  <path d="${caretOuter}" fill="#ccc"/>
  <path d="${caretInner}" fill="white"/>
</svg>`;

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // ── Selection ────────────────────────────────────────────────────

  onMapClick(event: google.maps.MapMouseEvent) {
    if (this.modalOpen || this.newAoModalOpen) return;
    const latLng = event.latLng?.toJSON();
    if (!latLng) return;
    this.pendingLatLng = latLng;
    this.newAoForm = this.emptyNewAoForm();
    this.createAoError = null;
    this.newAoModalOpen = true;
  }

  closeNewAoModal() {
    if (this.creatingAo) return;
    this.newAoModalOpen = false;
    this.pendingLatLng = null;
    this.createAoError = null;
  }

  async createNewAo() {
    const name = this.newAoForm.name.trim();
    if (!name || !this.pendingLatLng) return;
    this.creatingAo = true;
    this.createAoError = null;

    try {
      // Step 1: create the org (AO node in the hierarchy)
      const {org} = await this.f3Api.createOrg({
        parentId: this.newAoForm.regionId,
        name,
        isActive: true,
        orgType: 'ao',
        website: 'https://f3boise.com',
        twitter: '',
        facebook: '',
        instagram: '',
      });

      // Step 2: create the location tied to that org
      const {location} = await this.f3Api.createLocation({
        orgId: org.id,
        name,
        isActive: true,
        latitude: this.pendingLatLng!.lat,
        longitude: this.pendingLatLng!.lng,
        ...(this.newAoForm.addressStreet.trim() ? {addressStreet: this.newAoForm.addressStreet.trim()} : {}),
        ...(this.newAoForm.addressCity.trim()   ? {addressCity:   this.newAoForm.addressCity.trim()}   : {}),
        addressState: this.newAoForm.addressState.trim() || 'ID',
        ...(this.newAoForm.addressZip.trim()    ? {addressZip:    this.newAoForm.addressZip.trim()}     : {}),
        addressCountry: 'US',
      });

      // Tie org ↔ default location (API returns defaultLocationId: null until patched)
      await this.f3Api.createOrg({
        id: org.id,
        parentId: this.newAoForm.regionId,
        defaultLocationId: location.id,
        name,
        isActive: true,
        orgType: 'ao',
        website: 'https://f3boise.com',
        twitter: '',
        facebook: '',
        instagram: '',
      });

      const region = this.boiseRegions.find(r => r.id === this.newAoForm.regionId);
      const address = [
        this.newAoForm.addressStreet,
        this.newAoForm.addressCity,
        this.newAoForm.addressState || 'ID',
      ].filter(Boolean).join(', ');

      const newAo: GroupedAo = {
        locationId: location.id,
        orgId: org.id,
        regionId: this.newAoForm.regionId,
        name,
        address,
        region: region?.name ?? '',
        description: '',
        eventTypes: [],
        days: DAYS.map((dayName, i) => ({dayIndex: i, dayName, event: null})),
        position: this.pendingLatLng!,
      };
      newAo.markerOptions = this.buildMarkerOptions(newAo);

      this.aos = [...this.aos, newAo];
      this.scheduleFitMapToPins();
      this.selectedAo = newAo;
      this.pendingLatLng = null;
      this.newAoModalOpen = false;
    } catch (e: any) {
      this.createAoError = e.message ?? 'Failed to create AO';
    } finally {
      this.creatingAo = false;
    }
  }

  onMarkerClick(ao: GroupedAo) {
    this.selectedAo = ao;
    this.isEditingAo = false;
    this.aoSaveError = null;
    this.closeModal();
  }

  clearSelection() {
    this.selectedAo = null;
    this.isEditingAo = false;
    this.closeModal();
  }

  // ── AO detail editing ─────────────────────────────────────────────

  startAoEdit() {
    if (!this.selectedAo) return;
    this.aoEditName = this.selectedAo.name;
    this.aoEditDescription = this.selectedAo.description;
    this.aoEditAddressStreet = this.selectedAo.addressStreet ?? '';
    this.aoEditAddressCity = this.selectedAo.addressCity ?? '';
    this.aoEditAddressZip = this.selectedAo.addressZip ?? '';
    this.aoSaveError = null;
    this.isEditingAo = true;
  }

  cancelAoEdit() {
    this.isEditingAo = false;
    this.aoSaveError = null;
  }

  async saveAoDetails() {
    if (!this.selectedAo) return;
    const ao = this.selectedAo;
    const orgId = ao.orgId ?? ao.parentAoId;
    const name = this.aoEditName.trim();
    if (!name) return;

    this.aoSaving = true;
    this.aoSaveError = null;

    try {
      if (orgId) {
        await this.f3Api.createOrg({
          id: orgId,
          parentId: ao.regionId,
          name,
          description: this.aoEditDescription.trim(),
          isActive: true,
          orgType: 'ao',
          website: 'https://f3boise.com',
          twitter: '',
          facebook: '',
          instagram: '',
        });
      }

      if (ao.locationId) {
        await this.f3Api.createLocation({
          id: ao.locationId,
          orgId: orgId ?? ao.locationId,
          name,
          isActive: true,
          ...(this.aoEditAddressStreet.trim() ? {addressStreet: this.aoEditAddressStreet.trim()} : {}),
          ...(this.aoEditAddressCity.trim()   ? {addressCity:   this.aoEditAddressCity.trim()}   : {}),
          addressState: 'ID',
          ...(this.aoEditAddressZip.trim()    ? {addressZip:    this.aoEditAddressZip.trim()}     : {}),
          addressCountry: 'US',
        });
      }

      // Patch local state
      ao.name = name;
      ao.description = this.aoEditDescription.trim();
      ao.addressStreet = this.aoEditAddressStreet.trim() || undefined;
      ao.addressCity = this.aoEditAddressCity.trim() || undefined;
      ao.addressZip = this.aoEditAddressZip.trim() || undefined;
      ao.address = [ao.addressStreet, ao.addressCity, 'ID', ao.addressZip]
          .filter(Boolean).join(', ');
      if (ao.position) ao.markerOptions = this.buildMarkerOptions(ao);
      this.aos = [...this.aos];
      this.isEditingAo = false;
    } catch (e: any) {
      this.aoSaveError = e.message ?? 'Failed to save changes';
    } finally {
      this.aoSaving = false;
    }
  }

  async confirmDeleteAo() {
    if (!this.selectedAo || this.isDeletingAo) return;
    const ao = this.selectedAo;
    const activeEvents = ao.days.filter(d => d.event);
    const n = activeEvents.length;
    const eventLine = n > 0
        ? `${n} workout event${n !== 1 ? 's' : ''} at this location`
        : 'no scheduled events';

    const alert = await this.alertController.create({
      header: 'Remove AO?',
      message:
          `This will permanently deactivate the AO org, its location, and ${eventLine}. ` +
          `This cannot be undone.`,
      buttons: [
        {text: 'Cancel', role: 'cancel'},
        {
          text: 'Remove AO',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: () => { this.deleteAo(); },
        },
      ],
    });
    await alert.present();
  }

  private async deleteAo() {
    if (!this.selectedAo || this.isDeletingAo) return;
    const ao = this.selectedAo;
    const orgId = ao.orgId ?? ao.parentAoId;
    this.isDeletingAo = true;
    this.aoSaveError = null;

    try {
      // 1. Deactivate all events at this location
      for (const day of ao.days) {
        const ev = day.event;
        if (!ev) continue;
        await this.f3Api.createOrUpdateEvent({
          id: ev.id,
          aoId: this.aoIdForPayload(ev, ao),
          regionId: this.regionIdForPayload(ev, ao),
          locationId: ev.locationId ?? ao.locationId,
          eventTypeIds: ev.eventTypes?.map(t => t.eventTypeId) ?? [1],
          name: ev.name,
          description: ev.description,
          isActive: false,
          isPrivate: ev.isPrivate,
          highlight: false,
          startDate: ev.startDate,
          dayOfWeek: ev.dayOfWeek,
          startTime: ev.startTime,
          endTime: ev.endTime,
        });
      }

      // 2. Deactivate the org
      if (orgId) {
        await this.f3Api.createOrg({
          id: orgId,
          parentId: ao.regionId,
          name: ao.name,
          isActive: false,
          orgType: 'ao',
          twitter: '',
          facebook: '',
          instagram: '',
        });
      }

      // 3. Deactivate the location
      if (ao.locationId) {
        await this.f3Api.createLocation({
          id: ao.locationId,
          orgId: orgId ?? ao.locationId,
          name: ao.name,
          isActive: false,
        });
      }

      // Remove from local list and clear selection
      this.aos = this.aos.filter(a => a.locationId !== ao.locationId);
      this.selectedAo = null;
      this.isEditingAo = false;
      this.scheduleFitMapToPins();

      const toast = await this.toastController.create({
        message: `${ao.name} has been removed.`,
        duration: 3000,
        color: 'dark',
        position: 'bottom',
      });
      await toast.present();
    } catch (e: any) {
      this.aoSaveError = e.message ?? 'Failed to remove AO';
    } finally {
      this.isDeletingAo = false;
    }
  }

  // ── Day edit ─────────────────────────────────────────────────────

  openDayEdit(day: AoDay) {
    this.editingDay = day;
    this.saveError = null;
    this.modalOpen = true;
    if (day.event) {
      const tid = day.event.eventTypes?.[0]?.eventTypeId;
      this.dayForm = {
        enabled: true,
        name: day.event.name,
        startTime: this.apiTimeToInput(day.event.startTime),
        endTime: this.apiTimeToInput(day.event.endTime),
        eventTypeId: tid != null ? Number(tid) : 1,
      };
    } else {
      this.dayForm = {...this.emptyForm(), name: this.selectedAo?.name ?? ''};
    }
  }

  closeModal() {
    this.modalOpen = false;
    this.editingDay = null;
    this.saveError = null;
  }

  async deleteDay() {
    if (!this.selectedAo || !this.editingDay?.event) return;
    this.deleting = true;
    this.saveError = null;

    const ao = this.selectedAo;
    const day = this.editingDay;
    const ev = day.event!;

    try {
      await this.f3Api.createOrUpdateEvent({
        id: ev.id,
        aoId: this.aoIdForPayload(ev, ao),
        regionId: this.regionIdForPayload(ev, ao),
        locationId: ev.locationId ?? ao.locationId,
        eventTypeIds: ev.eventTypes?.map(t => t.eventTypeId) ?? [1],
        name: ev.name,
        description: ev.description,
        isActive: false,
        isPrivate: ev.isPrivate,
        highlight: false,
        startDate: ev.startDate,
        dayOfWeek: ev.dayOfWeek,
        startTime: ev.startTime,
        endTime: ev.endTime,
      });

      day.event = null;
      if (ao.position) ao.markerOptions = this.buildMarkerOptions(ao);
      this.aos = [...this.aos];
      this.closeModal();
    } catch (e: any) {
      this.saveError = e.message ?? 'Delete failed';
    } finally {
      this.deleting = false;
    }
  }

  async saveDay() {
    if (!this.selectedAo || !this.editingDay) return;
    this.saving = true;
    this.saveError = null;

    const ao = this.selectedAo;
    const day = this.editingDay;

    try {
      const ev = day.event;
      const body: CreateOrUpdateEventRequest = {
        ...(ev?.id ? {id: ev.id} : {}),
        aoId: this.aoIdForPayload(ev, ao),
        regionId: this.regionIdForPayload(ev, ao),
        locationId: ev?.locationId ?? ao.locationId,
        eventTypeIds: [Number(this.dayForm.eventTypeId)],
        name: this.dayForm.name.trim(),
        description: ev?.description ?? ao.description,
        isActive: true,
        isPrivate: false,
        highlight: false,
        startDate: ev?.startDate ?? new Date().toISOString().slice(0, 10),
        dayOfWeek: day.dayName.toLowerCase(),
        startTime: this.inputTimeToApi(this.dayForm.startTime),
        endTime: this.inputTimeToApi(this.dayForm.endTime),
      };

      const {event: saved} = await this.f3Api.createOrUpdateEvent(body);
      day.event = this.mergeEventAfterSave(saved, Number(this.dayForm.eventTypeId));

      // If this is a freshly-placed AO (no real locationId yet), patch it from the API response
      if (ao.locationId === 0 && saved.locationId) {
        ao.locationId = saved.locationId;
      }

      const typeName = EVENT_TYPES.find(t => t.id === Number(this.dayForm.eventTypeId))?.name ?? '';
      if (typeName && !ao.eventTypes.includes(typeName)) ao.eventTypes.push(typeName);

      const rPick = this.pickBoiseRegion(
          ao.days.map(d => d.event).filter((e): e is F3Event => !!e),
      );
      if (rPick.id) {
        ao.regionId = rPick.id;
        ao.region = rPick.name || ao.region;
      }

      // Refresh marker color/label after schedule change
      if (ao.position) ao.markerOptions = this.buildMarkerOptions(ao);

      this.aos = [...this.aos];
      this.closeModal();
    } catch (e: any) {
      this.saveError = e.message ?? 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private emptyForm(): DayForm {
    return {enabled: false, name: '', startTime: '05:15', endTime: '06:00', eventTypeId: 1};
  }

  private emptyNewAoForm(): NewAoForm {
    return {
      name: '',
      regionId: BOISE_REGION_IDS.cityOfTrees,
      addressStreet: '',
      addressCity: 'Boise',
      addressState: 'ID',
      addressZip: '',
    };
  }

  /**
   * POST /event often returns an event without `eventTypes`. Fill from the type
   * we just submitted so the next open/edit doesn't default the dropdown to Bootcamp.
   */
  private mergeEventAfterSave(saved: F3Event, submittedTypeId: number): F3Event {
    if (saved.eventTypes?.length) return saved;
    const name =
        EVENT_TYPES.find(t => t.id === submittedTypeId)?.name ?? 'Bootcamp';
    return {
      ...saved,
      eventTypes: [{
        eventTypeId: submittedTypeId,
        eventTypeName: name,
        eventCategory: 'first_f',
      }],
    };
  }

  private apiTimeToInput(time: string): string {
    const p = time.padStart(4, '0');
    return `${p.slice(0, 2)}:${p.slice(2)}`;
  }

  /** Converts `<input type="time">` value → F3 API "HHMM". */
  private inputTimeToApi(time: string): string {
    if (!time) return '0000';
    // Browsers may emit "HH:MM" or "HH:MM:SS" — never use replace(':', '') once.
    const [h = '0', m = '0'] = time.trim().split(':');
    return `${h.padStart(2, '0')}${m.padStart(2, '0')}`;
  }

  formatTime(time: string): string {
    if (!time || time.length < 4) return time;
    const p = time.padStart(4, '0');
    const h = parseInt(p.slice(0, 2), 10);
    const mins = p.slice(2);
    return `${h % 12 || 12}:${mins} ${h >= 12 ? 'PM' : 'AM'}`;
  }
}
