import {Injectable} from '@angular/core';
import {Backblast, PAX} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/pax/all';

@Injectable({providedIn: 'root'})
export class PaxService {
  allData?: PAX[];
  paxMap: Map<string, PAX> = new Map<string, PAX>();

  // if multiple callers want all the pax data, respond with this promise
  currentPromise?: Promise<PAX[]>;

  constructor(
      private readonly http: HttpService,
  ) {
    this.loadAllData();
  }

  async loadAllData(): Promise<PAX[]> {
    this.allData = await this.http.get(URL) as PAX[];
    this.allData.forEach(pax => {
      this.paxMap.set(pax.name.toLowerCase(), pax);
    });
    return this.allData;
  }

  getAllData(): Promise<PAX[]> {
    if (this.currentPromise) {
      return this.currentPromise;
    } else {
      this.currentPromise = this.loadAllData();
      return this.currentPromise;
    }
  }

  async getPax(name: string): Promise<PAX|undefined> {
    if (!this.allData) await this.getAllData();
    return this.paxMap.get(name);
  }
}
