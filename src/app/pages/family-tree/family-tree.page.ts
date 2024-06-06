import {Component, OnInit} from '@angular/core';
import {Node} from 'ngx-org-chart/lib/node';
import {PaxOrigin, PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax} from 'types';

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

  parentless: Pax[] = [];
  allPax: Pax[] = [];

  constructor(
      private readonly paxService: PaxService,
      private readonly utilService: UtilService,
  ) {}

  async ngOnInit() {
    // have the origins as the root nodes
    const nodes: Node[] = [
      this.getNode(PaxOrigin.AT_BD),
      this.getNode(PaxOrigin.DR_EH),
      this.getNode(PaxOrigin.MOVED),
      this.getNode(PaxOrigin.ONLINE),
    ];
    nodes.forEach(node => this.nodeMap.set(node.name.toLowerCase(), node));

    this.allPax = await this.paxService.getAllData();
    for (const pax of this.allPax) {
      if (pax.invited_by) {
        // get the node for this pax, or make a new one
        // reset the name to be from the response
        const key = pax.name.toLowerCase();
        const node = this.nodeMap.get(key) ?? this.getNode(pax.name);
        node.name = pax.name;
        node.image = pax.img_url ?? '';

        // create a node for the parent if there isn't one already
        const parentKey = pax.invited_by.pax.toLowerCase();
        const parent = await this.paxService.getPax(parentKey);
        node.parent = this.nodeMap.get(parentKey) ??
            this.getNode(this.utilService.normalizeName(parentKey));
        node.parent.image = parent?.img_url ?? '';
        node.parent.childs.push(node);

        // persist each node to the nodeMap
        this.nodeMap.set(key, node);
        this.nodeMap.set(parentKey, node.parent);
      } else {
        this.parentless.push(pax);
      }
    }

    // Add any parent-less nodes that aren't already in the tree
    const paxOrigins = Object.values(PaxOrigin).map(String);
    for (const node of this.nodeMap.values()) {
      if (!node.parent && !paxOrigins.includes(node.name)) {
        nodes.push(node);
      }
    }

    this.nodes = nodes;
  }

  test($event: any) {
    console.log($event);
  }

  toggleMode() {
    this.mode = this.mode === 'tree' ? 'list' : 'tree';
  }

  toggleDirection() {
    this.direction =
        this.direction === 'horizontal' ? 'vertical' : 'horizontal';
  }

  getNode(name: string): Node {
    return {name, title: '', cssClass: '', image: '', childs: []};
  }
}