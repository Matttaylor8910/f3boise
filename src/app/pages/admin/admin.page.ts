import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlertController, ToastController} from '@ionic/angular';
import firebase from 'firebase/compat/app';
import {Subscription} from 'rxjs';
import {Pax} from 'types';

import {BOISE_REGION_IDS, F3ApiService} from 'src/app/services/f3-api.service';
import {PaxService} from 'src/app/services/pax.service';
import {
  AdminCapabilities,
  AdminCapabilityService,
  NO_ADMIN_CAPABILITIES,
} from 'src/app/services/admin-capability.service';
import {
  PendingRoleAssignment,
  UserProfile,
  UserProfilesService,
} from 'src/app/services/user-profiles.service';
import {
  BOISE_REGIONS,
  makeAoqRole,
  makeNantanRole,
  parseAoqOrgIds,
  parseNantanRegionIds,
} from 'src/app/services/user-permissions.service';

// ── Public interfaces (used by template) ──────────────────────────────────

export interface RoleDisplay {
  key: string;
  label: string;
  sublabel?: string;
  /** Whether the current editor may remove this role. */
  canRemove: boolean;
}

export interface AoItem {
  orgId: number;
  name: string;
  regionId: number;
  regionName: string;
}

/** Precomputed cells for the user table — avoids methods/getters in the template. */
export interface ProfileRowVm {
  readonly profile: UserProfile|null;
  /** Set when the user has no profile yet but has `pendingRoleAssignments`. */
  readonly pendingAssignment: PendingRoleAssignment|null;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly initialsChar: string;
  readonly rolesLabel: string;
  readonly lastSeenFormatted: string;
  readonly isPending: boolean;
}

/** A result row in the Add-User search modal. */
export interface UserSearchResult {
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl: string;
  readonly initialsChar: string;
  /** Present when the user already has a UserProfile doc. */
  readonly profile: UserProfile|null;
}

// ── Org chart view models ──────────────────────────────────────────────────

export interface OrgChartPersonVm {
  /** Null for pending-only entries that have not yet signed in. */
  readonly profile: UserProfile|null;
  readonly pendingAssignment: PendingRoleAssignment|null;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly initialsChar: string;
  readonly isPending: boolean;
}

export interface OrgChartAoRow {
  readonly ao: AoItem;
  readonly aoqProfile: UserProfile|null;
  readonly aoqPendingAssignment: PendingRoleAssignment|null;
  readonly aoqDisplayName: string;
  readonly aoqAvatarUrl: string;
  readonly aoqInitialsChar: string;
  readonly aoqIsPending: boolean;
  readonly canAssignAoq: boolean;
}

export interface OrgChartRegionSection {
  readonly regionId: number;
  readonly regionName: string;
  readonly nantanProfiles: OrgChartPersonVm[];
  readonly aos: OrgChartAoRow[];
}

export interface OrgChartVm {
  readonly admins: OrgChartPersonVm[];
  readonly regions: OrgChartRegionSection[];
}

