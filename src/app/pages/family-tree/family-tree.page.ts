import {Component, OnInit} from '@angular/core';
import {PaxService} from 'src/app/services/pax.service';

interface FamilyTreeNode {
  name: string;
  pax: Set<string>;
  children: FamilyTreeNode[];
}

@Component({
  selector: 'app-family-tree',
  templateUrl: './family-tree.page.html',
  styleUrls: ['./family-tree.page.scss'],
})
export class FamilyTreePage implements OnInit {
  constructor(
      private readonly paxService: PaxService,
  ) {}

  async ngOnInit() {
    // TODO - this pax data needs to be all 600+ pax, not the 300+ that are in
    // slack (which is what the pax service is)
    const pax = await this.paxService.getAllData();
    console.log(pax);

    const parentMap = new Map<string, FamilyTreeNode>();
    const unknown = new Set<string>();

    // loop through everyone, adding them to their parent's pax set
    for (const man of pax) {
      if (man.invited_by) {
        // re-using down the existing parent, or generating a new one, if this
        // is the first child
        const parent =
            parentMap.get(man.invited_by) ?? this.getNewNode(man.invited_by);

        // add this pax to the parent's set and save it
        parent.pax.add(man.name);
        parentMap.set(man.invited_by, parent);
      } else {
        // this pax doesn't have a parent
        unknown.add(man.name);
      }
    }

    console.log(parentMap.size, unknown.size);

    // now - iterate through the flat list of parents to create the tree
    for (const entry of parentMap.entries()) {
      const [_name, parent] = entry;

      // for every man who is a child of this parent, see if they have their own
      // tree node, and if not just create a new empty one
      for (const man of parent.pax) {
        const child = parentMap.get(man) ?? this.getNewNode(man);
        parent.children.push(child);

        // remove this node from the flat list as we go, so that we're only
        // left with parents in that list that don't have their own parent
        // (hence they were DR or an OG or we just don't know who brought them
        // out)
        parentMap.delete(man);
      }
    }

    // at this point, the only PAX left in that parentMap flat list are those
    // without the parent field set
    // add the remaining parentless parents to the root node
    const root = this.getNewNode('F3');
    for (const noParentMan of parentMap.entries()) {
      const [name, node] = noParentMan;
      root.children.push(node);
      root.pax.add(name);
    }

    console.log(root);
  }

  getNewNode(name: string): FamilyTreeNode {
    return {
      name,
      children: [],
      pax: new Set<string>(),
    };
  }

  handleFamilyTreeNodeClick() {
    // TODO
  }
}