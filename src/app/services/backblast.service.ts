import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {Backblast, BBType} from 'types';

import {BASE_URL, CANYON_AOS, CITY_OF_TREES_AOS, HIGH_DESERT_AOS, REGION, SETTLERS_AOS} from '../../../constants';

import {HttpService} from './http.service';
import {UtilService} from './util.service';

@Injectable({providedIn: 'root'})
export class BackblastService {
  allBackblasts?: Backblast[];
  allDoubleDowns?: Backblast[];

  constructor(
      private readonly http: HttpService,
      private readonly utilService: UtilService,
      private readonly router: Router,
  ) {
    this.loadAllData(BBType.BACKBLAST);
    this.loadAllData(BBType.DOUBLEDOWN);
  }

  async loadAllData(type: BBType): Promise<Backblast[]> {
    const url = `${BASE_URL}/${this.getRoute(type)}/all`;
    let backblasts = await this.http.get(url) as Backblast[];
    backblasts.forEach(backblast => {
      backblast.ao = this.utilService.normalizeName(backblast.ao);
    });

    if (type === BBType.BACKBLAST) {
      this.allBackblasts = backblasts;
    } else {
      this.allDoubleDowns = backblasts;
    }

    return backblasts;
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
      const backblastAo = backblast.ao.toLowerCase();

      switch (name) {
        case REGION.CITY_OF_TREES:
          return CITY_OF_TREES_AOS.has(backblastAo);
        case REGION.HIGH_DESERT:
          return HIGH_DESERT_AOS.has(backblastAo);
        case REGION.SETTLERS:
          return SETTLERS_AOS.has(backblastAo);
        case REGION.CANYON:
          return CANYON_AOS.has(backblastAo);
        default:
          return backblastAo === name.toLowerCase();
      }
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

  async getBackblast(id: string): Promise<Backblast> {
    const url = `${BASE_URL}/back_blasts/single/${id}`;
    const backblast = await this.http.get(url) as Backblast;
    return backblast;
  }

  async goToRandomBackblast() {
    // get and shuffle all backblasts
    const all = await this.getAllData();
    this.utilService.shuffleArray(all);

    // then find the first that has a moleskine and route there
    let randomId = '';
    for (const backblast of all) {
      const single = await this.getBackblast(backblast.id);
      if (single.moleskine && !single.ao.includes('Ruck')) {
        randomId = single.id;
        break;
      }
    }
    this.router.navigateByUrl(`/backblasts/${randomId}`);
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