type AddRoleStep = null|'pick-type'|'pick-region'|'pick-ao';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit, OnDestroy {
  readonly boiseRegions = BOISE_REGIONS;

  // ── Tab navigation ─────────────────────────────────────────────────
  activeTab: 'users'|'org-chart' = 'users';

  // ── Current user admin capabilities (role-edit powers) ───────────
  capabilities: AdminCapabilities = NO_ADMIN_CAPABILITIES;

  // ── User list ──────────────────────────────────────────────────────
  loading = true;
  error: string|null = null;
  profiles: UserProfile[] = [];
  profileRows: ProfileRowVm[] = [];

  // ── Pax enrichment (uid → data, email → data) ─────────────────────
  paxInfo = new Map<string, {f3Name: string; avatarUrl: string}>();
  paxInfoByEmail = new Map<string, {f3Name: string; avatarUrl: string}>();

  // ── Pending role assignments ───────────────────────────────────────
  pendingAssignments: PendingRoleAssignment[] = [];

  // ── AO list (loaded once for AOQ picker + org chart) ──────────────
  aoItems: AoItem[] = [];
  aoListLoading = false;

  // ── Org chart ──────────────────────────────────────────────────────
  orgChartVm: OrgChartVm = {admins: [], regions: []};

  // ── Add-User search modal ──────────────────────────────────────────
  addUserModalOpen = false;
  addUserSearch = '';
  addUserResults: UserSearchResult[] = [];
  addUserSearching = false;
  private addUserSearchTimer?: ReturnType<typeof setTimeout>;
  /** When set, pre-add this AOQ role on the next user selection. */
  private pendingAoqAssignOrgId: number|null = null;
  /** When set, pre-add Nantan for this region on the next user selection. */
  private pendingNantanRegionId: number|null = null;

  // ── Role dialog ────────────────────────────────────────────────────
  roleModalOpen = false;
  selected: UserProfile|null = null;
  draftRoles: string[] = [];

  addRoleStep: AddRoleStep = null;
  aoSearch = '';
  saving = false;

  /** Modal header — set once when opening the dialog */
  modalDisplayName = '';
  modalAvatarUrl = '';
  modalInitialChar = '';

  /** True when editing a provisional (email-only) assignment */
  modalIsPending = false;

  /** True when the current editor may add roles in the open modal */
  modalCanAddRole = false;

  private provisionalEmail: string|null = null;
  private provisionalDisplayName: string|null = null;

  /** Derived from draftRoles — updated only when draftRoles mutates */
  draftRoleRows: RoleDisplay[] = [];
  draftHasAdmin = false;
  readonly draftNantanRegionIds = new Set<number>();
  readonly draftAoqOrgIds = new Set<number>();

  /** AO picker — rebuilt when search text or aoItems changes */
  filteredAoPickItems: AoItem[] = [];

  private subs = new Subscription();

  constructor(
      private readonly toast: ToastController,
      private readonly alert: AlertController,
      private readonly userProfiles: UserProfilesService,
      private readonly f3Api: F3ApiService,
      private readonly pax: PaxService,
      private readonly adminCapability: AdminCapabilityService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.adminCapability.capabilities$.subscribe(caps => {
      this.capabilities = caps;
      this.rebuildOrgChartVm();
      this.rebuildAoPickFilter();
    }));

    this.subs.add(this.userProfiles.watchAllProfiles().subscribe({
      next: rows => {
        this.profiles = rows;
        this.loading = false;
        this.error = null;
        this.rebuildProfileRows();
        this.rebuildOrgChartVm();
        void this.enrichWithPax(rows);
      },
      error: err => {
        this.error = err.message ?? String(err);
        this.loading = false;
      },
    }));

    this.subs.add(this.userProfiles.watchAllPendingAssignments().subscribe(
        pending => {
          this.pendingAssignments = pending;
          void this.refreshPaxForPendingAndRebuildOrgChart();
        },
    ));

    void this.loadAoList();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.addUserSearchTimer);
  }

  // ── Pax enrichment ─────────────────────────────────────────────────

  private async enrichWithPax(profiles: UserProfile[]): Promise<void> {
    await this.pax.getAllData();
    for (const p of profiles) {
      if (!p.email) continue;
      const found = await this.pax.getPaxByEmail(p.email);
      if (found) {
        const info = {f3Name: found.name, avatarUrl: found.img_url ?? ''};
        this.paxInfo.set(p.uid, info);
        this.paxInfoByEmail.set(p.email.toLowerCase().trim(), info);
      }
    }
    await this.ensurePaxInfoForEmails(
        this.pendingAssignments.map(pa => pa.email));
    this.rebuildProfileRows();
    this.rebuildOrgChartVm();
  }

  /**
   * Load Pax avatar/name for emails not yet covered (e.g. pending assignments
   * where the user has no `userProfiles` row).
   */
  private async ensurePaxInfoForEmails(emails: readonly string[]): Promise<void> {
    await this.pax.getAllData();
    for (const raw of emails) {
      const key = raw?.toLowerCase()?.trim() ?? '';
      if (!key || this.paxInfoByEmail.has(key)) continue;
      const found = await this.pax.getPaxByEmail(key);
      if (found) {
        const info = {f3Name: found.name, avatarUrl: found.img_url ?? ''};
        this.paxInfoByEmail.set(key, info);
        const prof =
            this.profiles.find(p => p.email?.toLowerCase().trim() === key);
        if (prof) this.paxInfo.set(prof.uid, info);
      }
    }
  }

  private displayName(p: UserProfile): string {
    return this.paxInfo.get(p.uid)?.f3Name ||
        p.displayName ||
        p.email?.split('@')[0] ||
        '—';
  }

  private avatarUrl(p: UserProfile): string {
    return this.paxInfo.get(p.uid)?.avatarUrl || p.photoURL || '';
  }

  private initialsChar(displayName: string): string {
    const t = displayName.trim();
    return t.length > 0 ? t.charAt(0).toUpperCase() : '—';
  }

  /**
   * Roles column for the Users table — resolves AOQ org ids to AO names when
   * {@link aoItems} is loaded.
   */
  private rolesLabelForTable(roles: string[]): string {
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
      const ao = this.aoItems.find(a => a.orgId === id);
      parts.push(
          ao ? `AOQ (${ao.name})` : `AOQ (org ${id})`);
    }
    const known = new Set(
        ['admin', ...nantanIds.map(makeNantanRole), ...aoqIds.map(makeAoqRole)]);
    for (const r of roles) {
      if (!known.has(r)) parts.push(r);
    }
    return parts.join(', ') || '—';
  }

  // ── VM builders ────────────────────────────────────────────────────

  private rebuildProfileRows(): void {
    const profileEmails = new Set(
        this.profiles
            .map(p => p.email?.toLowerCase().trim() ?? '')
            .filter(e => e.length > 0));

    const fromProfiles: ProfileRowVm[] = this.profiles.map(p => {
      const dn = this.displayName(p);
      return {
        profile: p,
        pendingAssignment: null,
        displayName: dn,
        avatarUrl: this.avatarUrl(p),
        initialsChar: this.initialsChar(dn),
        rolesLabel: this.rolesLabelForTable(p.roles ?? []),
        lastSeenFormatted: this.formatLastSeen(p.lastSeenAt),
        isPending: false,
      };
    });

    const fromPending: ProfileRowVm[] = this.pendingAssignments
        .filter(pa => !profileEmails.has(pa.email.toLowerCase().trim()))
        .map(pa => {
          const pax = this.paxInfoByEmail.get(pa.email.toLowerCase().trim());
          const dn = pax?.f3Name || pa.displayName || pa.email;
          return {
            profile: null,
            pendingAssignment: pa,
            displayName: dn,
            avatarUrl: pax?.avatarUrl ?? '',
            initialsChar: this.initialsChar(dn),
            rolesLabel: this.rolesLabelForTable(pa.roles ?? []),
            lastSeenFormatted: 'Pending — first sign-in',
            isPending: true,
          };
        });

    this.profileRows = [...fromProfiles, ...fromPending].sort((a, b) =>
        a.displayName.localeCompare(
            b.displayName, undefined, {sensitivity: 'base'}));
  }

  private rebuildOrgChartVm(): void {
    if (!this.profiles.length && !this.aoItems.length &&
        !this.pendingAssignments.length)
      return;

    // Build a set of emails that already have a live profile, to avoid
    // double-showing someone whose pending doc hasn't been cleaned up yet.
    const profileEmails =
        new Set(this.profiles.map(p => p.email?.toLowerCase() ?? ''));

    const admins: OrgChartPersonVm[] = this.profiles
                                           .filter(
                                               p => (p.roles ?? [])
                                                        .includes('admin'))
                                           .map(p => this.toPersonVm(p))
                                           .sort(
                                               (a, b) => a.displayName
                                                             .localeCompare(
                                                                 b.displayName));

    const regions: OrgChartRegionSection[] = BOISE_REGIONS.map(region => {
      const nantanRole = makeNantanRole(region.id);

      const nantanProfiles: OrgChartPersonVm[] = [
        ...this.profiles.filter(p => (p.roles ?? []).includes(nantanRole))
            .map(p => this.toPersonVm(p)),
        ...this.pendingAssignments
            .filter(
                pa => pa.roles.includes(nantanRole) &&
                    !profileEmails.has(pa.email.toLowerCase()))
            .map(pa => this.toPendingPersonVm(pa)),
      ];

      const aos: OrgChartAoRow[] =
          this.aoItems.filter(ao => ao.regionId === region.id).map(ao => {
            const aoqRole = makeAoqRole(ao.orgId);
            const aoqProfile =
                this.profiles.find(p => (p.roles ?? []).includes(aoqRole)) ??
                null;
            const aoqPending = aoqProfile ?
                null :
                (this.pendingAssignments.find(
                     pa => pa.roles.includes(aoqRole) &&
                         !profileEmails.has(pa.email.toLowerCase())) ??
                 null);
            const pendingPax = aoqPending ?
                this.paxInfoByEmail.get(aoqPending.email.toLowerCase().trim()) :
                null;
            const effectiveDn = aoqProfile ?
                this.displayName(aoqProfile) :
                (pendingPax?.f3Name || aoqPending?.displayName ||
                 aoqPending?.email || '');
            return {
              ao,
              aoqProfile,
              aoqPendingAssignment: aoqPending,
              aoqDisplayName: effectiveDn,
              aoqAvatarUrl: aoqProfile ?
                  this.avatarUrl(aoqProfile) :
                  (pendingPax?.avatarUrl ?? ''),
              aoqInitialsChar: this.initialsChar(effectiveDn),
              aoqIsPending: !aoqProfile && !!aoqPending,
              canAssignAoq:
                  this.capabilities.assignableAoqRegionIds.has(region.id),
            };
          });

      return {
        regionId: region.id,
        regionName: region.name,
        nantanProfiles,
        aos,
      };
    });

    this.orgChartVm = {admins, regions};
  }

  private toPersonVm(p: UserProfile): OrgChartPersonVm {
    const dn = this.displayName(p);
    return {
      profile: p,
      pendingAssignment: null,
      displayName: dn,
      avatarUrl: this.avatarUrl(p),
      initialsChar: this.initialsChar(dn),
      isPending: false,
    };
  }

  private toPendingPersonVm(pa: PendingRoleAssignment): OrgChartPersonVm {
    const pax = this.paxInfoByEmail.get(pa.email.toLowerCase().trim());
    const dn = pax?.f3Name || pa.displayName || pa.email;
    return {
      profile: null,
      pendingAssignment: pa,
      displayName: dn,
      avatarUrl: pax?.avatarUrl ?? '',
      initialsChar: this.initialsChar(dn),
      isPending: true,
    };
  }

  private async refreshPaxForPendingAndRebuildOrgChart(): Promise<void> {
    await this.ensurePaxInfoForEmails(
        this.pendingAssignments.map(pa => pa.email));
    this.rebuildProfileRows();
    this.rebuildOrgChartVm();
  }

  // ── AO list ────────────────────────────────────────────────────────

  private async loadAoList(): Promise<void> {
    this.aoListLoading = true;
    try {
      const {orgs} = await this.f3Api.listOrgs({
        orgTypes: ['ao'],
        parentOrgIds: Object.values(BOISE_REGION_IDS) as number[],
        statuses: 'active',
        pageSize: 500,
      });
      this.aoItems = orgs
                         .map(org => {
                           const region =
                               BOISE_REGIONS.find(r => r.id === org.parentId);
                           return {
                             orgId: org.id,
                             name: org.name,
                             regionId: org.parentId,
                             regionName: region?.name ?? '',
                           };
                         })
                         .sort((a, b) => a.name.localeCompare(b.name));
      this.rebuildAoPickFilter();
      this.rebuildProfileRows();
      this.rebuildOrgChartVm();
      if (this.roleModalOpen) {
        this.syncDraftDerivedState();
      }
    } catch {
      // non-critical; AOQ picker will show org IDs as fallback
    } finally {
      this.aoListLoading = false;
    }
  }

  // ── Add-User modal ─────────────────────────────────────────────────

  openAddUserModal(): void {
    this.addUserSearch = '';
    this.addUserResults = [];
    this.addUserModalOpen = true;
  }

  closeAddUserModal(): void {
    this.addUserModalOpen = false;
    this.pendingAoqAssignOrgId = null;
    this.pendingNantanRegionId = null;
    clearTimeout(this.addUserSearchTimer);
  }

  onAddUserSearchChange(): void {
    clearTimeout(this.addUserSearchTimer);
    const q = this.addUserSearch.trim();
    if (!q) {
      this.addUserResults = [];
      return;
    }
    this.addUserSearchTimer = setTimeout(() => void this.performAddUserSearch(q), 250);
  }

  private async performAddUserSearch(query: string): Promise<void> {
    this.addUserSearching = true;
    try {
      await this.pax.getAllData();
      const q = query.toLowerCase();
      const results: UserSearchResult[] = [];
      const seenEmails = new Set<string>();

      // Profiles first (they have the richest data)
      for (const p of this.profiles) {
        const dn = this.displayName(p);
        const email = p.email ?? '';
        if (dn.toLowerCase().includes(q) || email.toLowerCase().includes(q)) {
          seenEmails.add(email.toLowerCase());
          results.push({
            displayName: dn,
            email,
            avatarUrl: this.avatarUrl(p),
            initialsChar: this.initialsChar(dn),
            profile: p,
          });
        }
      }

      // Pax-only entries (no UserProfile yet)
      for (const paxEntry of this.pax.allData ?? []) {
        const email = paxEntry.email?.toLowerCase().trim() ?? '';
        if (seenEmails.has(email)) continue;
        const name = paxEntry.name;
        if (name.toLowerCase().includes(q) || email.includes(q)) {
          results.push({
            displayName: name,
            email,
            avatarUrl: paxEntry.img_url ?? '',
            initialsChar: this.initialsChar(name),
            profile: null,
          });
        }
      }

      this.addUserResults = results.slice(0, 25);
    } finally {
      this.addUserSearching = false;
    }
  }

  selectAddUserResult(result: UserSearchResult): void {
    this.addUserModalOpen = false;
    const pendingOrgId = this.pendingAoqAssignOrgId;
    const pendingNantanRegionId = this.pendingNantanRegionId;
    this.pendingAoqAssignOrgId = null;
    this.pendingNantanRegionId = null;

    if (result.profile) {
      this.openRoleDialog(result.profile);
    } else {
      this.openRoleDialogForEmail(result.email, result.displayName);
    }

    // Pre-add the AOQ role if this was triggered from org-chart "Assign AOQ"
    if (pendingOrgId !== null) {
      const role = makeAoqRole(pendingOrgId);
      if (!this.draftRoles.includes(role)) {
        this.draftRoles = [...this.draftRoles, role];
        this.syncDraftDerivedState();
      }
    }
    if (pendingNantanRegionId !== null) {
      const role = makeNantanRole(pendingNantanRegionId);
      if (!this.draftRoles.includes(role)) {
        this.draftRoles = [...this.draftRoles, role];
        this.syncDraftDerivedState();
      }
    }
  }

  openPersonRoleDialog(vm: OrgChartPersonVm): void {
    if (vm.profile) {
      this.openRoleDialog(vm.profile);
    } else if (vm.pendingAssignment) {
      this.openRoleDialogForPendingAssignment(vm.pendingAssignment);
    }
  }

  openAssignNantanModal(region: OrgChartRegionSection): void {
    this.pendingAoqAssignOrgId = null;
    this.pendingNantanRegionId = region.regionId;
    this.openAddUserModal();
  }

  openAssignAoqModal(ao: OrgChartAoRow): void {
    this.pendingNantanRegionId = null;
    this.pendingAoqAssignOrgId = ao.ao.orgId;
    this.openAddUserModal();
  }

  trackUserSearchResult(_i: number, r: UserSearchResult): string {
    return r.email || r.displayName;
  }

  openUserTableRoleEditor(row: ProfileRowVm): void {
    if (row.profile) {
      this.openRoleDialog(row.profile);
    } else if (row.pendingAssignment) {
      this.openRoleDialogForPendingAssignment(row.pendingAssignment);
    }
  }

  /** Edit roles for an email-only pending doc (Users table + org chart). */
  private openRoleDialogForPendingAssignment(
      pa: PendingRoleAssignment,
  ): void {
    this.selected = null;
    this.modalIsPending = true;
    this.draftRoles = [...(pa.roles ?? [])];
    this.syncDraftDerivedState();
    const pax = this.paxInfoByEmail.get(pa.email.toLowerCase().trim());
    const dn = pax?.f3Name || pa.displayName || pa.email;
    this.modalDisplayName = dn;
    this.modalAvatarUrl = pax?.avatarUrl ?? '';
    this.modalInitialChar = this.initialsChar(dn);
    this.modalCanAddRole = this.capabilities.canEditArbitraryRoles ||
        this.capabilities.assignableAoqRegionIds.size > 0;
    this.addRoleStep = null;
    this.aoSearch = '';
    this.provisionalEmail = pa.email.toLowerCase().trim();
    this.provisionalDisplayName = pa.displayName;
    this.rebuildAoPickFilter();
    this.roleModalOpen = true;
  }

  trackProfileRow(_i: number, row: ProfileRowVm): string {
    return row.profile?.uid ?? `pending:${row.pendingAssignment?.email ?? ''}`;
  }

  // ── Role dialog ────────────────────────────────────────────────────

  openRoleDialog(profile: UserProfile): void {
    this.selected = profile;
    this.modalIsPending = false;
    this.provisionalEmail = null;
    this.provisionalDisplayName = null;
    this.draftRoles = [...(profile.roles ?? [])];
    this.syncDraftDerivedState();
    this.modalDisplayName = this.displayName(profile);
    this.modalAvatarUrl = this.avatarUrl(profile);
    this.modalInitialChar = this.initialsChar(this.modalDisplayName);
    this.modalCanAddRole = this.capabilities.canEditArbitraryRoles ||
        this.capabilities.assignableAoqRegionIds.size > 0;
    this.addRoleStep = null;
    this.aoSearch = '';
    this.rebuildAoPickFilter();
    this.roleModalOpen = true;
  }

  openRoleDialogForEmail(email: string, displayName: string): void {
    // Check if we already have a profile for this email
    const existing = this.profiles.find(
        p => p.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      this.openRoleDialog(existing);
      return;
    }

    const ekey = email.toLowerCase().trim();
    const pending = this.pendingAssignments.find(
        pa => pa.email.toLowerCase().trim() === ekey);
    if (pending) {
      this.openRoleDialogForPendingAssignment(pending);
      return;
    }

    this.selected = null;
    this.modalIsPending = true;
    this.draftRoles = [];
    this.syncDraftDerivedState();
    this.modalDisplayName = displayName || email;
    this.modalAvatarUrl = '';
    this.modalInitialChar = this.initialsChar(this.modalDisplayName);
    this.modalCanAddRole = this.capabilities.canEditArbitraryRoles ||
        this.capabilities.assignableAoqRegionIds.size > 0;
    this.addRoleStep = null;
    this.aoSearch = '';
    this.provisionalEmail = email.toLowerCase().trim();
    this.provisionalDisplayName = displayName;

    this.rebuildAoPickFilter();
    this.roleModalOpen = true;
  }

  closeRoleDialog(): void {
    this.roleModalOpen = false;
    this.selected = null;
    this.draftRoles = [];
    this.syncDraftDerivedState();
    this.addRoleStep = null;
    this.aoSearch = '';
    this.modalDisplayName = '';
    this.modalAvatarUrl = '';
    this.modalInitialChar = '';
    this.modalIsPending = false;
    this.provisionalEmail = null;
    this.provisionalDisplayName = null;
  }

  onAoSearchChange(): void {
    this.rebuildAoPickFilter();
  }

  trackRoleRow(_index: number, r: RoleDisplay): string {
    return r.key;
  }

  trackAoOrg(_index: number, ao: AoItem): number {
    return ao.orgId;
  }

  trackRegionSection(_i: number, s: OrgChartRegionSection): number {
    return s.regionId;
  }

  trackOrgChartAo(_i: number, ao: OrgChartAoRow): number {
    return ao.ao.orgId;
  }

  trackPersonVm(_i: number, v: OrgChartPersonVm): string {
    return v.profile?.uid ?? `pending:${v.pendingAssignment?.email ?? ''}`;
  }

  // ── Add role sub-flow ──────────────────────────────────────────────

  startAddRole(): void {
    if (this.capabilities.canEditArbitraryRoles) {
      this.addRoleStep = 'pick-type';
    } else {
      // Non-admin (Nantan): skip type picker, go directly to AOQ assignment
      this.aoSearch = '';
      this.rebuildAoPickFilter();
      this.addRoleStep = 'pick-ao';
    }
  }

  cancelAddRole(): void {
    this.addRoleStep = null;
    this.aoSearch = '';
    this.rebuildAoPickFilter();
  }

  selectRoleType(type: 'admin'|'nantan'|'aoq'): void {
    if (type === 'admin') {
      this.commitRole('admin');
    } else if (type === 'nantan') {
      this.addRoleStep = 'pick-region';
    } else {
      this.aoSearch = '';
      this.rebuildAoPickFilter();
      this.addRoleStep = 'pick-ao';
    }
  }

  selectNantanRegion(regionId: number): void {
    this.commitRole(makeNantanRole(regionId));
  }

  selectAoqOrg(orgId: number): void {
    this.commitRole(makeAoqRole(orgId));
  }

  private commitRole(role: string): void {
    if (!this.draftRoles.includes(role)) {
      this.draftRoles = [...this.draftRoles, role];
    }
    this.syncDraftDerivedState();
    this.addRoleStep = null;
    this.aoSearch = '';
    this.rebuildAoPickFilter();
  }

  removeRole(key: string): void {
    this.draftRoles = this.draftRoles.filter(r => r !== key);
    this.syncDraftDerivedState();
  }

  // ── Derived state ──────────────────────────────────────────────────

  private syncDraftDerivedState(): void {
    const roles = this.draftRoles;
    this.draftHasAdmin = roles.includes('admin');
    syncSet(this.draftNantanRegionIds, parseNantanRegionIds(roles));
    syncSet(this.draftAoqOrgIds, parseAoqOrgIds(roles));
    this.draftRoleRows = roles.map(r => this.roleToDisplay(r));
  }

  private rebuildAoPickFilter(): void {
    const q = this.aoSearch.trim().toLowerCase();
    let items = this.aoItems;

    // Non-admin: restrict AO list to assignable regions
    if (!this.capabilities.canEditArbitraryRoles &&
        this.capabilities.assignableAoqRegionIds.size > 0) {
      items = items.filter(
          a => this.capabilities.assignableAoqRegionIds.has(a.regionId));
    }

    if (!q) {
      this.filteredAoPickItems = items;
      return;
    }
    this.filteredAoPickItems = items.filter(
        a => a.name.toLowerCase().includes(q) ||
            a.regionName.toLowerCase().includes(q));
  }

  private roleToDisplay(role: string): RoleDisplay {
    const canRemoveAll = this.capabilities.canEditArbitraryRoles;

    if (role === 'admin') {
      return {key: role, label: 'Admin', canRemove: canRemoveAll};
    }
    if (role.startsWith('nantan:')) {
      const regionId = parseInt(role.split(':')[1], 10);
      const region = BOISE_REGIONS.find(r => r.id === regionId);
      return {
        key: role,
        label: 'Nantan',
        sublabel: region?.name ?? `Region ${regionId}`,
        canRemove: canRemoveAll,
      };
    }
    if (role.startsWith('aoq:')) {
      const orgId = parseInt(role.split(':')[1], 10);
      const ao = this.aoItems.find(a => a.orgId === orgId);
      const canRemove = canRemoveAll ||
          (ao !== undefined &&
           this.capabilities.assignableAoqRegionIds.has(ao.regionId));
      return {
        key: role,
        label: 'AOQ',
        sublabel: ao ? `${ao.name} (${ao.regionName})` : `Org ${orgId}`,
        canRemove,
      };
    }
    return {key: role, label: role, canRemove: canRemoveAll};
  }

  // ── Save ───────────────────────────────────────────────────────────

  async saveRoles(): Promise<void> {
    if (this.saving) return;

    // Transfer warning for self-role removal
    if (this.selected?.uid === this.capabilities.currentUid) {
      const confirmed = await this.checkSelfTransferWarning(
          this.selected.roles ?? [], this.draftRoles);
      if (!confirmed) return;
    }

    this.saving = true;
    try {
      if (this.modalIsPending) {
        await this.savePendingRoles();
      } else if (this.selected) {
        await this.userProfiles.setRoles(this.selected.uid, this.draftRoles);
        await this.showToast('Roles saved', 'success');
        this.closeRoleDialog();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.showToast(`Could not save roles: ${msg}`, 'danger', 4000);
    } finally {
      this.saving = false;
    }
  }

  private async savePendingRoles(): Promise<void> {
    const email = this.provisionalEmail;
    if (!email || !this.capabilities.currentUid) return;

    const displayName = this.provisionalDisplayName;
    await this.userProfiles.setPendingRoles(
        email, this.draftRoles, this.capabilities.currentUid,
        displayName ?? undefined);
    await this.showToast(
        `Pending roles saved for ${email}. They will apply on first sign-in.`,
        'success', 3500);
    this.closeRoleDialog();
  }

  /**
   * If the user is removing their own Nantan or AOQ role, show a destructive
   * confirmation alert. Returns true to proceed, false to cancel.
   */
  private async checkSelfTransferWarning(
      oldRoles: string[], newRoles: string[]): Promise<boolean> {
    const removedNantanIds =
        oldRoles
            .filter(r => r.startsWith('nantan:') && !newRoles.includes(r))
            .map(r => parseInt(r.split(':')[1], 10));

    const removedAoqIds =
        oldRoles
            .filter(r => r.startsWith('aoq:') && !newRoles.includes(r))
            .map(r => parseInt(r.split(':')[1], 10));

    if (removedNantanIds.length === 0 && removedAoqIds.length === 0) {
      return true;
    }

    const parts: string[] = [];
    for (const id of removedNantanIds) {
      const r = BOISE_REGIONS.find(x => x.id === id);
      parts.push(`Nantan — ${r?.name ?? `Region ${id}`}`);
    }
    for (const id of removedAoqIds) {
      const ao = this.aoItems.find(a => a.orgId === id);
      parts.push(`AOQ — ${ao?.name ?? `Org ${id}`}`);
    }
    const roleList = parts.map(p => `• ${p}`).join('\n');

    return new Promise(resolve => {
      void this.alert
          .create({
            header: 'Passing the torch',
            message: `You are removing your own role(s):\n\n${roleList}\n\nThis takes effect immediately on save and cannot be undone. Make sure you have already designated a successor.`,
            cssClass: 'transfer-alert',
            buttons: [
              {
                text: 'Cancel',
                role: 'cancel',
                handler: () => resolve(false),
              },
              {
                text: 'Pass the torch',
                role: 'destructive',
                cssClass: 'transfer-alert-confirm',
                handler: () => resolve(true),
              },
            ],
          })
          .then(a => a.present());
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async showToast(
      message: string, color: string, duration = 2200): Promise<void> {
    const t =
        await this.toast.create({message, duration, color, position: 'top'});
    await t.present();
  }

  private formatLastSeen(t: firebase.firestore.Timestamp|null): string {
    if (!t) return '—';
    try {
      return t.toDate().toLocaleString();
    } catch {
      return '—';
    }
  }
}

/** Reuse Set instances so template-bound `readonly` Sets stay stable. */
function syncSet<T>(target: Set<T>, values: Iterable<T>): void {
  target.clear();
  for (const v of values) {
    target.add(v);
  }
}
