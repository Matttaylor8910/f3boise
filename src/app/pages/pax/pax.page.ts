import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ActionSheetController} from '@ionic/angular';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast, BBType} from 'types';

interface PaxStats {
  name: string;
  posts: number;
  favoriteAo: string;
  qs: number;
  qRate: number;
  firstBdDate: string;
  firstBdPax: string[];
  firstAo: string;
  lastBdDate: string;
  lastAo: string;
  firstQDate?: string;
  lastQDate?: string;
  firstQAo?: string;
  lastQAo?: string;
  bestie?: string;
  bestieCount?: number;
  paxTally?: number;
  avgPaxAsQ?: number;
}

interface AoStats {
  name: string;
  total: number;
}
@Component({
  selector: 'app-pax',
  templateUrl: './pax.page.html',
  styleUrls: ['./pax.page.scss'],
})
export class PaxPage {
  name: string;

  statsType = BBType.BACKBLAST;
  ddCount = 0;

  stats?: PaxStats;
  favoriteAos?: AoStats[];
  allBds?: Backblast[];
  recentBds?: Backblast[];

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly actionSheetController: ActionSheetController,
  ) {
    this.name = this.route.snapshot.params['name'];

    // load the statsType if it exists
    const statsType = localStorage.getItem('BBTYPE');
    if (statsType !== null) this.statsType = statsType as BBType;
    localStorage.removeItem('BBTYPE');
  }

  ionViewDidEnter() {
    this.calculatePaxStats(this.statsType);
    this.determineShowDDButton();
  }

  get toggleButtonText(): string {
    if (this.statsType === BBType.BACKBLAST && this.ddCount > 0) {
      return `Show ${this.ddCount} Double Down${this.ddCount === 1 ? '' : 's'}`;
    }

    if (this.statsType === BBType.DOUBLEDOWN && this.stats) {
      return `Show beatdowns`;
    }

    return '';
  }

  toggleStats() {
    this.statsType = this.statsType === BBType.BACKBLAST ? BBType.DOUBLEDOWN :
                                                           BBType.BACKBLAST;
    this.calculatePaxStats(this.statsType);
  }

  async calculatePaxStats(type: BBType) {
    // load the data and no-op if they have no data
    const data =
        await this.backblastService.getBackblastsForPax(this.name, type);

    this.allBds = data;
    this.recentBds = data.slice(0, 10);
    if (data.length === 0) {
      return;
    }

    const aoCount = new Map<string, AoStats>();
    let qCount = 0;
    let totalPaxAsQ = 0;
    let firstQDate = undefined;
    let lastQDate = undefined;
    let firstQAo = undefined;
    let lastQAo = undefined;

    const besties = new Map<string, number>();

    for (const post of data) {
      const ao = aoCount.get(post.ao) ?? {name: post.ao, total: 0};
      ao.total++;
      aoCount.set(ao.name, ao);

      post.pax.forEach(pax => {
        if (this.name.toLowerCase() !== pax.toLowerCase()) {
          const count = besties.get(pax) ?? 0;
          besties.set(pax, count + 1);
        }
      });

      // data is date descending, so set the new first Q each time
      if (post.qs.includes(this.name)) {
        qCount++;
        totalPaxAsQ += post.pax.length - post.qs.length;  // don't include qs
        firstQDate = post.date;
        firstQAo = post.ao;

        // the first post in the list where this pax is the Q, that's their most
        // recent (or last) Q date
        if (!lastQDate) {
          lastQDate = post.date;
          lastQAo = post.ao;
        }
      }
    }

    this.favoriteAos =
        Array.from(aoCount.values()).sort((a, b) => b.total - a.total);

    // sort besties and pick your top one
    const sorted = Array.from(besties.entries()).sort(([, a], [, b]) => b - a);
    const [[bestie, bestieCount]] = sorted;

    // grab some fields off the first beatdown
    const {date, ao, pax} = data[data.length - 1];

    this.stats = {
      name: this.name,
      posts: data.length,
      favoriteAo: this.favoriteAos[0].name,
      qs: qCount,
      qRate: qCount / data.length,
      firstBdDate: this.utilService.getRelativeDate(date),
      firstAo: ao,
      firstBdPax: pax,
      lastBdDate: this.utilService.getRelativeDate(data[0].date),
      lastAo: data[0].ao,
      firstQDate: this.utilService.getRelativeDate(firstQDate),
      lastQDate: this.utilService.getRelativeDate(lastQDate),
      firstQAo,
      lastQAo,
      bestie,
      bestieCount,
      paxTally: sorted.length,
      avgPaxAsQ: qCount === 0 ? 0 : totalPaxAsQ / qCount,
    };
  }

  async determineShowDDButton() {
    const dds = await this.backblastService.getBackblastsForPax(
        this.name, BBType.DOUBLEDOWN);

    this.ddCount = dds.length;
  }

  async getParentSuggestions() {
    // create a button for each pax name
    const pax = this.stats?.firstBdPax ?? [];
    const nameButtons = pax.filter(name => name !== this.name).map(name => {
      const normalized = this.utilService.normalizeName(name);
      return {text: normalized, role: name};
    });

    // display the sheet
    const sheet = await this.actionSheetController.create({
      header:
          `Who was ${this.utilService.normalizeName(this.name)} invited by?`,
      subHeader: 'Under construction - will work soon \\',
      buttons: [...nameButtons, {text: 'Cancel', role: 'CANCEL'}],
    });
    await sheet.present();

    // if a PAX name was selected, set the parent
    sheet.onWillDismiss().then(({role}) => {
      if (role && role !== 'CANCEL') {
        this.setParent(role);
      }
    });
  }

  async setParent(parent: string) {
    await this.paxService.setParent(this.name, parent);
  }

  trackByBackblast(_index: number, backblast: Backblast) {
    return `${backblast.ao}_${backblast.date}`;
  }
}
