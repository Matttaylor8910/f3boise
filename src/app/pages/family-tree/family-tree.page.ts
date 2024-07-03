import {Component, OnInit} from '@angular/core';
import {Node} from 'ngx-org-chart/lib/node';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax, PaxOrigin} from 'types';

@Component({
  selector: 'app-family-tree',
  templateUrl: './family-tree.page.html',
  styleUrls: ['./family-tree.page.scss'],
})
export class FamilyTreePage implements OnInit {
  mode: 'tree'|'list' = 'tree';
  direction: 'horizontal'|'vertical' = 'horizontal';

  nodes: Node[] = [];
  nodeMap = new Map<string, Node>();
  toggled = new Map<string, Node>();

  parentless: Pax[] = [];

  constructor(
      private readonly paxService: PaxService,
      private readonly utilService: UtilService,
  ) {}

  async ngOnInit() {
    // have the origins as the root nodes
    const nodes: Node[] = [];
    for (const origin of Object.values(PaxOrigin)) {
      if (origin !== PaxOrigin.PAX) {
        const node = this.getNode(this.paxService.getOriginLabel(origin));
        this.nodeMap.set(origin, node);
      }
    }

    // load all pax that have joined slack and build up a map
    const allPax = await this.paxService.getAllData();
    const paxMap = new Map<string, Pax>();
    allPax.forEach(pax => paxMap.set(pax.name.toLowerCase(), pax));

    // load all the tree relations we've stored to build out the tree
    const tree = await this.paxService.loadPaxTree();
    const seenPax = new Set<string>;

    for (const {pax_name, parent} of Object.values(tree)) {
      const {img_url = ''} = paxMap.get(pax_name) || {} as Pax;
      const name = this.utilService.normalizeName(pax_name);
      seenPax.add(pax_name);

      if (pax_name === 'big sky') {
        console.log(
            pax_name,
            parent.type === PaxOrigin.PAX ? parent.name : parent.type);
      }

      // get the node for this pax, or make a new one
      // reset the name to be from the response
      const node = this.nodeMap.get(pax_name) ?? this.getNode(name);
      node.name = name;
      node.image = img_url;

      // create a node for the parent if there isn't one already
      const parentKey =
          parent.type === PaxOrigin.PAX ? parent.name : parent.type;
      node.parent = this.nodeMap.get(parentKey) ??
          this.getNode(this.utilService.normalizeName(parentKey));
      const {img_url: parentImage = ''} = paxMap.get(parentKey) ?? {} as Pax;
      node.parent.image = parentImage;
      node.parent.childs.push(node);

      // persist each node to the nodeMap
      this.nodeMap.set(pax_name, node);
      this.nodeMap.set(parentKey, node.parent);
    }

    // generate a list of all pax with no parent set
    for (const pax of allPax) {
      if (!seenPax.has(pax.name.toLowerCase())) {
        this.parentless.push(pax);
      }
    }
    this.parentless.sort((a, b) => a.name.localeCompare(b.name));

    // Add any parent-less nodes that aren't already in the tree
    for (const node of this.nodeMap.values()) {
      if (!node.parent && !this.paxService.isPaxOrigin(node.name)) {
        nodes.push(node);
      }
    }

    this.nodes = nodes;
  }

  test($event: any) {
    const node = $event as Node;
    const [key] = node.name.split(' (');
    const toggled = this.toggled.get(key);

    if (toggled) {
      // if this node is currently toggled, restore the childs, its name, and
      // clear it from the toggled map
      node.childs = toggled.childs;
      node.name = toggled.name;
      this.toggled.delete(key);
    } else {
      // otherwise remove the children, show the hidden children as part of the
      // name, and store the cloned node
      if (node.childs.length) {
        const cloned = Object.assign({}, node) as Node;
        this.toggled.set(key, cloned);
        node.childs = [];
        node.name += ` (${this.getTotalChildren(cloned)})`;
      }
    }
  }

  toggleMode() {
    this.mode = this.mode === 'tree' ? 'list' : 'tree';
  }

  toggleDirection() {
    this.direction =
        this.direction === 'horizontal' ? 'vertical' : 'horizontal';
  }

  getNode(name = ''): Node {
    return {name, title: '', cssClass: '', image: '', childs: []};
  }

  getTotalChildren(node: Node, total = 0): number {
    for (const child of node.childs) {
      total += this.getTotalChildren(child);
    }
    return total + node.childs.length;
  }
}