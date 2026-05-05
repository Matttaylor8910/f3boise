import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {GoogleMap} from '@angular/google-maps';
import {AlertController, PopoverController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {Subscription} from 'rxjs';
import {ActionsPopoverPageComponent} from 'src/app/components/actions-popover/actions-popover-page.component';
import {PopoverAction,} from 'src/app/components/actions-popover/actions-popover.component';
import {BOISE_REGION_IDS, CreateOrUpdateEventRequest, F3_REGION_WEBSITE_URL, F3ApiService, F3Event, F3Location, F3Org,} from 'src/app/services/f3-api.service';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';
import {MapPermissions, UserPermissionsService} from 'src/app/services/user-permissions.service';

interface NewAoForm {
  name: string;
  regionId: number;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}

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
  orgId?: number;  // org ID returned from POST /v1/org; used as aoId in event
                   // payloads
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
  /** True when the AO's next scheduled workout date has a closure in the Q lineup */
  closedNextDate?: boolean;
}

export interface AoUpcomingClosure {
  date: string;
  displayDate: string;
  text: string|null;
}

/**
 * Narrow shape for `/event` POST id resolution. Every `GroupedAo` is
 * assignable.
 */
type AoPayloadContext = Pick<GroupedAo, 'locationId'>&
    Partial<Pick<GroupedAo, 'orgId'|'parentAoId'|'regionId'>>;

export interface DayForm {
  enabled: boolean;
  name: string;
  /** `/event` description — distinct from AO org description */
  description: string;
  startTime: string;
  endTime: string;
  eventTypeId: number;
}

// ── Region tree (inspection / cleanup view) ───────────────────────

export interface TreeEvent {
  id: number;
  name: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  eventTypeName: string;
}

export interface TreeAo {
  orgId: number;
  name: string;
  events: TreeEvent[];
  /** Whether current user may rename this AO from the region tree */
  permRenameAo: boolean;
  /** Whether current user may delete/deactivate this AO (region gate) */
  permDeleteAo: boolean;
}

export interface TreeLocation {
  locationId: number;
  /** Boise metro region id — same semantics as {@link GroupedAo.regionId}. */
  regionId: number;
  /**
   * The org that owns this location — required for API update/deactivate
   * calls.
   */
  orgId: number;
  displayName: string;
  address: string;
  lat: number|null;
  lng: number|null;
  aos: TreeAo[];
  expanded: boolean;
  /** Edit shared location record (every AO at pin must be editable) */
  permEditLocation: boolean;
  /** Delete/deactivate entire location pin */
  permDeleteLocation: boolean;
}

export interface TreeRegion {
  regionId: number;
  regionName: string;
  locations: TreeLocation[];
  expanded: boolean;
}

/** Boise AO org row not covered by normal event/location merge (no location, etc.). */
interface OrphanOrgPlacement {
  readonly org: F3Org;
  readonly locationId: number;
  readonly loc: F3Location|undefined;
  readonly isSyntheticLocation: boolean;
}

@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
})
export class MapPage implements OnInit, OnDestroy {
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

  // Region tree (inspection view)
  regionTree: TreeRegion[] = [];
  // Raw data for tree mutations and reload
  private rawEvents: F3Event[] = [];
  private rawOrgs: F3Org[] = [];
  private rawLocations: F3Location[] = [];
  /** Set in {@link mergeAll} for {@link buildRegionTree} orphan rows. */
  private lastOrphanPlacements: OrphanOrgPlacement[] = [];

  // Tree inline edit state
  editingAoId: number|null = null;
  aoEditNameTree = '';
  aoEditNameSaving = false;
  treeActionError: string|null = null;

  // New AO state
  newAoModalOpen = false;
  creatingAo = false;
  createAoError: string|null = null;
  newAoForm: NewAoForm = this.emptyNewAoForm();
  private pendingLatLng: google.maps.LatLngLiteral|null = null;

  // AO / location edit modals (detail panel)
  aoMetaModalOpen = false;
  locationEditModalOpen = false;
  /** Modal target when editing from sidebar or region tree */
  locationEditModalLocationId: number|null = null;
  /** Boise region id for permission checks when saving location edits */
  locationEditModalRegionId: number|null = null;
  locationEditTreeOrgId: number|null = null;
  aoEditLocationName = '';
  aoEditName = '';
  aoEditDescription = '';
  aoEditAddressStreet = '';
  aoEditAddressCity = '';
  aoEditAddressZip = '';
  aoSaving = false;
  aoSaveError: string|null = null;
  isDeletingAo = false;

  /** Upcoming closure dates for the currently selected AO */
  selectedAoClosures: AoUpcomingClosure[] = [];
  /** Whether the very next scheduled date for the selected AO is closed */
  selectedAoNextDateClosed = false;
  /** AO whose marker was last tinted red — reset on deselect */
  private prevClosedAo: GroupedAo|null = null;

  readonly eventTypes = EVENT_TYPES;
  readonly boiseRegions = [
    {id: BOISE_REGION_IDS.cityOfTrees, name: 'City of Trees'},
    {id: BOISE_REGION_IDS.settlers, name: 'Settlers'},
    {id: BOISE_REGION_IDS.highDesert, name: 'High Desert'},
    {id: BOISE_REGION_IDS.canyon, name: 'Canyon'},
  ];

  /** Current user's effective permissions — updated reactively. */
  permissions: MapPermissions|null = null;
  private permSub?: Subscription;

  /** Detail panel — synced when selection or permissions change (no template helpers). */
  detailEditAoTitle = false;
  detailDeleteAo = false;
  detailEditLocation = false;
  detailEditSchedule = false;
  detailShowOverflowMenu = false;

  /** Regions listed in New AO modal — filtered from {@link permissions}. */
  newAoRegionOptions: ReadonlyArray<{id: number; name: string}> = [];

