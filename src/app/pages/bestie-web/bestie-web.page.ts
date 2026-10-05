import {Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast} from 'types';

import {BestieGraph, BestieNode, BestieRecord, buildBestieGraph, computeBesties} from './bestie-graph';
import {BestieWebCanvas, webColor, WebTheme} from './bestie-web-canvas';

interface WebStat {
  value: string;
  label: string;
}

interface MinPostsOption {
  label: string;
  value: string;
}

interface Admirer {
  key: string;
  name: string;
  count: number;
}

interface Selection {
  key: string;
  name: string;
  bestieKey: string;
  bestieName: string;
  bestieCount: number;
  mutual: boolean;
  posts: number;
  webSize: number;
  color: string;
  admirers: Admirer[];
}

interface SearchResult {
  key: string;
  name: string;
  posts: number;
}

const MIN_POSTS_OPTIONS: MinPostsOption[] = [
  {label: 'Everyone', value: '1'},
  {label: '5+ BDs', value: '5'},
  {label: '25+ BDs', value: '25'},
  {label: '100+ BDs', value: '100'},
];

interface TimeRangeOption {
  label: string;
  value: string;  // days back from today, '' = all time
}

const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  {label: 'All time', value: ''},
  {label: 'Past year', value: '365'},
  {label: '90 days', value: '90'},
  {label: '30 days', value: '30'},
];

const DEFAULT_MIN_POSTS = '5';
const MAX_SEARCH_RESULTS = 8;

@Component({
  selector: 'app-bestie-web',
  templateUrl: './bestie-web.page.html',
  styleUrls: ['./bestie-web.page.scss'],
})
export class BestieWebPage implements OnInit, OnDestroy {
  @ViewChild('canvas', {static: true})
  canvasRef?: ElementRef<HTMLCanvasElement>;

  loaded = false;
  stats: WebStat[] = [];

  readonly minPostsOptions = MIN_POSTS_OPTIONS;
  minPosts = DEFAULT_MIN_POSTS;

  readonly timeRangeOptions = TIME_RANGE_OPTIONS;
  timeRange = '';

  query = '';
  searchResults: SearchResult[] = [];

  selection: Selection|null = null;

