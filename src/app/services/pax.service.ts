import {Injectable} from '@angular/core';
import {Parent, Pax, PaxOrigin} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/pax/';

interface PaxTreeNode {
  pax_name: string;
  slack_id?: string;
  parent: null|Parent;
}

interface PaxTree {
  [key: string]: {pax_name: string, parent: Parent};
}

@Injectable({providedIn: 'root'})
export class PaxService {
  allData?: Pax[];
  paxMap: Map<string, Pax> = new Map<string, Pax>();
  parentMap: Map<string, Parent> = new Map<string, Parent>();

  // if multiple callers want all the pax data, respond with this promise
  private currentPromise?: Promise<Pax[]>;

  constructor(
      private readonly http: HttpService,
  ) {
    this.loadPaxData();
    this.loadPaxTree();
  }

  async loadPaxData(): Promise<Pax[]> {
    this.allData = await this.http.get(URL + 'all') as Pax[];
    this.allData.forEach(pax => {
      this.paxMap.set(pax.name.toLowerCase(), pax);
    });
    return this.allData;
  }

  async loadPaxTree(): Promise<PaxTree> {
    const tree = await this.http.get(URL + 'tree') as PaxTree;
    for (const {pax_name, parent} of Object.values(tree)) {
      this.parentMap.set(pax_name, parent);
    }
    return tree;
  }

  getAllData(): Promise<Pax[]> {
    if (this.currentPromise) {
      return this.currentPromise;
    } else {
      this.currentPromise = this.loadPaxData();
      return this.currentPromise;
    }
  }

  async getPax(name: string): Promise<Pax|undefined> {
    if (!this.allData) await this.getAllData();
    return this.paxMap.get(name.toLowerCase());
  }

  async getParent(name: string, reload = false): Promise<Parent|undefined> {
    if (this.parentMap.size === 0 || reload) await this.loadPaxTree();
    return this.parentMap.get(name.toLowerCase());
  }

  async setParent(name: string, invitedBy: string): Promise<Pax[]> {
    const {id = ''} = await this.getPax(name) || {} as Pax;

    let type = PaxOrigin.PAX;
    let parentName = invitedBy;
    let {id: parentSlackId} = await this.getPax(parentName) || {} as Pax;

    if (this.isPaxOrigin(invitedBy)) {
      type = invitedBy as PaxOrigin;
      parentName = '';
      parentSlackId = '';
    }

    const body: PaxTreeNode = {
      pax_name: name,
      slack_id: id,
      parent: {
        type,
        name: parentName,
        slackId: parentSlackId,
      },
    };
    await this.http.post(URL + 'set-pax-parent', body);
    return this.loadPaxData();
  }

  getOriginLabel(origin: PaxOrigin): string {
    switch (origin) {
      case PaxOrigin.AT_BD:
        return 'EH\'ed at/during BD';
      case PaxOrigin.DR_EH:
        return 'EH\'ed from DR PAX';
      case PaxOrigin.MOVED:
        return 'Moved from DR';
      case PaxOrigin.ONLINE:
        return 'Found F3 online';
      default:
        return '';
    }
  }

  isPaxOrigin(text: string): boolean {
    return Object.values(PaxOrigin).map(String).includes(text);
  }
}
