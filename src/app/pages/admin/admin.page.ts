import {Component, OnDestroy, OnInit} from '@angular/core';
import {ToastController} from '@ionic/angular';
import firebase from 'firebase/compat/app';
import {Subscription} from 'rxjs';

import {BOISE_REGION_IDS, F3ApiService} from 'src/app/services/f3-api.service';
import {PaxService} from 'src/app/services/pax.service';
import {
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

export interface RoleDisplay {
  key: string;
  label: string;
  sublabel?: string;
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

type AddRoleStep = null | 'pick-type' | 'pick-region' | 'pick-ao';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit, OnDestroy {
  readonly boiseRegions = BOISE_REGIONS;

  // ── User list ──────────────────────────────────────────────────────

  loading = true;
  error: string|null = null;
  profiles: UserProfile[] = [];
  profileRows: ProfileRowVm[] = [];

  // ── Pax enrichment (email → Slack name + avatar) ──────────────────

  /** uid → { f3Name, avatarUrl } resolved from PaxService by email */
  paxInfo = new Map<string, {f3Name: string; avatarUrl: string}>();

  // ── AO list (loaded once for AOQ picker + table labels) ───────────

  aoItems: AoItem[] = [];
  aoListLoading = false;

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

  /** Derived from draftRoles — updated only when draftRoles mutates */
  draftRoleRows: RoleDisplay[] = [];
  draftHasAdmin = false;
  readonly draftNantanRegionIds = new Set<number>();
  readonly draftAoqOrgIds = new Set<number>();

  /** AO picker — rebuilt when search text or aoItems changes */
  filteredAoPickItems: AoItem[] = [];

  private sub?: Subscription;

  constructor(
      private readonly toast: ToastController,
      private readonly userProfiles: UserProfilesService,
      private readonly f3Api: F3ApiService,
      private readonly pax: PaxService,
  ) {}

  ngOnInit(): void {
    this.sub = this.userProfiles.watchAllProfiles().subscribe({
      next: rows => {
        this.profiles = rows;
        this.loading = false;
        this.error = null;
        this.rebuildProfileRows();
        void this.enrichWithPax(rows);
      },
      error: err => {
        this.error = err.message ?? String(err);
        this.loading = false;
      },
    });
    void this.loadAoList();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

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
  }

  /** Best display name: F3 name → Firebase displayName → email prefix */
  private displayName(p: UserProfile): string {
    return this.paxInfo.get(p.uid)?.f3Name ||
        p.displayName ||
        p.email?.split('@')[0] ||
        '—';
  }

  /** Best avatar: Pax img_url → Firebase photoURL → '' */
  private avatarUrl(p: UserProfile): string {
    return this.paxInfo.get(p.uid)?.avatarUrl || p.photoURL || '';
  }

  private rebuildProfileRows(): void {
    this.profileRows = this.profiles.map(p => {
      const displayName = this.displayName(p);
      const initialsChar =
          displayName.trim().length > 0 ?
          displayName.trim().charAt(0).toUpperCase() :
          '—';
      return {
        profile: p,
        displayName,
        avatarUrl: this.avatarUrl(p),
        initialsChar,
        rolesLabel: rolesDisplayLabel(p.roles ?? []),
        lastSeenFormatted: this.formatLastSeen(p.lastSeenAt),
      };
    });
  }

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
      if (this.roleModalOpen) {
        this.syncDraftDerivedState();
      }
    } catch {
      // non-critical; AOQ picker will show org IDs as fallback
    } finally {
      this.aoListLoading = false;
    }
  }

  // ── Role dialog control ────────────────────────────────────────────

  openRoleDialog(profile: UserProfile): void {
    this.selected = profile;
    this.draftRoles = [...(profile.roles ?? [])];
    this.syncDraftDerivedState();
    this.modalDisplayName = this.displayName(profile);
    this.modalAvatarUrl = this.avatarUrl(profile);
    const dn = this.modalDisplayName.trim();
    this.modalInitialChar =
        dn.length > 0 ? dn.charAt(0).toUpperCase() : '—';
    this.addRoleStep = null;
    this.aoSearch = '';
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

  // ── Add role sub-flow ──────────────────────────────────────────────

  startAddRole(): void {
    this.addRoleStep = 'pick-type';
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

  /**
   * Keeps Sets, admin flag, and role row labels in sync with draftRoles.
   * Called after every draft mutation instead of using getters (which run on
   * every change detection).
   */
  private syncDraftDerivedState(): void {
    const roles = this.draftRoles;
    this.draftHasAdmin = roles.includes('admin');
    syncSet(this.draftNantanRegionIds, parseNantanRegionIds(roles));
    syncSet(this.draftAoqOrgIds, parseAoqOrgIds(roles));
    this.draftRoleRows = roles.map(r => this.roleToDisplay(r));
  }

  private rebuildAoPickFilter(): void {
    const q = this.aoSearch.trim().toLowerCase();
    if (!q) {
      this.filteredAoPickItems = this.aoItems;
      return;
    }
    this.filteredAoPickItems = this.aoItems.filter(
        a => a.name.toLowerCase().includes(q) ||
            a.regionName.toLowerCase().includes(q));
  }

  private roleToDisplay(role: string): RoleDisplay {
    if (role === 'admin') {
      return {key: role, label: 'Admin'};
    }
    if (role.startsWith('nantan:')) {
      const regionId = parseInt(role.split(':')[1], 10);
      const region = BOISE_REGIONS.find(r => r.id === regionId);
      return {key: role, label: 'Nantan', sublabel: region?.name ?? `Region ${regionId}`};
    }
    if (role.startsWith('aoq:')) {
      const orgId = parseInt(role.split(':')[1], 10);
      const ao = this.aoItems.find(a => a.orgId === orgId);
      return {
        key: role,
        label: 'AOQ',
        sublabel: ao ? `${ao.name} (${ao.regionName})` : `Org ${orgId}`,
      };
    }
    return {key: role, label: role};
  }

  // ── Save ───────────────────────────────────────────────────────────

  async saveRoles(): Promise<void> {
    const sel = this.selected;
    if (!sel) return;

    this.saving = true;
    try {
      await this.userProfiles.setRoles(sel.uid, this.draftRoles);
      const t = await this.toast.create(
          {message: 'Roles saved', duration: 2200, color: 'success'});
      await t.present();
      this.closeRoleDialog();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const t = await this.toast.create(
          {message: `Could not save roles: ${msg}`, duration: 4000, color: 'danger'});
      await t.present();
    } finally {
      this.saving = false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

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