  private backblasts: Backblast[] = [];
  private records = new Map<string, BestieRecord>();
  private graph?: BestieGraph;
  private web?: BestieWebCanvas;
  private colorScheme?: MediaQueryList;
  private readonly onSchemeChange = () => this.web?.setTheme(this.readTheme());

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly zone: NgZone,
  ) {}

  async ngOnInit() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    // the canvas runs its own pointer and animation loop outside Angular so
    // change detection only fires when a selection actually changes
    this.web = this.zone.runOutsideAngular(() => new BestieWebCanvas(canvas, {
      onSelect: node => this.zone.run(() => this.onSelect(node)),
    }));
    this.web.setTheme(this.readTheme());

    if (typeof window.matchMedia === 'function') {
      this.colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
      this.colorScheme.addEventListener?.('change', this.onSchemeChange);
    }

    const [backblasts, allPax] = await Promise.all([
      this.backblastService.getAllData(),
      this.paxService.getAllData(),
    ]);

    const avatars = new Map<string, string>();
    for (const pax of allPax) {
      if (pax.img_url) avatars.set(pax.name.toLowerCase(), pax.img_url);
    }
    this.web.setAvatars(avatars);

    this.backblasts = backblasts;
    this.recomputeRecords();
    this.loaded = true;

    // a pax profile can deep-link here with that HIM pre-selected
    const target = this.route.snapshot.queryParamMap.get('pax')?.toLowerCase();
    if (target && this.records.has(target)) {
      // make sure they're on the web regardless of the post filter
      const posts = this.records.get(target)?.posts ?? 0;
      const option = [...MIN_POSTS_OPTIONS].reverse().find(
          candidate => Number(candidate.value) <= posts);
      if (option && Number(option.value) < Number(this.minPosts)) {
        this.minPosts = option.value;
      }
    }

    this.rebuild();
    if (target) this.focus(target);
  }

  ngOnDestroy() {
    this.web?.destroy();
    this.colorScheme?.removeEventListener?.('change', this.onSchemeChange);
  }

  /** Builds the web for the current time range and post filter. */
  rebuild() {
    if (!this.web) return;
    this.graph = buildBestieGraph(this.records, Number(this.minPosts));
    this.web.setGraph(this.graph);

    // keep the selected HIM lit up if they survived the filter change
    const key = this.selection?.key;
    if (key && this.graph.nodeMap.has(key)) {
      this.web.select(key);
    } else {
      if (this.selection) this.syncUrl(null);
      this.selection = null;
    }
    this.calculateStats();
  }

  onMinPostsChange(value: string) {
    if (value === this.minPosts) return;
    this.minPosts = value;
    this.rebuild();
  }

  onTimeRangeChange(value: string) {
    if (value === this.timeRange) return;
    this.timeRange = value;
    this.recomputeRecords();
    this.rebuild();
  }

  /** Recomputes everyone's bestie from the backblasts in the time range. */
  private recomputeRecords() {
    const days = Number(this.timeRange);
    let backblasts = this.backblasts;
    if (days > 0) {
      // ISO dates compare lexicographically
      const cutoff = moment().subtract(days, 'days').format('YYYY-MM-DD');
      backblasts = backblasts.filter(backblast => backblast.date >= cutoff);
    }
    this.records = computeBesties(backblasts);
  }

  fit() {
    this.web?.select(null);
    this.web?.fit();
  }

  /** Selects a HIM and brings the view to them. */
  focus(key: string) {
    this.clearSearch();
    this.web?.select(key, true);
  }

  onSearch(event: Event) {
    this.query = (event.target as HTMLInputElement)?.value ?? '';
    const query = this.query.trim().toLowerCase();
    if (!query || !this.graph) {
      this.searchResults = [];
      return;
    }

    this.searchResults =
        this.graph.nodes
            .filter(
                node => node.key.includes(query) ||
                    this.utilService.normalizeName(node.name)
                        .toLowerCase()
                        .includes(query))
            .sort((a, b) => b.posts - a.posts)
            .slice(0, MAX_SEARCH_RESULTS)
            .map(node => ({
                   key: node.key,
                   name: this.utilService.normalizeName(node.name),
                   posts: node.posts,
                 }));
  }

  clearSearch() {
    this.query = '';
    this.searchResults = [];
  }

  closeSelection() {
    this.web?.select(null);
  }

  goToPax(key: string) {
    this.router.navigateByUrl(`/pax/${key}`);
  }

  goToVs(key: string, other: string) {
    this.router.navigate(['/vs', key, other]);
  }

  private onSelect(node: BestieNode|null) {
    this.syncUrl(node?.key ?? null);
    if (!node || !this.graph) {
      this.selection = null;
      return;
    }

    const bestie = this.graph.nodeMap.get(node.bestie);
    const admirers: Admirer[] =
        node.admirers
            .map(key => {
              const admirer = this.graph?.nodeMap.get(key);
              return {
                key,
                name: this.utilService.normalizeName(admirer?.name ?? key),
                count: admirer?.bestieCount ?? 0,
              };
            })
            .sort(
                (a, b) =>
                    (b.count - a.count) || a.name.localeCompare(b.name));

    this.selection = {
      key: node.key,
      name: this.utilService.normalizeName(node.name),
      bestieKey: node.bestie,
      bestieName: this.utilService.normalizeName(bestie?.name ?? node.bestie),
      bestieCount: node.bestieCount,
      mutual: node.mutual,
      posts: node.posts,
      webSize: this.graph.webs[node.web]?.nodes.length ?? 1,
      color: webColor(node.web),
      admirers,
    };
  }

  /** Mirrors the current selection into the ?pax= param so the view is shareable. */
  private syncUrl(key: string|null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {pax: key},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private calculateStats() {
    if (!this.graph) {
      this.stats = [];
      return;
    }

    const {nodes, edges, webs} = this.graph;
    const mutualPairs = edges.filter(edge => edge.mutual).length / 2;

    let mostWanted: BestieNode|undefined;
    for (const node of nodes) {
      if (!mostWanted || node.admirers.length > mostWanted.admirers.length) {
        mostWanted = node;
      }
    }

    const biggest = webs[0]?.nodes.length ?? 0;
    this.stats = [
      {value: `${nodes.length}`, label: 'PAX on the web'},
      {value: `${mutualPairs}`, label: 'mutual bestie pairs'},
      {
        value: `${webs.length}`,
        label: webs.length === 1 ? 'web' : `webs, biggest is ${biggest} PAX`,
      },
      {
        value: mostWanted ? this.utilService.normalizeName(mostWanted.name) :
                            '—',
        label: mostWanted ?
            `bestie to ${mostWanted.admirers.length} PAX` :
            '',
      },
    ];
  }

  /** Pulls the Ionic theme colours so the canvas matches light and dark. */
  private readTheme(): WebTheme {
    const style = getComputedStyle(document.body);
    const read = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;
    return {
      text: read('--ion-text-color', '#000000'),
      muted: read('--ion-color-medium', '#92949c'),
      background: read(
          '--ion-card-background', read('--ion-background-color', '#ffffff')),
      primary: read('--ion-color-primary', '#3880ff'),
    };
  }
}
