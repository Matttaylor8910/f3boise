import {Component, EventEmitter, Input, Output} from '@angular/core';

import {F3Org} from 'src/app/services/f3-api.service';

import * as treeHelpers from '../../map-tree.helpers';
import {TreeAo, TreeLocation, TreeRegion} from '../../map.page';

/**
 * Sidebar region-tree view: nationwide region search + browsable list of
 * Boise (or focused) regions, locations, and AOs. The component is purely
 * presentational — selection, mutations, and async work flow back to the
 * parent through {@link Output} events.
 */
@Component({
  selector: 'app-map-region-tree',
  templateUrl: './region-tree.component.html',
  styleUrls: ['./region-tree.component.scss'],
})
export class MapRegionTreeComponent {
  /** Tree to render. The component does not mutate it except `expanded`. */
  @Input() regions: TreeRegion[] = [];

  /** Banner shown above the tree on tree-action errors. */
  @Input() error: string|null = null;

  // ── Nationwide region search ─────────────────────────────────────

  @Input() searchQuery = '';
  @Input() searchResults: F3Org[] = [];
  @Input() searchLoading = false;
  /**
   * Regions shown as chips. The parent loads **only** these ids; when empty,
   * the map stays empty until the user adds regions or taps Home metros.
   */
  @Input() exploredNationRegions: Array<{id: number; name: string}> = [];
  /** False when chips are exactly the four home metros — reset is redundant. */
  @Input() showHomeMetrosButton = true;
  /** Disables search-clear actions during reload. */
  @Input() loading = false;

  // ── Inline AO rename ─────────────────────────────────────────────

  /** AO org id whose row is in inline-rename mode. */
  @Input() editingAoId: number|null = null;
  /** Two-way bound AO name during inline rename. */
  @Input() editingAoName = '';
  /** Disables Save while a rename is in flight. */
  @Input() editingAoSaving = false;

  // ── Outputs ──────────────────────────────────────────────────────

  /** Emitted on every keystroke in the search box. */
  @Output() searchInput = new EventEmitter<string>();
  /** Two-way binding companion for {@link searchQuery}. */
  @Output() searchQueryChange = new EventEmitter<string>();
  /** Two-way binding companion for {@link editingAoName}. */
  @Output() editingAoNameChange = new EventEmitter<string>();

  /** User picked a Nation region from the search results (parent appends). */
  @Output() exploreRegion = new EventEmitter<F3Org>();
  /** Reset chips to the four Boise home metros and reload. */
  @Output() clearExplore = new EventEmitter<void>();
  /** Remove all chips — implicit home bundle only. */
  @Output() clearAllRegions = new EventEmitter<void>();
  /** Remove one appended region by id. */
  @Output() removeExploredRegion = new EventEmitter<number>();

  /** User clicked a single-AO row or a tree AO row. */
  @Output() aoSelected =
      new EventEmitter<{ao: TreeAo; loc: TreeLocation}>();
  /** User toggled a multi/zero-AO location row (after expansion is flipped). */
  @Output() locationFocused = new EventEmitter<TreeLocation>();

  /** User clicked the location pencil button. */
  @Output() editLocation =
      new EventEmitter<{loc: TreeLocation; event: Event}>();
  /** User clicked the location trash button. */
  @Output() deleteLocation =
      new EventEmitter<{loc: TreeLocation; event: Event}>();

  /** User clicked the AO pencil button (start inline rename). */
  @Output() startEditAo =
      new EventEmitter<{ao: TreeAo; loc: TreeLocation; event: Event}>();
  /** User pressed Enter / clicked Save during inline rename. */
  @Output() saveAo =
      new EventEmitter<{ao: TreeAo; loc: TreeLocation; event: Event}>();
  /** User pressed Escape / clicked Cancel during inline rename. */
  @Output() cancelEditAo = new EventEmitter<void>();
  /** User clicked the AO trash button. */
  @Output() deleteAo =
      new EventEmitter<{ao: TreeAo; loc: TreeLocation; event: Event}>();

  // ── Template helpers (delegate to shared pure helpers) ───────────

  readonly headerLabel = treeHelpers.treeLocationHeaderLabel;
  readonly headerIsUnnamed = treeHelpers.treeLocationHeaderIsUnnamed;
  readonly missingMapCoords = treeHelpers.treeLocationMissingMapCoords;
  readonly subtitleSingleAo = treeHelpers.treeLocationSubtitleSingleAo;

  // ── Internal handlers ────────────────────────────────────────────

  onLocationRowClick(loc: TreeLocation): void {
    if (loc.aos.length === 1) {
      const ao = loc.aos[0];
      if (ao) this.aoSelected.emit({ao, loc});
      return;
    }
    loc.expanded = !loc.expanded;
    this.locationFocused.emit(loc);
  }

  onSearchInput(value: string): void {
    this.searchQueryChange.emit(value);
    this.searchInput.emit(value);
  }

  onEditingAoNameChange(value: string): void {
    this.editingAoNameChange.emit(value);
  }
}
