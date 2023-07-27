import {Injectable} from '@angular/core';
import {Backblast, BBType} from 'types';

import {HttpService} from './http.service';
import {UtilService} from './util.service';

const BASE_URL = 'https://f3boiseapi-cycjv.ondigitalocean.app';

@Injectable({providedIn: 'root'})
export class BackblastService {
  allBackblasts?: Backblast[];
  allDoubleDowns?: Backblast[];

  constructor(
      private readonly http: HttpService,
      private readonly utilService: UtilService,
  ) {
    this.loadAllData(BBType.BACKBLAST);
    this.loadAllData(BBType.DOUBLEDOWN);
  }

  async loadAllData(type: BBType): Promise<Backblast[]> {
    const url = `${BASE_URL}/${this.getRoute(type)}/all`;
    this.allBackblasts = await this.http.get(url) as Backblast[];
    this.allBackblasts.forEach(backblast => {
      backblast.ao = this.utilService.normalizeName(backblast.ao);
    });
    return this.allBackblasts;
  }

  async getAllData(type = BBType.BACKBLAST): Promise<Backblast[]> {
    if (type === BBType.BACKBLAST && this.allBackblasts) {
      return this.allBackblasts;
    } else if (type === BBType.DOUBLEDOWN && this.allDoubleDowns) {
      return this.allDoubleDowns;
    }
    return this.loadAllData(type);
  }

  async getBackblastsForAo(name: string, type = BBType.BACKBLAST):
      Promise<Backblast[]> {
    const data = await this.getAllData(type);
    return data.filter(backblast => {
      return backblast.ao.toLowerCase() === name.toLowerCase();
    });
  }

  async getBackblastsForPax(name: string, type = BBType.BACKBLAST):
      Promise<Backblast[]> {
    const data = await this.getAllData(type);
    return data.filter(backblast => {
      return backblast.pax.some(pax => {
        return pax.toLowerCase() === name.toLowerCase();
      });
    });
  }

  private getRoute(type: BBType) {
    switch (type) {
      case BBType.DOUBLEDOWN:
        return 'double_downs';
      default:
        return 'back_blasts';
    }
  }
}
