import {Injectable} from '@angular/core';
import {Parent, Pax, PaxOrigin} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/pax/';

interface SetParentBody {
  pax_name: string;
  slack_id?: string;
  parent: null|Parent;
}

@Injectable({providedIn: 'root'})
export class PaxService {
  allData?: Pax[];
  paxMap: Map<string, Pax> = new Map<string, Pax>();

  // if multiple callers want all the pax data, respond with this promise
  currentPromise?: Promise<Pax[]>;

  constructor(
      private readonly http: HttpService,
  ) {
    this.loadAllData();
  }

  async loadAllData(): Promise<Pax[]> {
    this.allData = await this.http.get(URL + 'all') as Pax[];
    this.allData.forEach(pax => {
      this.paxMap.set(pax.name.toLowerCase(), pax);
    });
    return this.allData;
  }

  getAllData(): Promise<Pax[]> {
    if (this.currentPromise) {
      return this.currentPromise;
    } else {
      this.currentPromise = this.loadAllData();
      return this.currentPromise;
    }
  }

  async getPax(name: string, reload = false): Promise<Pax|undefined> {
    if (!this.allData) await this.getAllData();
    return this.paxMap.get(name.toLowerCase());
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

    const body: SetParentBody = {
      pax_name: name,
      slack_id: id,
      parent: {
        type,
        name: parentName,
        slackId: parentSlackId,
      },
    };
    await this.http.post(URL + 'set-pax-parent', body);
    return this.loadAllData();
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
