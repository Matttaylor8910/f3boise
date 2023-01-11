import {Injectable} from '@angular/core';
import {Backblast} from 'types';

import {HttpService} from './http.service';
import {UtilService} from './util.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/back_blasts/all';

@Injectable({providedIn: 'root'})
export class BackblastService {
  allData?: Backblast[];

  constructor(
      private readonly http: HttpService,
      private readonly utilService: UtilService,
  ) {
    this.loadAllData();
  }

  async loadAllData(): Promise<Backblast[]> {
    this.allData = await this.http.get(URL) as Backblast[];
    this.allData.forEach(backblast => {
      backblast.ao = this.utilService.normalizeName(backblast.ao);
    });
    return this.allData;
  }

  async getAllData(): Promise<Backblast[]> {
    return this.allData ?? await this.loadAllData();
  }

  async getBackblastsForAo(name: string): Promise<Backblast[]> {
    const data = this.allData ?? await this.loadAllData();
    return data.filter(backblast => {
      return backblast.ao.toLowerCase() === name.toLowerCase();
    });
  }

  async getBackblastsForPax(name: string): Promise<Backblast[]> {
    const data = this.allData ?? await this.loadAllData();
    return data.filter(backblast => {
      return backblast.pax.some(pax => {
        return pax.toLowerCase() === name.toLowerCase();
      });
    });
  }
}
