import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ActionSheetButton, ActionSheetController, ModalController} from '@ionic/angular';
import {BestiesGridComponent} from 'src/app/components/besties-grid/besties-grid.component';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast, BBType, Pax, PaxOrigin} from 'types';

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
  parentLabel?: string|null;
  parentIsPax?: boolean;
  bestie?: string;
  bestieCount?: number;
  paxTally?: number;
  avgPaxAsQ?: number;
  topBesties?: {name: string; count: number}[];
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
      private readonly modalController: ModalController,
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

  get allowChangeParent(): boolean {
    return !!this.stats && !!this.stats.parentLabel &&
        location.href.includes('?reset');
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

    // get the name of the PAX who invited them out, see if this a pax name
    const parent = await this.paxService.getParent(this.name, true);
    const parentIsPax = parent ? parent.type === PaxOrigin.PAX : false;
    const parentLabel = parent ?
        (parent.type === PaxOrigin.PAX ?
             parent.name :
             this.paxService.getOriginLabel(parent.type)) :
        '';

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

    // Store top 10 besties for the modal
    const topBesties =
        sorted.slice(0, 10).map(([name, count]) => ({name, count}));

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
      parentLabel,
      parentIsPax,
      bestie,
      bestieCount,
      paxTally: sorted.length,
      avgPaxAsQ: qCount === 0 ? 0 : totalPaxAsQ / qCount,
      topBesties,
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
    const nameButtons =
        pax.filter(name => name !== this.name).sort().map(name => {
          const normalized = this.utilService.normalizeName(name);
          return {text: normalized, role: name, icon: 'person-sharp'};
        });

    // build up the buttons
    const buttons: ActionSheetButton[] = [
      ...nameButtons,
      {
        text: this.paxService.getOriginLabel(PaxOrigin.AT_BD),
        role: PaxOrigin.AT_BD,
        icon: 'barbell-sharp',
      },
      {
        text: this.paxService.getOriginLabel(PaxOrigin.DR_EH),
        role: PaxOrigin.DR_EH,
        icon: 'people-sharp',
      },
      {
        text: this.paxService.getOriginLabel(PaxOrigin.MOVED),
        role: PaxOrigin.MOVED,
        icon: 'home-sharp',
      },
      {
        text: this.paxService.getOriginLabel(PaxOrigin.ONLINE),
        role: PaxOrigin.ONLINE,
        icon: 'qr-code-sharp',
      },
      {
        text: 'Other PAX',
        role: 'OTHER',
        icon: 'person-sharp',
      },
    ];

    // cancel should always be the last option
    buttons.push({text: 'Cancel', role: 'CANCEL', icon: 'close-sharp'});

    // display the sheet
    const header =
        `Who was ${this.utilService.normalizeName(this.name)} invited by?`;
    const sheet = await this.actionSheetController.create({header, buttons});
    await sheet.present();

    // if a PAX name was selected, set the parent
    sheet.onWillDismiss().then(({role}) => {
      if (role === 'OTHER') {
        this.getMoreSuggestions();
      }
      // pax name
      else if (role && pax.includes(role)) {
        this.setParent(role);
      }
      // other parent option
      else if (role && this.paxService.isPaxOrigin(role)) {
        this.setParent(role);
      }
    });
  }

  async getMoreSuggestions() {
    const seenPax = new Set<string>();
    const buttons: ActionSheetButton[] = [];
    const allBds = await this.backblastService.getAllData();

    for (const bd of allBds) {
      for (const name of bd.pax) {
        if (!seenPax.has(name)) {
          const normalized = this.utilService.normalizeName(name);
          buttons.push({text: normalized, role: name, icon: 'person-sharp'});
          seenPax.add(name);
        }
      }
    }

    buttons.sort((a, b) => a.role!.localeCompare(b.role!));

    // cancel should always be the last option
    buttons.push({text: 'Cancel', role: 'CANCEL', icon: 'close-sharp'});

    // display the sheet
    const header =
        `Who was ${this.utilService.normalizeName(this.name)} invited by?`;
    const sheet = await this.actionSheetController.create({header, buttons});
    await sheet.present();

    // if a PAX name was selected, set the parent
    sheet.onWillDismiss().then(({role}) => {
      if (role !== 'CANCEL' && buttons.find(button => button.role === role)) {
        this.setParent(role!);
      }
    });
  }

  async setParent(parent: string) {
    await this.paxService.setParent(this.name, parent);
    this.calculatePaxStats(this.statsType);
  }

  async showTopBesties() {
    if (!this.stats?.topBesties) return;

    // Create and present the modal using pre-calculated top besties
    const modal = await this.modalController.create({
      component: BestiesGridComponent,
      componentProps: {besties: this.stats.topBesties, paxName: this.name},
      cssClass: 'besties-modal',
      showBackdrop: true,
      backdropDismiss: true,
      presentingElement: await this.modalController.getTop()
    });

    await modal.present();
  }
}