  mapCenter: google.maps.LatLngLiteral = {lat: 43.615, lng: -116.35};
  /**
   * Omit zoom — `fitBounds` sets viewport; avoids fighting programmatic
   * fitting.
   */
  readonly mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  };

  @ViewChild('mapRef') private readonly mapComponent?: GoogleMap;

  /** Coalesce rapid pin updates from parallel geocoder callbacks */
  private fitBoundsTimer?: number;
  /** Invalidates running eased camera animations when a new target is chosen */
  private cameraAnimationSeq = 0;

  private geocoder!: google.maps.Geocoder;

  constructor(
      private readonly f3Api: F3ApiService,
      private readonly alertController: AlertController,
      private readonly toastController: ToastController,
      private readonly popoverController: PopoverController,
      private readonly userPermissions: UserPermissionsService,
      private readonly qService: QService,
      private readonly utilService: UtilService,
  ) {}

  async ngOnInit() {
    this.geocoder = new google.maps.Geocoder();
    this.permSub =
        this.userPermissions.mapPermissions$.subscribe(p => {
          this.permissions = p;
          this.syncPermissionDerivedViews();
        });
    await this.loadData();
  }

  ngOnDestroy(): void {
    this.permSub?.unsubscribe();
  }

  // ── Permission-derived view fields (synced; avoid getters/functions in templates)

  /** Shared location row — requires edit rights on every AO org at this pin. */
  private canEditSharedLocationRecord(regionId: number, locationId: number): boolean {
    const p = this.permissions;
    if (!p) return false;
    const orgIds = this.orgIdsAtLocation(locationId);
    if (orgIds.length === 0) {
      return p.canDeleteAo({regionId});
    }
    return orgIds.every(oid =>
        p.canEditAo({
          regionId,
          orgId: oid,
          parentAoId: oid,
        }));
  }

  /** AO org ids sharing this physical location (pin). */
  private orgIdsAtLocation(locationId: number): number[] {
    const ids = new Set<number>();
    for (const o of this.rawOrgs) {
      if (o.defaultLocationId === locationId) ids.add(o.id);
    }
    for (const e of this.rawEvents) {
      if (e.locationId !== locationId) continue;
      const pid = e.parents?.[0]?.parentId;
      if (pid) ids.add(pid);
    }
    return [...ids];
  }

  private patchRegionTreePermissions(): void {
    const p = this.permissions;
    for (const region of this.regionTree) {
      for (const loc of region.locations) {
        if (!p) {
          loc.permEditLocation = false;
          loc.permDeleteLocation = false;
          for (const ao of loc.aos) {
            ao.permRenameAo = false;
            ao.permDeleteAo = false;
          }
          continue;
        }
        loc.permEditLocation =
            loc.locationId > 0 &&
            this.canEditSharedLocationRecord(loc.regionId, loc.locationId);
        loc.permDeleteLocation = loc.locationId > 0 &&
            p.canDeleteAo({regionId: loc.regionId});
        for (const ao of loc.aos) {
          ao.permRenameAo = p.canEditAo({
            regionId: loc.regionId,
            orgId: ao.orgId,
            parentAoId: ao.orgId,
          });
          ao.permDeleteAo = p.canDeleteAo({regionId: loc.regionId});
        }
      }
    }
  }

  private refreshDetailSelectionVm(): void {
    const ao = this.selectedAo;
    const p = this.permissions;
    if (!ao || !p) {
      this.detailEditAoTitle = false;
      this.detailDeleteAo = false;
      this.detailEditLocation = false;
      this.detailEditSchedule = false;
      this.detailShowOverflowMenu = false;
      return;
    }
    this.detailEditAoTitle = p.canEditAo({
      regionId: ao.regionId,
      orgId: ao.orgId,
      parentAoId: ao.parentAoId,
    });
    this.detailDeleteAo = p.canDeleteAo({regionId: ao.regionId});
    const locOk = ao.locationId > 0;
    this.detailEditLocation =
        locOk && this.canEditSharedLocationRecord(ao.regionId, ao.locationId);
    this.detailEditSchedule = locOk && p.canEditDay({
      regionId: ao.regionId,
      orgId: ao.orgId,
      parentAoId: ao.parentAoId,
    });
    this.detailShowOverflowMenu =
        this.detailEditAoTitle || this.detailEditLocation || this.detailDeleteAo;
  }

  private syncPermissionDerivedViews(): void {
    this.patchRegionTreePermissions();
    this.refreshDetailSelectionVm();
    this.refreshNewAoRegionOptions();
  }

  /** Builds the region dropdown options from {@link permissions}. */
  private refreshNewAoRegionOptions(): void {
    const p = this.permissions;
    if (!p?.canCreate || !p.creatableRegionIds.length) {
      this.newAoRegionOptions = [];
      return;
    }
    const allowed = new Set(p.creatableRegionIds);
    this.newAoRegionOptions =
        this.boiseRegions.filter(r => allowed.has(r.id));
  }

  // ── Legacy bridge removed — templates bind detail* and Tree*.perm* fields only.

  /**
   * Full fetch — only on startup (or explicit refresh). Mutations patch `raw*`
   * and call `rebuildDerivedFromRaw`.
   */
  private async loadData() {
    this.loading = true;
    this.error = null;
    try {
      const boiseRegionIds = Object.values(BOISE_REGION_IDS) as number[];
      const [{events}, {orgs}, regionalLocs, mineLocs] = await Promise.all([
        this.f3Api.listEvents({pageSize: 500}),
        // Fetch all AOs under the Boise metro regions (not just onlyMine) so
        // orphan orgs created by other users are visible and can be managed.
        this.f3Api.listOrgs({
          orgTypes: ['ao'],
          parentOrgIds: boiseRegionIds,
          pageSize: 500,
        }),
        this.f3Api.listLocations({regionIds: boiseRegionIds, pageSize: 500}),
        // AO locations we created can have regionId = AO org id (not Boise
        // metro IDs) and are omitted from regional list — merge onlyMine coords
        // for pin placement.
        this.f3Api.listLocations({onlyMine: true, pageSize: 500}),
      ]);

      const locations =
          this.mergeLocationsById(regionalLocs.locations, mineLocs.locations);

      this.rawEvents = events;
      this.rawOrgs = orgs;
      this.rawLocations = locations;

      this.rebuildDerivedFromRaw(false);
      this.loading = false;
    } catch (e: any) {
      this.error = e.message ?? 'Failed to load events';
      this.loading = false;
    }
  }

  private captureTreeExpansion():
      {regions: Map<number, boolean>; locations: Map<string, boolean>} {
    const regions = new Map<number, boolean>();
    const locs = new Map<string, boolean>();
    for (const r of this.regionTree) {
      regions.set(r.regionId, r.expanded);
      for (const loc of r.locations) {
        locs.set(`${r.regionId}:${loc.locationId}`, loc.expanded);
      }
    }
    return {regions, locations: locs};
  }

  private restoreTreeExpansion(
      snap: {regions: Map<number, boolean>; locations: Map<string, boolean>},
      tree: TreeRegion[],
      ): void {
    for (const r of tree) {
      const re = snap.regions.get(r.regionId);
      if (re !== undefined) r.expanded = re;
      for (const loc of r.locations) {
        const le = snap.locations.get(`${r.regionId}:${loc.locationId}`);
        if (le !== undefined) loc.expanded = le;
      }
    }
  }

  /** Recompute map pins + region tree from in-memory raw API rows. No HTTP. */
  private rebuildDerivedFromRaw(preserveExpansion: boolean) {
    const snap = preserveExpansion ? this.captureTreeExpansion() : null;
    const sel = this.selectedAo;

    this.aos = this.mergeAll(this.rawEvents, this.rawOrgs, this.rawLocations);
    this.regionTree =
        this.buildRegionTree(this.rawEvents, this.rawOrgs, this.rawLocations);
    if (snap) this.restoreTreeExpansion(snap, this.regionTree);

    if (sel) {
      const match = this.findGroupedAoInList(this.aos, sel);
      if (match)
        this.selectedAo = match;
      else {
        this.selectedAo = null;
        this.closeDetailEditModals();
        this.closeModal();
      }
    }

    this.syncPermissionDerivedViews();
    this.geocodeAll();
    this.scheduleFitMapToPins();
  }

  private findGroupedAoInList(
      list: GroupedAo[],
      snapshot: Pick<GroupedAo, 'locationId'>&
      Partial<Pick<GroupedAo, 'orgId'|'parentAoId'>>,
      ): GroupedAo|undefined {
    const oid = snapshot.orgId ?? snapshot.parentAoId;
    const atLoc = list.filter(a => a.locationId === snapshot.locationId);
    if (!atLoc.length) return undefined;
    if (oid != null && oid > 0) {
      const hit = atLoc.find(a => a.orgId === oid || a.parentAoId === oid);
      if (hit) return hit;
    }
    return atLoc[0];
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
                                       dayIndex: i,
                                       dayName,
                                       event: dayMap.get(i) ?? null,
                                     }));

      const allEventTypes = new Set<string>();
      for (const ev of evts) {
        for (const et of (ev.eventTypes ?? []))
          allEventTypes.add(et.eventTypeName);
      }

      const aoName = first.locationName || first.name;
      // Prefer structured address for maps; prose-only location strings (e.g.
      // "meet near Gem Island…") confuse Geocoder — "Gem Island" can resolve
      // outside Idaho.
      const structuredAddress = [
        first.locationAddress,
        first.locationCity,
        first.locationState,
        first.locationZip,
      ].filter(Boolean).join(', ');
      const address = structuredAddress || first.location || '';

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

  private collectEmptyAoRows(
      orgs: F3Org[],
      locationById: Map<number, F3Location>,
      eventLocationIds: Set<number>,
      ): GroupedAo[] {
    const emptyAos: GroupedAo[] = [];
    const boiseRegionIds = new Set<number>(Object.values(BOISE_REGION_IDS));

    for (const org of orgs) {
      if (!boiseRegionIds.has(org.parentId)) continue;

      const locId = org.defaultLocationId;
      if (!locId) continue;
      if (eventLocationIds.has(locId)) continue;

      const loc = locationById.get(locId);
      if (!loc) continue;

      const address = [
        loc.addressStreet, loc.addressCity, loc.addressState
      ].filter(Boolean).join(', ');

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

      if (loc.latitude && loc.longitude) {
        ao.position = {lat: loc.latitude, lng: loc.longitude};
        ao.markerOptions = this.buildMarkerOptions(ao);
      }

      emptyAos.push(ao);
    }

    return emptyAos;
  }

  /**
   * AOs that never appear in {@link groupEvents} or {@link collectEmptyAoRows}
   * (e.g. no `defaultLocationId`, or location row missing from the API).
   */
  private computeOrphanOrgPlacements(
      orgs: F3Org[],
      eventAos: GroupedAo[],
      emptyAos: GroupedAo[],
      locationById: Map<number, F3Location>,
      eventLocationIds: Set<number>,
      ): OrphanOrgPlacement[] {
    const coveredOrgIds = new Set<number>();
    for (const a of [...eventAos, ...emptyAos]) {
      if (a.orgId != null && a.orgId > 0) coveredOrgIds.add(a.orgId);
      if (a.parentAoId != null && a.parentAoId > 0)
        coveredOrgIds.add(a.parentAoId);
    }

    const boiseRegionIds = new Set<number>(Object.values(BOISE_REGION_IDS));
    const out: OrphanOrgPlacement[] = [];

    for (const org of orgs) {
      if (!boiseRegionIds.has(org.parentId)) continue;
      if (coveredOrgIds.has(org.id)) continue;

      const lid = org.defaultLocationId;
      if (lid != null && lid > 0) {
        if (eventLocationIds.has(lid)) continue;
        out.push({
          org,
          locationId: lid,
          loc: locationById.get(lid),
          isSyntheticLocation: false,
        });
      } else {
        out.push({
          org,
          locationId: -org.id,
          loc: undefined,
          isSyntheticLocation: true,
        });
      }
    }

    return out;
  }

  private groupedAoFromOrphanPlacement(p: OrphanOrgPlacement): GroupedAo {
    const {org, locationId, loc, isSyntheticLocation} = p;
    const parentRegion = this.boiseRegions.find(r => r.id === org.parentId);

    let address: string;
    if (isSyntheticLocation) {
      address = '(no location on file — assign a location or delete this AO)';
    } else if (loc) {
      address = [
        loc.addressStreet, loc.addressCity, loc.addressState
      ].filter(Boolean).join(', ');
    } else {
      address =
          `(location id ${locationId} not returned by API — you can still delete the AO)`;
    }

    const ao: GroupedAo = {
      locationId,
      orgId: org.id,
      regionId: org.parentId,
      name: org.name,
      address,
      addressStreet: loc?.addressStreet || undefined,
      addressCity: loc?.addressCity || undefined,
      addressZip: loc?.addressZip || undefined,
      region: parentRegion?.name ?? '',
      description: org.description ?? '',
      eventTypes: [],
      days: DAYS.map((dayName, i) => ({dayIndex: i, dayName, event: null})),
    };

    if (loc?.latitude && loc.longitude) {
      ao.position = {lat: loc.latitude, lng: loc.longitude};
      ao.markerOptions = this.buildMarkerOptions(ao);
    }

    return ao;
  }

  /**
   * Merges event-based AOs with orgs/locations that have no events yet, plus
   * orphan org rows (no location / missing location record) so they stay
   * visible in the sidebar and detail panel.
   */
  private mergeAll(events: F3Event[], orgs: F3Org[], locations: F3Location[]):
      GroupedAo[] {
    const eventAos = this.groupEvents(events);
    const locationById = new Map(locations.map(l => [l.id, l]));
    const eventLocationIds = new Set(eventAos.map(a => a.locationId));
    const emptyAos =
        this.collectEmptyAoRows(orgs, locationById, eventLocationIds);
    this.lastOrphanPlacements = this.computeOrphanOrgPlacements(
        orgs, eventAos, emptyAos, locationById, eventLocationIds);
    const orphanAos = this.lastOrphanPlacements.map(
        p => this.groupedAoFromOrphanPlacement(p));

    for (const ao of eventAos) {
      const loc = locationById.get(ao.locationId);
      if (loc?.latitude != null && loc.longitude != null &&
          loc.latitude !== 0 && loc.longitude !== 0) {
        ao.position = {lat: loc.latitude!, lng: loc.longitude!};
        ao.markerOptions = this.buildMarkerOptions(ao);
      }
    }

    return [...eventAos, ...emptyAos, ...orphanAos];
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

  /**
   * Region id for POST: prefer Boise on the event; fall back to context; last
   * resort default region.
   */
  private regionIdForPayload(
      ev: F3Event|null|undefined, fallback: AoPayloadContext): number {
    const allowed = new Set<number>(Object.values(BOISE_REGION_IDS));
    if (ev?.regions?.length) {
      const hit = ev.regions.find(r => allowed.has(r.regionId));
      if (hit) return hit.regionId;
    }
    if (fallback.regionId && allowed.has(fallback.regionId))
      return fallback.regionId;
    return BOISE_REGION_IDS.cityOfTrees;
  }

  /**
   * aoId MUST be the AO org id — never `locationId`.
   * Order: event parent → ctx org ids → org whose defaultLocationId is this
   * location.
   */
  private aoIdForPayload(ev: F3Event|null|undefined, ctx: AoPayloadContext):
      number {
    const fromEvent = ev?.parents?.[0]?.parentId;
    if (fromEvent != null && fromEvent > 0) return fromEvent;

    const fromAo = ctx.orgId ?? ctx.parentAoId;
    if (fromAo != null && fromAo > 0) return fromAo;

    const fromOrgAtLocation =
        this.rawOrgs.find(o => o.defaultLocationId === ctx.locationId)?.id;
    if (fromOrgAtLocation != null && fromOrgAtLocation > 0)
      return fromOrgAtLocation;

    throw new Error(
        'Cannot save workout: missing AO org id for this location. Try reopening the AO from the map.',
    );
  }

  /**
   * Prefer `event.locationId` when positive; skip `0` from bad API payloads
   * (use ctx).
   */
  private locationIdForPayload(
      ev: F3Event|null|undefined, ctx: AoPayloadContext): number {
    const fromEv = ev?.locationId;
    const lid = fromEv != null && fromEv > 0 ? fromEv : ctx.locationId;
    if (!lid || lid <= 0) {
      throw new Error('Cannot save workout: missing location id.');
    }
    return lid;
  }

  private eventIdsForMutation(
      ev: F3Event|null|undefined, ctx: AoPayloadContext):
      {aoId: number; regionId: number; locationId: number;} {
    return {
      aoId: this.aoIdForPayload(ev, ctx),
      regionId: this.regionIdForPayload(ev, ctx),
      locationId: this.locationIdForPayload(ev, ctx),
    };
  }

  private payloadContextFromTreeLocation(
      loc: TreeLocation, sampleEv?: F3Event|null): AoPayloadContext {
    const picked = sampleEv ? this.pickBoiseRegion([sampleEv]) : null;
    const allowed = new Set<number>(Object.values(BOISE_REGION_IDS));
    const regionId = picked?.id && allowed.has(picked.id) ?
        picked.id :
        BOISE_REGION_IDS.cityOfTrees;
    return {locationId: loc.locationId, regionId};
  }

  /**
   * Tree AO flow: pin org ids to the `TreeAo` row; region from a sample raw
   * event when present.
   */
  private payloadContextFromTreeAo(
      loc: TreeLocation,
      treeAo: TreeAo,
      sampleEv?: F3Event|null,
      ): AoPayloadContext {
    return {
      ...this.payloadContextFromTreeLocation(loc, sampleEv),
      orgId: treeAo.orgId,
      parentAoId: treeAo.orgId,
    };
  }

  // ── Region tree ──────────────────────────────────────────────────

  private buildRegionTree(
      events: F3Event[], orgs: F3Org[], locations: F3Location[]): TreeRegion[] {
    const boiseRegionIdSet = new Set<number>(this.boiseRegions.map(r => r.id));
    const locationById = new Map(locations.map(l => [l.id, l]));

    // Group events by locationId → Map<orgId, events[]>
    const eventsByLocOrg = new Map<string, F3Event[]>();
    const eventsByLocation = new Map<number, F3Event[]>();
    for (const ev of events) {
      const orgId = ev.parents?.[0]?.parentId ?? 0;
      const key = `${ev.locationId}:${orgId}`;
      const evList = eventsByLocOrg.get(key) ?? [];
      evList.push(ev);
      eventsByLocOrg.set(key, evList);

      const locList = eventsByLocation.get(ev.locationId) ?? [];
      locList.push(ev);
      eventsByLocation.set(ev.locationId, locList);
    }

    // Determine Boise region for each relevant locationId
    const locationToRegion = new Map<number, number>();
    for (const loc of locations) {
      if (boiseRegionIdSet.has(loc.regionId)) {
        locationToRegion.set(loc.id, loc.regionId);
      }
    }
    // Fallback: org's parentId for locations whose regionId is non-standard
    for (const org of orgs) {
      if (!boiseRegionIdSet.has(org.parentId)) continue;
      if (org.defaultLocationId &&
          !locationToRegion.has(org.defaultLocationId)) {
        locationToRegion.set(org.defaultLocationId, org.parentId);
      }
    }
    // Fallback: event's regions array
    for (const [locId, evs] of eventsByLocation) {
      if (!locationToRegion.has(locId)) {
        for (const ev of evs) {
          const r = ev.regions?.find(r => boiseRegionIdSet.has(r.regionId));
          if (r) {
            locationToRegion.set(locId, r.regionId);
            break;
          }
        }
      }
    }

    // Collect all relevant locationIds (from events + org.defaultLocationId)
    const allLocIds = new Set<number>(locationToRegion.keys());
    for (const org of orgs) {
      if (org.defaultLocationId &&
          locationToRegion.has(org.defaultLocationId)) {
        allLocIds.add(org.defaultLocationId);
      }
    }

    // Build region → TreeLocation map
    const regionMap = new Map<number, Map<number, TreeLocation>>(
        this.boiseRegions.map(r => [r.id, new Map()]));

    for (const locId of allLocIds) {
      const regionId = locationToRegion.get(locId);
      if (!regionId) continue;
      const regionLocs = regionMap.get(regionId);
      if (!regionLocs) continue;

      const loc = locationById.get(locId);
      const parts = [
        loc?.addressStreet, loc?.addressCity, loc?.addressState
      ].filter(Boolean);
      const address = parts.join(', ');

      // Build AO map for this location
      const aoMap = new Map<number, TreeAo>();

      // Seed from orgs that default to this location (captures AOs with no
      // events)
      for (const org of orgs) {
        if (org.defaultLocationId === locId) {
          aoMap.set(org.id, {
            orgId: org.id,
            name: org.name,
            events: [],
            permRenameAo: false,
            permDeleteAo: false,
          });
        }
      }

      // Populate events
      for (const [key, evs] of eventsByLocOrg) {
        const [kLoc, kOrg] = key.split(':').map(Number);
        if (kLoc !== locId) continue;
        const orgId = kOrg;
        const firstName =
            evs[0]?.parents?.[0]?.parentName ?? evs[0]?.name ?? `AO ${orgId}`;
        if (!aoMap.has(orgId)) {
          aoMap.set(orgId, {
            orgId,
            name: firstName,
            events: [],
            permRenameAo: false,
            permDeleteAo: false,
          });
        }
        const ao = aoMap.get(orgId)!;
        for (const ev of evs) {
          ao.events.push({
            id: ev.id,
            name: ev.name,
            dayOfWeek: ev.dayOfWeek ?? '',
            startTime: ev.startTime ?? '',
            endTime: ev.endTime ?? '',
            eventTypeName: ev.eventTypes?.[0]?.eventTypeName ?? '',
          });
        }
      }

      // Sort events within each AO by day
      for (const ao of aoMap.values()) {
        ao.events.sort(
            (a, b) => (DAY_INDEX[a.dayOfWeek?.toLowerCase()] ?? 7) -
                (DAY_INDEX[b.dayOfWeek?.toLowerCase()] ?? 7));
      }

      regionLocs.set(locId, {
        locationId: locId,
        regionId,
        // Prefer an org that explicitly points to this location; fall back to
        // loc.regionId (which for newly-created AOs is the AO org id).
        orgId: orgs.find(o => o.defaultLocationId === locId)?.id ??
            loc?.regionId ?? locId,
        displayName: loc?.locationName ?? '',
        address,
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        aos: Array.from(aoMap.values())
                 .sort((a, b) => a.name.localeCompare(b.name)),
        expanded: false,
        permEditLocation: false,
        permDeleteLocation: false,
      });
    }

    for (const p of this.lastOrphanPlacements) {
      const {org, locationId, loc, isSyntheticLocation} = p;
      const regionId = org.parentId;
      const regionLocs = regionMap.get(regionId);
      if (!regionLocs) continue;

      const address = loc ?
          [
            loc.addressStreet, loc.addressCity, loc.addressState
          ].filter(Boolean).join(', ') :
          '';

      const displayName = (loc?.locationName?.trim()) ||
          (isSyntheticLocation ?
               '(no location)' :
               `Location ${locationId} (missing)`);

      const treeAo: TreeAo = {
        orgId: org.id,
        name: org.name,
        events: [],
        permRenameAo: false,
        permDeleteAo: false,
      };

      const existing = regionLocs.get(locationId);
      if (existing) {
        if (!existing.aos.some(a => a.orgId === org.id)) {
          existing.aos.push(treeAo);
          existing.aos.sort((a, b) => a.name.localeCompare(b.name));
        }
      } else {
        regionLocs.set(locationId, {
          locationId,
          regionId,
          orgId: org.id,
          displayName,
          address,
          lat: loc?.latitude ?? null,
          lng: loc?.longitude ?? null,
          aos: [treeAo],
          expanded: false,
          permEditLocation: false,
          permDeleteLocation: false,
        });
      }
    }

    return this.boiseRegions.map(
        r => ({
          regionId: r.id,
          regionName: r.name,
          locations:
              Array.from(regionMap.get(r.id)?.values() ?? [])
                  .sort(
                      (a, b) => this.treeLocationSortKey(a).localeCompare(
                          this.treeLocationSortKey(b),
                          undefined,
                          {sensitivity: 'base'},
                          ),
                      ),
          expanded: true,
        }));
  }

  selectTreeAo(ao: TreeAo, loc: TreeLocation) {
    const match = this.aos.find(
        a => (a.orgId === ao.orgId || a.parentAoId === ao.orgId) &&
            a.locationId === loc.locationId);
    if (match) {
      this.selectAo(match);
    } else if (loc.lat !== null && loc.lng !== null) {
      this.animateCameraToPoint(loc.lat, loc.lng);
    }
  }

  /**
   * Expand / focus a tree location row without changing zoom — avoids fighting
   * `fitBounds` zoom pulses.
   */
  panToLocation(loc: TreeLocation) {
    if (loc.lat !== null && loc.lng !== null) {
      this.panMapPreserveZoom(loc.lat, loc.lng);
    }
  }

  /**
   * Smooth pan only; preserves current zoom (for marker taps we skip camera
   * entirely).
   */
  private panMapPreserveZoom(lat: number, lng: number): void {
    const gmap = this.mapComponent?.googleMap;
    if (!gmap) return;
    gmap.panTo({lat, lng});
    google.maps.event.addListenerOnce(
        gmap, 'idle', () => this.syncMapCenterFromNativeMap(gmap));
  }

  /**
   * Alphabetical sort key for region tree rows: the sole AO name when exactly
   * one AO; otherwise location name (covers 0 or 2+ AOs at the pin).
   */
  private treeLocationSortKey(loc: TreeLocation): string {
    if (loc.aos.length === 1) {
      const aoName = loc.aos[0]?.name?.trim();
      if (aoName) return aoName;
    }
    return loc.displayName?.trim() ?? '';
  }

  /**
   * When a pin has exactly one AO, the tree lists that AO name instead of the
   * location row label.
   */
  treeLocationHeaderLabel(loc: TreeLocation): string {
    return this.treeLocationSortKey(loc) || '— unnamed —';
  }

  treeLocationHeaderIsUnnamed(loc: TreeLocation): boolean {
    return !this.treeLocationSortKey(loc);
  }

  onTreeLocationRowClick(loc: TreeLocation): void {
    if (loc.aos.length === 1) {
      const ao = loc.aos[0];
      if (ao) this.selectTreeAo(ao, loc);
      return;
    }
    loc.expanded = !loc.expanded;
    this.panToLocation(loc);
  }

  /**
   * When the row shows a single AO, second line: location roster name if it
   * differs from the AO title.
   */
  treeLocationSubtitleSingleAo(loc: TreeLocation): string {
    if (loc.aos.length !== 1) return '';
    const locName = loc.displayName?.trim() ?? '';
    if (!locName) return '';
    const aoName = loc.aos[0]?.name?.trim();
    if (!aoName) return '';
    if (locName.localeCompare(aoName, undefined, {sensitivity: 'base'}) === 0) {
      return '';
    }
    return locName;
  }

  // ── Tree: rename AO ──────────────────────────────────────────────

  startEditAoName(ao: TreeAo, loc: TreeLocation, event: Event) {
    event.stopPropagation();
    if (!ao.permRenameAo) return;
    this.editingAoId = ao.orgId;
    this.aoEditNameTree = ao.name;
    this.treeActionError = null;
  }

  cancelEditAoName() {
    this.editingAoId = null;
    this.aoEditNameTree = '';
    this.treeActionError = null;
  }

  async saveAoName(ao: TreeAo, loc: TreeLocation, event: Event) {
    event.stopPropagation();
    if (!ao.permRenameAo) return;
    const name = this.aoEditNameTree.trim();
    if (!name) return;
    this.aoEditNameSaving = true;
    this.treeActionError = null;
    try {
      const rawOrg = this.rawOrgs.find(o => o.id === ao.orgId);
      await this.f3Api.createOrg({
        id: ao.orgId,
        parentId: rawOrg?.parentId ?? Object.values(BOISE_REGION_IDS)[0],
        name,
        description: rawOrg?.description ?? '',
        isActive: true,
        orgType: 'ao',
        website: F3_REGION_WEBSITE_URL,
        twitter: '',
        facebook: '',
        instagram: '',
      });
      this.editingAoId = null;
      const o = this.rawOrgs.find(r => r.id === ao.orgId);
      if (o) o.name = name;
      for (const ev of this.rawEvents) {
        const ps = ev.parents;
        if (ps?.length && ps[0].parentId === ao.orgId) {
          ps[0] = {...ps[0], parentName: name};
        }
      }
      this.rebuildDerivedFromRaw(true);
    } catch (e: any) {
      this.treeActionError = e.message ?? 'Failed to rename AO';
    } finally {
      this.aoEditNameSaving = false;
    }
  }

  async confirmDeleteLocation(loc: TreeLocation, event: Event) {
    event.stopPropagation();
    if (!loc.permDeleteLocation) return;
    const eventsAtLoc =
        this.rawEvents.filter(e => e.locationId === loc.locationId);
    const orgsAtLoc =
        this.rawOrgs.filter(o => o.defaultLocationId === loc.locationId);
    const n = eventsAtLoc.length;
    const a = orgsAtLoc.length;

    const lines: string[] = [];
    if (a > 0) lines.push(`${a} AO org${a !== 1 ? 's' : ''}`);
    if (n > 0) lines.push(`${n} workout event${n !== 1 ? 's' : ''}`);
    const detail = lines.length ?
        `This will also deactivate ${
            lines.join(' and ')} associated with it. ` :
        '';

    const alert = await this.alertController.create({
      header: 'Delete location?',
      message: `${detail}This cannot be undone.`,
      buttons: [
        {text: 'Cancel', role: 'cancel'},
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: () => {
            this.deleteLocation(loc, eventsAtLoc, orgsAtLoc);
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteLocation(
      loc: TreeLocation, eventsAtLoc: F3Event[], orgsAtLoc: F3Org[]) {
    if (!loc.permDeleteLocation) return;
    this.treeActionError = null;
    try {
      // 1. Deactivate all events at this location
      for (const ev of eventsAtLoc) {
        const ctx = this.payloadContextFromTreeLocation(loc, ev);
        const ids = this.eventIdsForMutation(ev, ctx);
        await this.f3Api.createOrUpdateEvent({
          id: ev.id,
          ...ids,
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
      // 2. Deactivate all orgs pointing to this location
      for (const org of orgsAtLoc) {
        await this.f3Api.createOrg({
          id: org.id,
          parentId: org.parentId,
          name: org.name,
          isActive: false,
          orgType: 'ao',
          website: F3_REGION_WEBSITE_URL,
          twitter: '',
          facebook: '',
          instagram: '',
        });
      }
      // 3. Deactivate the location itself
      await this.f3Api.createLocation({
        id: loc.locationId,
        orgId: loc.orgId,
        name: loc.displayName || `Location ${loc.locationId}`,
        isActive: false,
      });

      const lid = loc.locationId;
      this.rawEvents = this.rawEvents.filter(e => e.locationId !== lid);
      this.rawOrgs = this.rawOrgs.filter(o => o.defaultLocationId !== lid);
      this.rawLocations = this.rawLocations.filter(l => l.id !== lid);
      if (this.selectedAo?.locationId === lid) {
        this.selectedAo = null;
        this.closeDetailEditModals();
        this.closeModal();
      }
      this.rebuildDerivedFromRaw(true);

      const toast = await this.toastController.create({
        message: `Location removed.`,
        duration: 3000,
        color: 'dark',
        position: 'bottom',
      });
      await toast.present();
    } catch (e: any) {
      this.treeActionError = e.message ?? 'Failed to delete location';
    }
  }

  // ── Tree: delete AO org ──────────────────────────────────────────

  async confirmDeleteTreeAo(ao: TreeAo, loc: TreeLocation, event: Event) {
    event.stopPropagation();
    if (!ao.permDeleteAo) return;
    const n = ao.events.length;
    const eventLine =
        n > 0 ? ` and its ${n} workout event${n !== 1 ? 's' : ''}` : '';

    const alert = await this.alertController.create({
      header: 'Delete AO?',
      message: `This will deactivate "${ao.name}"${
          eventLine}. This cannot be undone.`,
      buttons: [
        {text: 'Cancel', role: 'cancel'},
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: () => {
            this.deleteTreeAo(ao, loc);
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteTreeAo(ao: TreeAo, loc: TreeLocation) {
    if (!ao.permDeleteAo) return;
    this.treeActionError = null;
    try {
      // 1. Deactivate all events for this AO
      for (const ev of ao.events) {
        const rawEv = this.rawEvents.find(e => e.id === ev.id);
        if (!rawEv) continue;
        const ctx = this.payloadContextFromTreeAo(loc, ao, rawEv);
        const ids = this.eventIdsForMutation(rawEv, ctx);
        await this.f3Api.createOrUpdateEvent({
          id: rawEv.id,
          ...ids,
          eventTypeIds: rawEv.eventTypes?.map(t => t.eventTypeId) ?? [1],
          name: rawEv.name,
          description: rawEv.description,
          isActive: false,
          isPrivate: rawEv.isPrivate,
          highlight: false,
          startDate: rawEv.startDate,
          dayOfWeek: rawEv.dayOfWeek,
          startTime: rawEv.startTime,
          endTime: rawEv.endTime,
        });
      }
      // 2. Deactivate the org
      if (ao.orgId) {
        const rawOrg = this.rawOrgs.find(o => o.id === ao.orgId);
        await this.f3Api.createOrg({
          id: ao.orgId,
          parentId: rawOrg?.parentId ?? loc.orgId,
          name: ao.name,
          isActive: false,
          orgType: 'ao',
          website: F3_REGION_WEBSITE_URL,
          twitter: '',
          facebook: '',
          instagram: '',
        });
      }

      const lid = loc.locationId;
      const orgIdRemoved = ao.orgId;
      this.rawEvents = this.rawEvents.filter(
          e =>
              !(e.locationId === lid &&
                (e.parents?.[0]?.parentId ?? 0) === orgIdRemoved),
      );
      this.rawOrgs = this.rawOrgs.filter(o => o.id !== orgIdRemoved);

      if (this.selectedAo) {
        const sid = this.selectedAo.orgId ?? this.selectedAo.parentAoId;
        if (this.selectedAo.locationId === lid && sid === orgIdRemoved) {
          this.selectedAo = null;
          this.closeDetailEditModals();
          this.closeModal();
        }
      }

      this.rebuildDerivedFromRaw(true);

      const toast = await this.toastController.create({
        message: `${ao.name} removed.`,
        duration: 3000,
        color: 'dark',
        position: 'bottom',
      });
      await toast.present();
    } catch (e: any) {
      this.treeActionError = e.message ?? 'Failed to delete AO';
    }
  }

  // ── Geocoding ────────────────────────────────────────────────────

  private geocodeAll() {
    for (const ao of this.aos) {
      if (ao.position)
        continue;  // Locations API coords or newly created AO coords
      if (ao.address) this.geocodeAo(ao);
    }
  }

  private geocodeAo(ao: GroupedAo) {
    this.geocoder.geocode(
        {address: ao.address + ', Idaho, USA'},
        (
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

  /**
   * Fit viewport to every pin (as zoomed as possible subject to fitting all
   * markers).
   */
  scheduleFitMapToPins(): void {
    window.clearTimeout(this.fitBoundsTimer);
    this.fitBoundsTimer = window.setTimeout(() => {
      this.fitBoundsTimer = undefined;
      this.fitMapToPins();
    }, 170);
  }

  private fitMapToPins(): void {
    /** Drop any eased `animateCameraToPoint` frames before we fit/refit pins */
    this.cameraAnimationSeq++;

    const gmap = this.mapComponent?.googleMap;
    if (!gmap) return;

    const coords =
        this.aos
            .filter(
                (ao): ao is GroupedAo&{position: google.maps.LatLngLiteral} =>
                    !!ao.position,
                )
            .map(ao => ao.position);
    if (coords.length === 0) return;

    const PAD = 56;

    if (coords.length === 1) {
      this.animateCameraToPoint(coords[0].lat, coords[0].lng);
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
      this.syncMapCenterFromNativeMap(gmap);
    });
  }

  /**
   * Eased pan + zoom for overview → AO: `fitBounds` + `setZoom` on idle snaps
   * abruptly; Google's pattern is many `moveCamera` frames (see
   * move-camera-ease sample).
   */
  private animateCameraToPoint(lat: number, lng: number): void {
    const gmap = this.mapComponent?.googleMap;
    if (!gmap) return;

    const start = gmap.getCenter();
    const z0 = gmap.getZoom();
    if (!start) return;

    const fromLat = start.lat();
    const fromLng = start.lng();
    const fromZoom = z0 ?? MapPage.SINGLE_AO_ZOOM;
    const endZoom = MapPage.SINGLE_AO_ZOOM;

    const token = ++this.cameraAnimationSeq;
    const duration = MapPage.AO_CAMERA_DURATION_MS;
    const tStart = performance.now();

    const move = (camera: google.maps.CameraOptions) => {
      const gm = gmap as google.maps.Map & {
        moveCamera ? (camera: google.maps.CameraOptions) : void;
      };
      if (typeof gm.moveCamera === 'function') {
        gm.moveCamera(camera);
      } else if (camera.center) {
        const c = camera.center;
        const lit = c instanceof google.maps.LatLng ? c.toJSON() : {
          lat: (c as google.maps.LatLngLiteral).lat,
          lng: (c as google.maps.LatLngLiteral).lng
        };
        gmap.setCenter(lit);
        if (camera.zoom !== undefined) {
          gmap.setZoom(Math.round(camera.zoom));
        }
      }
    };

    const frame = (now: number) => {
      if (token !== this.cameraAnimationSeq) return;
      const u = Math.min(1, (now - tStart) / duration);
      const e = MapPage.easeOutCubic(u);
      const clat = fromLat + (lat - fromLat) * e;
      const clng = fromLng + (lng - fromLng) * e;
      const zoom = fromZoom + (endZoom - fromZoom) * e;
      move({
        center: {lat: clat, lng: clng},
        zoom,
        tilt: 0,
        heading: gmap.getHeading?.() ?? 0,
      });
      if (u < 1) {
        requestAnimationFrame(frame);
      } else {
        if (token !== this.cameraAnimationSeq) return;
        move({
          center: {lat, lng},
          zoom: endZoom,
          tilt: 0,
          heading: gmap.getHeading?.() ?? 0,
        });
        this.syncMapCenterFromNativeMap(gmap);
      }
    };
    requestAnimationFrame(frame);
  }

  /**
   * AO selection from overview — slower than default so zoom-in reads as
   * deliberate (Back still uses native `fitBounds`).
   */
  private static readonly AO_CAMERA_DURATION_MS = 1450;

  private static easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3;
  }

  private syncMapCenterFromNativeMap(gmap: google.maps.Map): void {
    const c = gmap.getCenter();
    if (c) this.mapCenter = {lat: c.lat(), lng: c.lng()};
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
    const closed = !!ao.closedNextDate;

    if (activeDays.length === 0) {
      const SIZE = 32, CARET_H = 7, totalH = SIZE + CARET_H;
      const cx = SIZE / 2;
      const fill = closed ? '#e53935' : '#2196f3';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
          SIZE}" height="${totalH}">
  <circle cx="${cx}" cy="${cx}" r="${
          cx - 1.5}" fill="${fill}" stroke="white" stroke-width="2"
          style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))"/>
  <text x="${cx}" y="${cx + 5}" font-size="18" font-weight="700" fill="white"
        text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">+</text>
  <path d="M${cx - 5} ${SIZE} L${cx} ${totalH} L${cx + 5} ${
          SIZE} Z" fill="${fill}"/>
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
        url: this.buildMarkerSvgUri(
            activeDays,
            {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP, CARET_H},
            closed,
        ),
        scaledSize: new google.maps.Size(boxW, totalH),
        anchor: new google.maps.Point(boxW / 2, totalH),
      },
    };
  }

  /**
   * Generates an SVG callout marker: one colored pill per active day,
   * with a downward-pointing caret anchored at the location point.
   * When `closed` is true the outer box is tinted red to signal a closure.
   */
  private buildMarkerSvgUri(
      activeDays: AoDay[],
      dim: {
        boxW: number,
        boxH: number,
        totalH: number,
        PILL_W: number,
        PILL_H: number,
        PAD: number,
        GAP: number,
        CARET_H: number
      },
      closed = false,
      ): string {
    const {boxW, boxH, totalH, PILL_W, PILL_H, PAD, GAP, CARET_H} = dim;

    const pills =
        activeDays
            .map((d, i) => {
              const color = MapPage.DAY_COLORS[d.dayIndex] ?? '#aaa';
              const abbrev = MapPage.DAY_ABBREVS[d.dayIndex];
              const x = PAD + i * (PILL_W + GAP);
              const y = PAD;
              const cx = x + PILL_W / 2;
              return `<rect x="${x}" y="${y}" width="${PILL_W}" height="${
                         PILL_H}" rx="4" fill="${color}"/>` +
                  `<text x="${cx}" y="${
                         y +
                         14}" font-size="9.5" font-weight="700" fill="white" ` +
                  `text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${
                         abbrev}</text>`;
            })
            .join('');

    const boxFill = closed ? '#fff0f0' : 'white';
    const boxStroke = closed ? '#e53935' : '#ccc';
    const caretFill = closed ? '#e53935' : '#ccc';
    const caretInnerFill = closed ? '#fff0f0' : 'white';

    const cx = boxW / 2;
    const caretOuter =
        `M${cx - 7} ${boxH} L${cx} ${totalH} L${cx + 7} ${boxH} Z`;
    const caretInner =
        `M${cx - 5} ${boxH - 1} L${cx} ${totalH - 2} L${cx + 5} ${boxH - 1} Z`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
        boxW}" height="${totalH}">
  <rect width="${boxW}" height="${
        boxH}" rx="6" fill="${boxFill}" stroke="${
        boxStroke}" stroke-width="1.5"
        style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.18))"/>
  ${pills}
  <path d="${caretOuter}" fill="${caretFill}"/>
  <path d="${caretInner}" fill="${caretInnerFill}"/>
</svg>`;

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // ── Selection ────────────────────────────────────────────────────

  onMapClick(event: google.maps.MapMouseEvent) {
    if (this.modalOpen || this.newAoModalOpen) return;
    if (!this.permissions?.canCreate) return;
    const latLng = event.latLng?.toJSON();
    if (!latLng) return;
    this.pendingLatLng = latLng;
    this.newAoForm = this.emptyNewAoForm();
    const opts = this.newAoRegionOptions;
    if (opts.length >= 1) {
      this.newAoForm.regionId = opts[0].id;
    }
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
    const allowed = new Set(this.permissions?.creatableRegionIds ?? []);
    if (!allowed.has(this.newAoForm.regionId)) {
      this.createAoError = 'Choose a region you are allowed to create AOs in.';
      return;
    }
    this.creatingAo = true;
    this.createAoError = null;

    try {
      // Step 1: create the org (AO node in the hierarchy)
      const {org} = await this.f3Api.createOrg({
        parentId: this.newAoForm.regionId,
        name,
        isActive: true,
        orgType: 'ao',
        website: F3_REGION_WEBSITE_URL,
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
        ...(this.newAoForm.addressStreet.trim() ?
                {addressStreet: this.newAoForm.addressStreet.trim()} :
                {}),
        ...(this.newAoForm.addressCity.trim() ?
                {addressCity: this.newAoForm.addressCity.trim()} :
                {}),
        addressState: this.newAoForm.addressState.trim() || 'ID',
        ...(this.newAoForm.addressZip.trim() ?
                {addressZip: this.newAoForm.addressZip.trim()} :
                {}),
        addressCountry: 'US',
      });

      // Tie org ↔ default location (API returns defaultLocationId: null until
      // patched)
      await this.f3Api.createOrg({
        id: org.id,
        parentId: this.newAoForm.regionId,
        defaultLocationId: location.id,
        name,
        isActive: true,
        orgType: 'ao',
        website: F3_REGION_WEBSITE_URL,
        twitter: '',
        facebook: '',
        instagram: '',
      });

      const region =
          this.boiseRegions.find(r => r.id === this.newAoForm.regionId);

      this.rawOrgs.push({
        id: org.id,
        parentId: this.newAoForm.regionId,
        name,
        orgType: 'ao',
        defaultLocationId: location.id,
        isActive: true,
        description: '',
        website: null,
      });

      const street = this.newAoForm.addressStreet.trim();
      const city = this.newAoForm.addressCity.trim();
      const zip = this.newAoForm.addressZip.trim();
      this.rawLocations.push({
        id: location.id,
        locationName: name,
        regionId: org.id,
        regionName: region?.name ?? '',
        description: '',
        isActive: true,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
        addressStreet: street,
        addressCity: city,
        addressState: this.newAoForm.addressState.trim() || 'ID',
        addressZip: zip,
      });

      this.selectedAo = null;
      this.rebuildDerivedFromRaw(false);
      this.selectedAo =
          this.findGroupedAoInList(
              this.aos, {locationId: location.id, orgId: org.id}) ??
          null;

      this.pendingLatLng = null;
      this.newAoModalOpen = false;
    } catch (e: any) {
      this.createAoError = e.message ?? 'Failed to create AO';
    } finally {
      this.creatingAo = false;
    }
  }

  /**
   * Marker on the map — select detail only (camera stays where the user
   * already panned/zoomed).
   */
  onMarkerClick(ao: GroupedAo) {
    this.applyAoSelection(ao);
  }

  /** Region-overview / tree: select AO and fly the camera to it. */
  selectAo(ao: GroupedAo) {
    this.applyAoSelection(ao);
    if (ao.position) {
      this.animateCameraToPoint(ao.position.lat, ao.position.lng);
    }
  }

  private applyAoSelection(ao: GroupedAo): void {
    this.resetPrevClosedAoMarker();
    this.selectedAo = ao;
    this.selectedAoClosures = [];
    this.selectedAoNextDateClosed = false;
    this.closeDetailEditModals();
    this.aoSaveError = null;
    this.closeModal();
    this.refreshDetailSelectionVm();
    void this.loadClosuresForSelectedAo(ao);
  }

  clearSelection() {
    this.resetPrevClosedAoMarker();
    this.selectedAo = null;
    this.selectedAoClosures = [];
    this.selectedAoNextDateClosed = false;
    this.closeDetailEditModals();
    this.aoSaveError = null;
    this.closeModal();
    this.refreshDetailSelectionVm();
    window.clearTimeout(this.fitBoundsTimer);
    this.fitBoundsTimer = undefined;
    this.fitMapToPins();
  }

  /** Restores the previous closed-AO marker back to its normal style. */
  private resetPrevClosedAoMarker(): void {
    const prev = this.prevClosedAo;
    if (!prev) return;
    prev.closedNextDate = false;
    if (prev.position) {
      prev.markerOptions = this.buildMarkerOptions(prev);
      this.aos = [...this.aos];
    }
    this.prevClosedAo = null;
  }

  /** Min ratio for fuzzy AO match on collapsed alphanumeric keys (see {@link aoCollapsedKeysMatch}). */
  private static readonly AO_NAME_MATCH_MIN_SIMILARITY = 0.82;

  /** Collapses an AO label for fuzzy comparison (handles hyphen vs space vs apostrophe drift). */
  private static slugCollapseAoKey(raw: string): string {
    return raw.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]/g, '');
  }

  /** Normalized Levenshtein similarity in [0, 1]. */
  private static levenshteinSimilarity(a: string, b: string): number {
    if (!a.length && !b.length) return 1;
    const maxLen = Math.max(a.length, b.length);
    return 1 - MapPage.levenshteinDistance(a, b) / maxLen;
  }

  private static levenshteinDistance(a: string, b: string): number {
    const n = a.length;
    const m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    const prev = new Array<number>(m + 1);
    const curr = new Array<number>(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      curr[0] = i;
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= m; j++) {
        const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
            curr[j - 1] + 1,
            prev[j] + 1,
            prev[j - 1] + cost,
        );
      }
      for (let j = 0; j <= m; j++) prev[j] = curr[j];
    }
    return prev[m];
  }

  /**
   * Whether two collapsed AO keys refer to the same workout site name.
   * Map/F3Nation strings often diverge from scraper slugs (`camel-back` vs `Camel's Back`).
   */
  private static aoCollapsedKeysMatch(mapKey: string, lineupKey: string): boolean {
    if (!mapKey || !lineupKey) return false;
    if (mapKey === lineupKey) return true;

    const short = mapKey.length <= lineupKey.length ? mapKey : lineupKey;
    const long = mapKey.length <= lineupKey.length ? lineupKey : mapKey;
    // Substring only when the shorter token is long enough to avoid e.g. "gem" inside "gem island park".
    if (short.length >= 6 && long.includes(short)) return true;
    if (short.length >= 4 && long.includes(short) &&
        long.length <= short.length + 3) {
      return true;
    }

    const maxLen = Math.max(mapKey.length, lineupKey.length);
    if (maxLen < 4) return false;

    return MapPage.levenshteinSimilarity(mapKey, lineupKey) >=
        MapPage.AO_NAME_MATCH_MIN_SIMILARITY;
  }

  /**
   * Match grouped AO display labels to a lineup row (`q.ao` is already
   * {@link UtilService.normalizeName}'d by {@link QService}).
   */
  private lineupAoMatchesGroupedAo(lineupAoNormalized: string, ao: GroupedAo): boolean {
    const lineupKey = MapPage.slugCollapseAoKey(lineupAoNormalized);
    if (!lineupKey) return false;

    const candidates = [
      this.utilService.normalizeName(this.detailPanelAoTitle(ao)),
      this.utilService.normalizeName(ao.name),
    ];
    const keys =
        [...new Set(candidates.map(c => MapPage.slugCollapseAoKey(c)).filter(Boolean))];

    return keys.some(mapKey => MapPage.aoCollapsedKeysMatch(mapKey, lineupKey));
  }

  /**
   * Fetches the Q lineup for the next 30 days, finds closures matching this
   * AO by fuzzy name match, and updates the closure banner + marker color.
   */
  private async loadClosuresForSelectedAo(ao: GroupedAo): Promise<void> {
    const FORMAT = 'YYYY-MM-DD';
    const today = moment().format(FORMAT);
    const end = moment().add(30, 'days').format(FORMAT);

    try {
      const lineups = await this.qService.getQLineUp(today, end);

      // Guard: AO may have changed while the request was in flight
      if (this.selectedAo !== ao) return;

      const closures = lineups.filter(q => {
        if (!q.closed) return false;
        return this.lineupAoMatchesGroupedAo(q.ao, ao);
      }).sort((a, b) => a.date.localeCompare(b.date));

      this.selectedAoClosures = closures.map(q => ({
        date: q.date,
        displayDate: moment(q.date).format('ddd, M/D'),
        text: q.text,
      }));

      // Determine whether the AO's very next scheduled date is closed
      const activeDayIndices =
          ao.days.filter(d => d.event).map(d => d.dayIndex);
      if (activeDayIndices.length > 0 && closures.length > 0) {
        const nextDate = this.getNextScheduledDate(activeDayIndices);
        this.selectedAoNextDateClosed =
            !!nextDate && closures.some(q => q.date === nextDate);
      } else {
        this.selectedAoNextDateClosed = false;
      }

      // Tint the marker red when the next workout is cancelled
      if (this.selectedAoNextDateClosed) {
        ao.closedNextDate = true;
        this.prevClosedAo = ao;
        if (ao.position) {
          ao.markerOptions = this.buildMarkerOptions(ao);
          this.aos = [...this.aos];
        }
      }
    } catch {
      // Closure data is informational — silently swallow fetch errors
    }
  }

  /**
   * Returns the next calendar date (YYYY-MM-DD) that falls on one of the
   * given day-of-week indices (0 = Sunday … 6 = Saturday), looking up to
   * 7 days ahead from today.
   */
  private getNextScheduledDate(dayIndices: number[]): string|null {
    const FORMAT = 'YYYY-MM-DD';
    const today = moment().startOf('day');
    for (let i = 0; i <= 7; i++) {
      const d = today.clone().add(i, 'days');
      if (dayIndices.includes(d.day())) {
        return d.format(FORMAT);
      }
    }
    return null;
  }

  // ── AO detail: modals & display helpers ──────────────────────────

  private closeDetailEditModals(): void {
    this.aoMetaModalOpen = false;
    this.locationEditModalOpen = false;
    this.locationEditModalLocationId = null;
    this.locationEditModalRegionId = null;
    this.locationEditTreeOrgId = null;
    this.aoSaveError = null;
  }

  /**
   * Prefer org roster name when we have an AO org id (event rows can mix
   * workout/location naming).
   */
  detailPanelAoTitle(ao: GroupedAo): string {
    const oid = ao.orgId ?? ao.parentAoId;
    if (oid) {
      const o = this.rawOrgs.find(x => x.id === oid);
      if (o?.name?.trim()) return o.name.trim();
    }
    return ao.name;
  }

  /**
   * Sidebar "About" text: AO org `/org` description, not
   * `GroupedAo.description` (that field is seeded from the first *event*
   * workout row and can diverge).
   */
  detailPanelAoAbout(ao: GroupedAo): string {
    const oid = ao.orgId ?? ao.parentAoId;
    const org = oid ? this.rawOrgs.find(x => x.id === oid) : undefined;
    return (org?.description ?? ao.description ?? '').trim();
  }

  /** Location name shown above the address lines. */
  detailPanelLocationLabel(ao: GroupedAo): string {
    const loc = this.rawLocations.find(l => l.id === ao.locationId);
    const firstEv = ao.days.map(d => d.event).find((e): e is F3Event => !!e);
    const n = (loc?.locationName ?? firstEv?.locationName ?? '').trim();
    if (n) return n;
    return this.detailPanelAoTitle(ao);
  }

  private populateLocationFormForLocationId(locationId: number): void {
    const loc = this.rawLocations.find(l => l.id === locationId);
    const eventsHere = this.rawEvents.filter(e => e.locationId === locationId);
    const firstEv = eventsHere[0];
    this.aoEditLocationName =
        (loc?.locationName ?? firstEv?.locationName ?? '').trim();
    this.aoEditAddressStreet =
        loc?.addressStreet ?? firstEv?.locationAddress ?? '';
    this.aoEditAddressCity = loc?.addressCity ?? firstEv?.locationCity ?? '';
    this.aoEditAddressZip = loc?.addressZip ?? firstEv?.locationZip ?? '';
  }

  async openAoDetailMenu(ev: Event): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();
    const actions: PopoverAction[] = [];
    if (this.detailEditAoTitle) {
      actions.push({
        label: 'Edit AO',
        icon: 'create-outline',
        onClick: () => { this.openAoMetaModal(); },
      });
    }
    if (this.detailEditLocation) {
      actions.push({
        label: 'Edit Location',
        icon: 'location-outline',
        onClick: () => { this.openLocationEditModal(); },
      });
    }
    if (this.detailDeleteAo) {
      actions.push({
        label: 'Delete AO',
        icon: 'trash-outline',
        onClick: () => { void this.confirmDeleteAo(); },
      });
    }
    if (!actions.length) return;
    const popover = await this.popoverController.create({
      component: ActionsPopoverPageComponent,
      componentProps: {actions},
      event: ev,
      translucent: true,
      showBackdrop: true,
    });
    await popover.present();
    const {data} = await popover.onDidDismiss<PopoverAction>();
    if (data?.onClick) data.onClick();
  }

  openAoMetaModal(): void {
    const sel = this.selectedAo;
    if (!sel) return;
    if (!this.detailEditAoTitle) return;
    const oid = sel.orgId ?? sel.parentAoId;
    const org = oid ? this.rawOrgs.find(o => o.id === oid) : undefined;
    this.aoEditName = (org?.name ?? this.detailPanelAoTitle(sel)).trim();
    this.aoEditDescription = this.detailPanelAoAbout(sel);
    this.aoSaveError = null;
    this.aoMetaModalOpen = true;
  }

  closeAoMetaModal(): void {
    this.aoMetaModalOpen = false;
    this.aoSaveError = null;
  }

  openLocationEditModal(): void {
    const sel = this.selectedAo;
    if (!sel?.locationId) return;
    if (!this.detailEditLocation) return;
    this.locationEditModalLocationId = sel.locationId;
    this.locationEditModalRegionId = sel.regionId;
    this.locationEditTreeOrgId = null;
    this.populateLocationFormForLocationId(sel.locationId);
    this.aoSaveError = null;
    this.locationEditModalOpen = true;
  }

  /** Region tree pencil — same form as AO detail “location name” edit. */
  openLocationEditModalFromTree(loc: TreeLocation, event?: Event): void {
    event?.stopPropagation?.();
    if (!loc.permEditLocation) return;
    this.locationEditModalLocationId = loc.locationId;
    this.locationEditModalRegionId = loc.regionId;
    this.locationEditTreeOrgId = loc.orgId;
    this.populateLocationFormForLocationId(loc.locationId);
    this.aoSaveError = null;
    this.locationEditModalOpen = true;
  }

  closeLocationEditModal(): void {
    this.locationEditModalOpen = false;
    this.locationEditModalLocationId = null;
    this.locationEditModalRegionId = null;
    this.locationEditTreeOrgId = null;
    this.aoSaveError = null;
  }

  async saveAoMetaFromModal(): Promise<void> {
    if (!this.selectedAo || !this.detailEditAoTitle) return;
    const ao = this.selectedAo;
    const orgId = ao.orgId ?? ao.parentAoId;
    if (!orgId) {
      this.aoSaveError = 'No AO org id is linked to this pin.';
      return;
    }
    const name = this.aoEditName.trim();
    if (!name) return;

    this.aoSaving = true;
    this.aoSaveError = null;

    try {
      await this.f3Api.createOrg({
        id: orgId,
        parentId: ao.regionId,
        name,
        description: this.aoEditDescription.trim(),
        isActive: true,
        orgType: 'ao',
        website: F3_REGION_WEBSITE_URL,
        twitter: '',
        facebook: '',
        instagram: '',
      });

      const o = this.rawOrgs.find(r => r.id === orgId);
      if (o) {
        o.name = name;
        o.description = this.aoEditDescription.trim();
      }
      for (const ev of this.rawEvents) {
        const ps = ev.parents;
        if (ps?.length && ps[0].parentId === orgId)
          ps[0] = {...ps[0], parentName: name};
      }

      this.rebuildDerivedFromRaw(true);
      this.closeAoMetaModal();
    } catch (e: any) {
      this.aoSaveError = e.message ?? 'Failed to save changes';
    } finally {
      this.aoSaving = false;
    }
  }

  async saveLocationFromModal(): Promise<void> {
    const locationId =
        this.locationEditModalLocationId ?? this.selectedAo?.locationId ?? null;
    const regionId = this.locationEditModalRegionId;
    if (!locationId || locationId <= 0 || regionId === null ||
        !this.canEditSharedLocationRecord(regionId, locationId)) {
      this.closeLocationEditModal();
      return;
    }

    const ao = this.selectedAo;
    const locRecord = this.rawLocations.find(l => l.id === locationId);

    const nameFallback =
        (ao ? this.detailPanelAoTitle(ao) : locRecord?.locationName?.trim()) ||
        '';
    const newLocName = this.aoEditLocationName.trim() ||
        locRecord?.locationName?.trim() || nameFallback ||
        `Location ${locationId}`;

    const street = this.aoEditAddressStreet.trim();
    const city = this.aoEditAddressCity.trim();
    const zip = this.aoEditAddressZip.trim();

    const aoOrgFallback = ao ? (ao.orgId ?? ao.parentAoId) : undefined;
    let locOrgId: number;
    if (locRecord) {
      locOrgId =
          this.rawOrgs.find(o => o.defaultLocationId === locationId)?.id ??
          locRecord.regionId;
    } else {
      locOrgId =
          (this.locationEditTreeOrgId && this.locationEditTreeOrgId > 0) ?
          this.locationEditTreeOrgId :
          (aoOrgFallback && aoOrgFallback > 0 ? aoOrgFallback : locationId);
    }

    const locDirty = !locRecord ||
        newLocName !== (locRecord.locationName ?? '').trim() ||
        street !== (locRecord.addressStreet ?? '').trim() ||
        city !== (locRecord.addressCity ?? '').trim() ||
        zip !== (locRecord.addressZip ?? '').trim();

    if (!locDirty) {
      this.closeLocationEditModal();
      return;
    }

    this.aoSaving = true;
    this.aoSaveError = null;

    try {
      await this.f3Api.createLocation({
        id: locationId,
        orgId: locOrgId,
        name: newLocName || `Location ${locationId}`,
        isActive: true,
        ...(street ? {addressStreet: street} : {}),
        ...(city ? {addressCity: city} : {}),
        addressState: 'ID',
        ...(zip ? {addressZip: zip} : {}),
        addressCountry: 'US',
      });

      const L = this.rawLocations.find(l => l.id === locationId);
      if (L) {
        L.locationName = newLocName || L.locationName;
        if (street) L.addressStreet = street;
        if (city) L.addressCity = city;
        if (zip) L.addressZip = zip;
      }
      for (const ev of this.rawEvents) {
        if (ev.locationId === locationId) {
          if (newLocName) ev.locationName = newLocName;
          if (street) ev.locationAddress = street;
          if (city) ev.locationCity = city;
          if (zip) ev.locationZip = zip;
        }
      }

      this.rebuildDerivedFromRaw(true);
      this.closeLocationEditModal();
    } catch (e: any) {
      this.aoSaveError = e.message ?? 'Failed to save location';
    } finally {
      this.aoSaving = false;
    }
  }

  async confirmDeleteAo() {
    if (!this.selectedAo || this.isDeletingAo || !this.detailDeleteAo) return;
    const ao = this.selectedAo;
    const activeEvents = ao.days.filter(d => d.event);
    const n = activeEvents.length;
    const eventLine = n > 0 ?
        `${n} workout event${n !== 1 ? 's' : ''} at this location` :
        'no scheduled events';

    const alert = await this.alertController.create({
      header: 'Delete AO?',
      message:
          `This will permanently deactivate the AO org, its location, and ${
              eventLine}. ` +
          `This cannot be undone.`,
      buttons: [
        {text: 'Cancel', role: 'cancel'},
        {
          text: 'Delete AO',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: () => {
            this.deleteAo();
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteAo() {
    if (!this.selectedAo || this.isDeletingAo || !this.detailDeleteAo) return;
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
          ...this.eventIdsForMutation(ev, ao),
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
          website: F3_REGION_WEBSITE_URL,
          twitter: '',
          facebook: '',
          instagram: '',
        });
      }

      // 3. Deactivate the location (skip synthetic / missing rows: id ≤ 0)
      if (ao.locationId > 0) {
        await this.f3Api.createLocation({
          id: ao.locationId,
          orgId: orgId ?? ao.locationId,
          name: ao.name,
          isActive: false,
        });
      }

      const lid = ao.locationId!;
      const oid = orgId ?? 0;
      if (lid < 0) {
        if (oid > 0) {
          this.rawOrgs = this.rawOrgs.filter(o => o.id !== oid);
        }
        this.rawEvents = this.rawEvents.filter(
            e => (e.parents?.[0]?.parentId ?? 0) !== oid);
      } else {
        this.rawEvents = this.rawEvents.filter(e => e.locationId !== lid);
        this.rawOrgs = this.rawOrgs.filter(o => o.defaultLocationId !== lid);
        this.rawLocations = this.rawLocations.filter(l => l.id !== lid);
      }
      this.selectedAo = null;
      this.closeDetailEditModals();
      this.closeModal();
      this.rebuildDerivedFromRaw(true);

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
    if (!this.detailEditSchedule) return;
    this.editingDay = day;
    this.saveError = null;
    this.modalOpen = true;
    const ao = this.selectedAo;
    if (day.event) {
      const ev = day.event;
      const tid = ev.eventTypes?.[0]?.eventTypeId;
      this.dayForm = {
        enabled: true,
        name: ev.name,
        description: ev.description ?? '',
        startTime: this.apiTimeToInput(ev.startTime),
        endTime: this.apiTimeToInput(ev.endTime),
        eventTypeId: tid != null ? Number(tid) : 1,
      };
    } else {
      this.dayForm = {
        ...this.emptyForm(),
        name: ao ? this.detailPanelAoTitle(ao) : '',
        description: ao ? this.detailPanelAoAbout(ao) : '',
      };
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
        ...this.eventIdsForMutation(ev, ao),
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

      this.rawEvents = this.rawEvents.filter(e => e.id !== ev.id);
      this.rebuildDerivedFromRaw(true);
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
      const ids = this.eventIdsForMutation(ev, ao);
      const aoPayloadId = ids.aoId;
      const lid = ids.locationId;
      const body: CreateOrUpdateEventRequest = {
        ...(ev?.id ? {id: ev.id} : {}),
        aoId: ids.aoId,
        regionId: ids.regionId,
        locationId: ids.locationId,
        eventTypeIds: [Number(this.dayForm.eventTypeId)],
        name: this.dayForm.name.trim(),
        description: this.dayForm.description.trim(),
        isActive: true,
        isPrivate: false,
        highlight: false,
        startDate: ev?.startDate ?? new Date().toISOString().slice(0, 10),
        dayOfWeek: day.dayName.toLowerCase(),
        startTime: this.inputTimeToApi(this.dayForm.startTime),
        endTime: this.inputTimeToApi(this.dayForm.endTime),
      };

      const {event: saved} = await this.f3Api.createOrUpdateEvent(body);
      let merged =
          this.mergeEventAfterSave(saved, Number(this.dayForm.eventTypeId));
      merged = this.normalizeEventAfterSave(merged, aoPayloadId, ao.name, lid);
      const idx =
          merged.id ? this.rawEvents.findIndex(e => e.id === merged.id) : -1;
      if (idx >= 0)
        this.rawEvents[idx] = merged;
      else
        this.rawEvents.push(merged);

      this.rebuildDerivedFromRaw(true);
      this.closeModal();
    } catch (e: any) {
      this.saveError = e.message ?? 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private emptyForm(): DayForm {
    return {
      enabled: false,
      name: '',
      description: '',
      startTime: '05:15',
      endTime: '06:00',
      eventTypeId: 1,
    };
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
   * we just submitted so the next open/edit doesn't default the dropdown to
   * Bootcamp.
   */
  private mergeEventAfterSave(saved: F3Event, submittedTypeId: number):
      F3Event {
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

  /**
   * API sometimes echoes `parents[0].parentId: 0`; keep local model aligned
   * with the org + location we POSTed so merges / tree never treat the workout
   * as orphan.
   */
  private normalizeEventAfterSave(
      ev: F3Event,
      aoId: number,
      aoDisplayName: string,
      locationId: number,
      ): F3Event {
    let out: F3Event = {...ev};
    if (!out.locationId || out.locationId <= 0) out = {...out, locationId};
    const pid = out.parents?.[0]?.parentId;
    if (pid == null || pid <= 0) {
      out = {
        ...out,
        parents: [{parentId: aoId, parentName: aoDisplayName}],
      };
    }
    return out;
  }

  private apiTimeToInput(time: string): string {
    const p = time.padStart(4, '0');
    return `${p.slice(0, 2)}:${p.slice(2)}`;
  }

  /** Converts `<input type="time">` value → F3 API "HHMM". */
  private inputTimeToApi(time: string): string {
    if (!time) return '0000';
    // Browsers may emit "HH:MM" or "HH:MM:SS" — never use replace(':', '')
    // once.
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

  /** Workout type label(s) for schedule row (from `/event` `eventTypes`). */
  dayEventTypeLine(ev: F3Event): string {
    if (!ev.eventTypes?.length) return '';
    return ev.eventTypes.map(t => t.eventTypeName)
        .filter((n): n is string => !!n && n.trim().length > 0)
        .join(' · ');
  }
}
