import {Injectable} from '@angular/core';
import {Pax} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/pax/';

interface SetParentBody {
  slack_id: string;
  invited_by: null|string|{
    pax: string | null,
  };
}

export enum PaxOrigin {
  AT_BD = 'EH\'ed at/during BD',
  DR_EH = 'EH\'ed from DR PAX',
  MOVED = 'Moved from DR',
  ONLINE = 'Found F3 online',
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

  async getPax(name: string): Promise<Pax|undefined> {
    if (!this.allData) await this.getAllData();
    return this.paxMap.get(name.toLowerCase());
  }

  async setParent(name: string, invitedBy: string) {
    const {id} = await this.getPax(name) as Pax;
    const body: SetParentBody = {
      slack_id: id,
      invited_by: {
        pax: invitedBy,
      },
    };
    return this.http.post(URL + 'set-parent', body);
  }

  async clear(name: string) {
    // TODO: ensure we use whatever clearing mechanism @Stinger sets up
    const {id} = await this.getPax(name) as Pax;
    const body: SetParentBody = {
      slack_id: id,
      invited_by: null,
    };

    return await this.http.post(URL + 'set-parent', body);
  }
}
