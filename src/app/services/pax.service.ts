import {Injectable} from '@angular/core';
import {Pax} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/pax/all';

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
    this.allData = await this.http.get(URL) as Pax[];
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
}
