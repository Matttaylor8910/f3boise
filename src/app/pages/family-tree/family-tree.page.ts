import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax, PaxOrigin} from 'types';

interface FamilyNode {
  key: string;   // lowercase identity
  name: string;  // display name
  isOrigin: boolean;
  icon?: string;  // origin roots only
  children: FamilyNode[];
  directs: number;      // direct children
  descendants: number;  // all descendants
  depth: number;        // 0 = origin root
  expanded: boolean;
  match: boolean;         // search: name matches the query
  searchVisible: boolean;  // search: node or a descendant matches
}

interface TreeStat {
  value: string;
  label: string;
}

const ORIGIN_UNKNOWN = 'unknown';

const ORIGIN_ICONS: {[key: string]: string} = {
  [PaxOrigin.AT_BD]: 'barbell-outline',
  [PaxOrigin.DR_EH]: 'people-outline',
  [PaxOrigin.MOVED]: 'home-outline',
  [PaxOrigin.ONLINE]: 'globe-outline',
  [ORIGIN_UNKNOWN]: 'help-circle-outline',
};

@Component({
  selector: 'app-family-tree',
  templateUrl: './family-tree.page.html',
  styleUrls: ['./family-tree.page.scss'],
})
export class FamilyTreePage implements OnInit {
  loaded = false;

  roots: FamilyNode[] = [];
  stats: TreeStat[] = [];

  query = '';

  parentless: Pax[] = [];
  showParentless = false;

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
      private readonly paxService: PaxService,
  ) {}

  async ngOnInit() {
    const allPax = await this.paxService.getAllData();
    const paxMap = new Map<string, Pax>();
    allPax.forEach(pax => paxMap.set(pax.name.toLowerCase(), pax));

    const tree = await this.paxService.loadPaxTree();

    // build a node for every pax in the tree, keyed by lowercase name
    const nodes = new Map<string, FamilyNode>();
    const nodeFor = (key: string): FamilyNode => {
      const lower = key.toLowerCase();
      let node = nodes.get(lower);
      if (!node) {
        node = this.newNode(lower, this.utilService.normalizeName(key));
        nodes.set(lower, node);
      }
      return node;
    };

    // origin roots, in a fixed order
    const originOrder = [
      PaxOrigin.AT_BD, PaxOrigin.DR_EH, PaxOrigin.MOVED, PaxOrigin.ONLINE
    ];
    const origins = new Map<string, FamilyNode>();
    for (const origin of originOrder) {
      const node =
          this.newNode(origin, this.paxService.getOriginLabel(origin));
      node.isOrigin = true;
      node.icon = ORIGIN_ICONS[origin];
      origins.set(origin, node);
    }
    const unknown = this.newNode(ORIGIN_UNKNOWN, 'Origin unknown');
    unknown.isOrigin = true;
    unknown.icon = ORIGIN_ICONS[ORIGIN_UNKNOWN];

    // wire up parent → child relationships
    const hasParent = new Set<string>();
    const seenPax = new Set<string>();
    for (const {pax_name, parent} of Object.values(tree)) {
      const child = nodeFor(pax_name);
      seenPax.add(pax_name.toLowerCase());

      if (parent.type === PaxOrigin.PAX && parent.name) {
        nodeFor(parent.name).children.push(child);
        seenPax.add(parent.name.toLowerCase());
      } else {
        origins.get(parent.type)?.children.push(child);
      }
      hasParent.add(child.key);
    }

    // pax that show up only as parents belong under "origin unknown"
    for (const node of nodes.values()) {
      if (!hasParent.has(node.key)) {
        unknown.children.push(node);
      }
    }

    const roots = [...origins.values(), unknown].filter(
        origin => origin.children.length > 0);
    roots.forEach(root => this.finalize(root, 0));
    this.roots = roots;

    this.calculateStats(nodes);

    // slack pax with no lineage recorded at all
    this.parentless =
        allPax.filter(pax => !seenPax.has(pax.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

    this.loaded = true;
  }

  get searching(): boolean {
    return this.query.trim().length > 0;
  }

  onSearch(event: Event) {
    this.query = (event.target as HTMLInputElement)?.value ?? '';
    const query = this.query.trim().toLowerCase();
    for (const root of this.roots) {
      this.applySearch(root, query);
    }
  }

  toggle(node: FamilyNode, event: Event) {
    event.stopPropagation();
    if (this.searching) return;  // search controls visibility
    node.expanded = !node.expanded;
  }

  rowTapped(node: FamilyNode) {
    if (node.isOrigin) {
      node.expanded = !node.expanded;
    } else if (node.children.length > 0 && !this.searching) {
      node.expanded = !node.expanded;
    } else {
      this.goToPax(node.key);
    }
  }

  goToPax(key: string, event?: Event) {
    event?.stopPropagation();
    this.router.navigateByUrl(`/pax/${key}`);
  }

  setAll(expanded: boolean) {
    const visit = (node: FamilyNode) => {
      node.expanded = expanded || node.isOrigin;
      node.children.forEach(visit);
    };
    this.roots.forEach(visit);
  }

  /** During search, a branch renders if the node or any descendant matches. */
  visibleChildren(node: FamilyNode): FamilyNode[] {
    if (!this.searching) return node.children;
    return node.children.filter(child => child.searchVisible);
  }

  showChildren(node: FamilyNode): boolean {
    if (this.searching) return this.visibleChildren(node).length > 0;
    return node.expanded && node.children.length > 0;
  }

  get anySearchResults(): boolean {
    return this.roots.some(root => root.searchVisible);
  }

  private newNode(key: string, name: string): FamilyNode {
    return {
      key,
      name,
      isOrigin: false,
      children: [],
      directs: 0,
      descendants: 0,
      depth: 0,
      expanded: false,
      match: false,
      searchVisible: false,
    };
  }

  /** Sorts children (big families first), sets counts and depth. */
  private finalize(node: FamilyNode, depth: number): number {
    node.depth = depth;
    node.directs = node.children.length;
    node.expanded = node.isOrigin;  // origins start open, branches closed

    node.children.sort(
        (a, b) => (b.children.length - a.children.length) ||
            a.name.localeCompare(b.name));

    let descendants = 0;
    for (const child of node.children) {
      descendants += 1 + this.finalize(child, depth + 1);
    }
    node.descendants = descendants;
    return descendants;
  }

  private applySearch(node: FamilyNode, query: string): boolean {
    node.match = !node.isOrigin && query.length > 0 &&
        node.name.toLowerCase().includes(query);

    let childVisible = false;
    for (const child of node.children) {
      childVisible = this.applySearch(child, query) || childVisible;
    }

    node.searchVisible = node.match || childVisible;
    return node.searchVisible;
  }

  private calculateStats(nodes: Map<string, FamilyNode>) {
    let paxCount = 0;
    let generations = 0;
    let top: FamilyNode|undefined;

    for (const node of nodes.values()) {
      paxCount++;
      generations = Math.max(generations, node.depth);
      if (!top || node.descendants > top.descendants) {
        top = node;
      }
    }

    this.stats = [
      {value: `${paxCount}`, label: 'PAX in the tree'},
      {value: `${generations}`, label: 'generations deep'},
      {
        value: top ? `${top.name}` : '—',
        label: top ? `biggest family: ${top.descendants} PAX` : '',
      },
    ];
  }
}
