import {Component, OnInit} from '@angular/core';
import {
  BOISE_REGION_IDS,
  CreateOrUpdateEventRequest,
  F3ApiService,
  F3Event,
} from 'src/app/services/f3-api.service';

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
  regionId: number;
  name: string;
  address: string;
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
  newAoForm = {name: '', regionId: BOISE_REGION_IDS.cityOfTrees as number};
  private pendingLatLng: google.maps.LatLngLiteral|null = null;

  readonly eventTypes = EVENT_TYPES;
  readonly boiseRegions = [
    {id: BOISE_REGION_IDS.cityOfTrees, name: 'City of Trees'},
    {id: BOISE_REGION_IDS.settlers,    name: 'Settlers'},
    {id: BOISE_REGION_IDS.highDesert,  name: 'High Desert'},
    {id: BOISE_REGION_IDS.canyon,      name: 'Canyon'},
  ];

  readonly mapCenter: google.maps.LatLngLiteral = {lat: 43.615, lng: -116.35};
  readonly mapOptions: google.maps.MapOptions = {
    zoom: 11,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  };

  private geocoder!: google.maps.Geocoder;

  constructor(private readonly f3Api: F3ApiService) {}

  async ngOnInit() {
    this.geocoder = new google.maps.Geocoder();
    try {
      const {events} = await this.f3Api.listEvents();
      this.aos = this.groupEvents(events);
      this.loading = false;
      this.geocodeAll();
    } catch (e: any) {
      this.error = e.message ?? 'Failed to load events';
      this.loading = false;
    }
  }

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
      const address = first.location ||
          [first.locationAddress, first.locationCity, first.locationState]
              .filter(Boolean).join(', ');

      const regionPick = this.pickBoiseRegion(evts);
      return {
        locationId,
        regionId: regionPick.id,
        name: aoName,
        address,
        region: regionPick.name,
        description: first.description,
        eventTypes: Array.from(allEventTypes),
        days,
      };
    });
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

  private aoIdForPayload(ev: F3Event|null|undefined, fallbackLocationId: number): number {
    const parent = ev?.parents?.[0]?.parentId;
    if (parent != null && parent > 0) return parent;
    if (ev?.locationId) return ev.locationId;
    return fallbackLocationId;
  }

  // ── Geocoding ────────────────────────────────────────────────────

  private geocodeAll() {
    for (const ao of this.aos) {
      if (ao.address) this.geocodeAo(ao);
    }
  }

  private geocodeAo(ao: GroupedAo) {
    this.geocoder.geocode({address: ao.address + ', Idaho, USA'}, (results, status) => {
      if (status === 'OK' && results?.length) {
        const loc = results[0].geometry.location;
        ao.position = {lat: loc.lat(), lng: loc.lng()};
        ao.markerOptions = this.buildMarkerOptions(ao);
        // Trigger change detection by reassigning the array reference
        this.aos = [...this.aos];
      }
    });
  }

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
    this.newAoForm = {name: '', regionId: BOISE_REGION_IDS.cityOfTrees};
    this.newAoModalOpen = true;
  }

  closeNewAoModal() {
    this.newAoModalOpen = false;
    this.pendingLatLng = null;
  }

  createNewAo() {
    const name = this.newAoForm.name.trim();
    if (!name || !this.pendingLatLng) return;

    const region = this.boiseRegions.find(r => r.id === this.newAoForm.regionId);
    const newAo: GroupedAo = {
      locationId: 0,
      regionId: this.newAoForm.regionId,
      name,
      address: '',
      region: region?.name ?? '',
      description: '',
      eventTypes: [],
      days: DAYS.map((dayName, i) => ({dayIndex: i, dayName, event: null})),
      position: this.pendingLatLng!,
    };
    newAo.markerOptions = this.buildMarkerOptions(newAo);

    this.aos = [...this.aos, newAo];
    this.selectedAo = newAo;
    this.pendingLatLng = null;
    this.newAoModalOpen = false;
  }

  onMarkerClick(ao: GroupedAo) {
    this.selectedAo = ao;
    this.closeModal();
  }

  clearSelection() {
    this.selectedAo = null;
    this.closeModal();
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
      this.dayForm = this.emptyForm();
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
        aoId: this.aoIdForPayload(ev, ao.locationId),
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
      const locationId = ev?.locationId ?? ao.locationId;
      const body: CreateOrUpdateEventRequest = {
        ...(ev?.id ? {id: ev.id} : {}),
        aoId: this.aoIdForPayload(ev, ao.locationId),
        regionId: this.regionIdForPayload(ev, ao),
        locationId,
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
