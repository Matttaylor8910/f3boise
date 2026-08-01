import {Location} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast} from 'types';

interface BdRef {
  relativeDate: string;
  ao: string;       // display name
  aoRoute: string;  // lowercased route segment for /ao/:name
  backblastId: string;
}

interface VsStats {
  together: number;
  totalA: number;
  totalB: number;
  pctA: number;  // together / totalA
  pctB: number;
  favoriteAo?: {name: string; route: string; count: number};
  aQedB: number;  // BDs together where A was the Q
  bQedA: number;
  first?: BdRef;
  last?: BdRef;
  rankBForA?: number;  // where B ranks among A's besties (1 = top bestie)
  rankAForB?: number;
}

interface PickerSlot {
  selected?: string;  // display-cased pax name
  search: string;
  suggestions: string[];
}

@Component({
  selector: 'app-vs',
  templateUrl: './vs.page.html',
  styleUrls: ['./vs.page.scss'],
})
export class VsPage implements OnInit {
  allBds?: Backblast[];
  allPaxNames: string[] = [];
  private namesByLower = new Map<string, string>();

  slots: PickerSlot[] = [
    {search: '', suggestions: []},
    {search: '', suggestions: []},
  ];

  stats?: VsStats;
  sharedBds?: Backblast[];
  recentShared?: Backblast[];

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly location: Location,
      private readonly backblastService: BackblastService,
  ) {}

  async ngOnInit() {
    this.allBds = await this.backblastService.getAllData();

    // build the unique pax list, keeping first-seen display casing
    for (const bd of this.allBds) {
      for (const name of bd.pax) {
        const lower = name.toLowerCase();
        if (!this.namesByLower.has(lower)) {
          this.namesByLower.set(lower, name);
        }
      }
    }
    this.allPaxNames = Array.from(this.namesByLower.values())
                           .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // deep link support: /vs/:name1/:name2
    const {name1, name2} = this.route.snapshot.params;
    this.slots[0].selected = this.resolveName(name1);
    this.slots[1].selected = this.resolveName(name2);
    this.calculate();
  }

  get name1(): string|undefined {
    return this.slots[0].selected;
  }

  get name2(): string|undefined {
    return this.slots[1].selected;
  }

  get bothSelected(): boolean {
    return !!this.name1 && !!this.name2;
  }

  get samePaxSelected(): boolean {
    return this.bothSelected &&
        this.name1!.toLowerCase() === this.name2!.toLowerCase();
  }

  private resolveName(param?: string): string|undefined {
    if (!param) return undefined;
    return this.namesByLower.get(decodeURIComponent(param).toLowerCase());
  }

  onSearchInput(slot: PickerSlot, event: Event) {
    // ngModel on ion-searchbar only syncs on the debounced ionChange, so read
    // the value straight off the input to keep suggestions keystroke-fresh
    slot.search = (event.target as HTMLInputElement)?.value ?? '';
    this.onSearch(slot);
  }

  onSearch(slot: PickerSlot) {
    const query = slot.search.trim().toLowerCase();
    if (!query) {
      slot.suggestions = [];
      return;
    }

    // names that start with the query rank above names that just contain it
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of this.allPaxNames) {
      const lower = name.toLowerCase();
      if (lower.startsWith(query)) {
        starts.push(name);
      } else if (lower.includes(query)) {
        contains.push(name);
      }
    }
    slot.suggestions = [...starts, ...contains].slice(0, 8);
  }

  select(slot: PickerSlot, name: string) {
    slot.selected = name;
    slot.search = '';
    slot.suggestions = [];
    this.updateUrl();
    this.calculate();
  }

  clear(slot: PickerSlot) {
    delete slot.selected;
    slot.search = '';
    slot.suggestions = [];
    delete this.stats;
    delete this.sharedBds;
    delete this.recentShared;
    this.updateUrl();
  }

  /** Picks a random pair that is guaranteed to have posted together. */
  feelingLucky() {
    const candidates =
        (this.allBds ?? []).filter(bd => bd.pax.length >= 2);
    if (candidates.length === 0) return;

    const bd = candidates[Math.floor(Math.random() * candidates.length)];
    const pax = this.utilService.shuffleArray([...bd.pax]);
    this.slots[0].selected = pax[0];
    this.slots[1].selected = pax[1];
    this.slots.forEach(slot => {
      slot.search = '';
      slot.suggestions = [];
    });
    this.updateUrl();
    this.calculate();
  }

  private updateUrl() {
    const url = this.bothSelected ?
        `/vs/${encodeURIComponent(this.name1!.toLowerCase())}/${
            encodeURIComponent(this.name2!.toLowerCase())}` :
        '/vs';
    this.location.replaceState(url);
  }

  private calculate() {
    delete this.stats;
    delete this.sharedBds;
    delete this.recentShared;

    if (!this.allBds || !this.bothSelected || this.samePaxSelected) return;

    const lower1 = this.name1!.toLowerCase();
    const lower2 = this.name2!.toLowerCase();

    let totalA = 0;
    let totalB = 0;
    const coCountsA = new Map<string, number>();
    const coCountsB = new Map<string, number>();
    const shared: Backblast[] = [];  // date descending, like allBds

    for (const bd of this.allBds) {
      const paxLower = bd.pax.map(name => name.toLowerCase());
      const hasA = paxLower.includes(lower1);
      const hasB = paxLower.includes(lower2);

      if (hasA) {
        totalA++;
        for (const name of paxLower) {
          if (name !== lower1) coCountsA.set(name, (coCountsA.get(name) ?? 0) + 1);
        }
      }
      if (hasB) {
        totalB++;
        for (const name of paxLower) {
          if (name !== lower2) coCountsB.set(name, (coCountsB.get(name) ?? 0) + 1);
        }
      }
      if (hasA && hasB) shared.push(bd);
    }

    const stats: VsStats = {
      together: shared.length,
      totalA,
      totalB,
      pctA: totalA > 0 ? shared.length / totalA : 0,
      pctB: totalB > 0 ? shared.length / totalB : 0,
      aQedB: 0,
      bQedA: 0,
    };

    if (shared.length > 0) {
      const aoCounts = new Map<string, {route: string; count: number}>();
      for (const bd of shared) {
        const qsLower = bd.qs.map(name => name.toLowerCase());
        if (qsLower.includes(lower1)) stats.aQedB++;
        if (qsLower.includes(lower2)) stats.bQedA++;

        const aoName = this.utilService.normalizeName(bd.ao);
        const entry = aoCounts.get(aoName) ??
            {route: bd.ao.trim().toLowerCase(), count: 0};
        entry.count++;
        aoCounts.set(aoName, entry);
      }

      const [topAo] = Array.from(aoCounts.entries())
                          .sort(([, a], [, b]) => b.count - a.count);
      stats.favoriteAo = {name: topAo[0], route: topAo[1].route, count: topAo[1].count};

      stats.first = this.toBdRef(shared[shared.length - 1]);
      stats.last = this.toBdRef(shared[0]);

      stats.rankBForA = this.bestieRank(coCountsA, lower2);
      stats.rankAForB = this.bestieRank(coCountsB, lower1);
    }

    this.stats = stats;
    this.sharedBds = shared;
    this.recentShared = shared.slice(0, 12);
  }

  /** 1-based rank of `target` in a co-post count map, undefined if absent. */
  private bestieRank(coCounts: Map<string, number>, target: string): number
      |undefined {
    const count = coCounts.get(target);
    if (!count) return undefined;

    let rank = 1;
    for (const value of coCounts.values()) {
      if (value > count) rank++;
    }
    return rank;
  }

  private toBdRef(bd: Backblast): BdRef {
    return {
      relativeDate: this.utilService.getRelativeDate(bd.date),
      ao: this.utilService.normalizeName(bd.ao),
      aoRoute: bd.ao.trim().toLowerCase(),
      backblastId: bd.id,
    };
  }
}
