import {Injectable} from '@angular/core';
import {IBackblast} from 'types';

import {HttpService} from './http.service';

const URL = 'https://f3boiseapi-cycjv.ondigitalocean.app/back_blasts/all';
// const URL = 'assets/all.json';

@Injectable({providedIn: 'root'})
export class BackblastService {
  allData?: IBackblast[];

  constructor(
      private readonly http: HttpService,
  ) {
    this.loadAllData();
  }

  async loadAllData(): Promise<IBackblast[]> {
    this.allData = await this.http.get(URL) as IBackblast[];
    return this.allData;
  }

  async getBackblastsForAo(name: string): Promise<IBackblast[]> {
    const data = this.allData ?? await this.loadAllData();
    return data.filter(backblast => {
      return backblast.ao.toLowerCase() === name.toLowerCase();
    });
  }

  async getBackblastsForPax(name: string): Promise<IBackblast[]> {
    const data = this.allData ?? await this.loadAllData();
    return data.filter(backblast => {
      return backblast.pax.some(pax => {
        return pax.toLowerCase() === name.toLowerCase();
      });
    });
  }
}
