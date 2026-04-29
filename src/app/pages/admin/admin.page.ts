import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlertController, ToastController} from '@ionic/angular';
import firebase from 'firebase/compat/app';
import {Subscription} from 'rxjs';
import {Pax} from 'types';

import {BOISE_REGION_IDS, F3ApiService} from 'src/app/services/f3-api.service';
import {PaxService} from 'src/app/services/pax.service';
import {
  NO_CAPABILITIES,
  StaffCapabilities,
  StaffRolesCapabilityService,
} from 'src/app/services/staff-roles-capability.service';
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
  rolesDisplayLabel,
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
  readonly profile: UserProfile;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly initialsChar: string;
  readonly rolesLabel: string;
  readonly lastSeenFormatted: string;
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

  // ── Current user capabilities ──────────────────────────────────────
  capabilities: StaffCapabilities = NO_CAPABILITIES;

  // ── User list ──────────────────────────────────────────────────────
  loading = true;
  error: string|null = null;
  profiles: UserProfile[] = [];
  profileRows: ProfileRowVm[] = [];

  // ── Pax enrichment (email → Slack name + avatar) ──────────────────
  paxInfo = new Map<string, {f3Name: string; avatarUrl: string}>();

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
      private readonly staffCapability: StaffRolesCapabilityService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.staffCapability.capabilities$.subscribe(caps => {
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
          this.rebuildOrgChartVm();
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
      if (!p.email || this.paxInfo.has(p.uid)) continue;
      const found = await this.pax.getPaxByEmail(p.email);
      if (found) {
        this.paxInfo.set(p.uid, {
          f3Name: found.name,
          avatarUrl: found.img_url ?? '',
        });
      }
    }
    this.rebuildProfileRows();
    this.rebuildOrgChartVm();
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

  // ── VM builders ────────────────────────────────────────────────────

  private rebuildProfileRows(): void {
    this.profileRows = this.profiles.map(p => {
      const dn = this.displayName(p);
      return {
        profile: p,
        displayName: dn,
        avatarUrl: this.avatarUrl(p),
        initialsChar: this.initialsChar(dn),
        rolesLabel: rolesDisplayLabel(p.roles ?? []),
        lastSeenFormatted: this.formatLastSeen(p.lastSeenAt),
      };
    });
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
            const effectiveDn = aoqProfile ?
                this.displayName(aoqProfile) :
                (aoqPending?.displayName || aoqPending?.email || '');
            return {
              ao,
              aoqProfile,
              aoqPendingAssignment: aoqPending,
              aoqDisplayName: effectiveDn,
              aoqAvatarUrl: aoqProfile ? this.avatarUrl(aoqProfile) : '',
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
    const dn = pa.displayName || pa.email;
    return {
      profile: null,
      pendingAssignment: pa,
      displayName: dn,
      avatarUrl: '',
      initialsChar: this.initialsChar(dn),
      isPending: true,
    };
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
      this.openRoleDialogForEmail(
          vm.pendingAssignment.email,
          vm.pendingAssignment.displayName ?? vm.pendingAssignment.email);
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
