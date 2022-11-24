import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';

interface PaxStats {
  name: string;
  posts: number;
  favoriteAo: string;
  qs: number;
  qRate: number;
  firstBdDate: string;
  lastBdDate: string;
  firstAo: string;
  lastAo: string;
  firstQDate?: string;
  lastQDate?: string;
  firstQAo?: string;
  lastQAo?: string;
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
  name: string
  avatarUrl = '/assets/f3.jpg';

  stats?: PaxStats;
  favoriteAos?: AoStats[];

  constructor(
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly utilService: UtilService,
  ) {
    this.name = this.route.snapshot.params['name'];
  }

  ionViewDidEnter() {
    this.calculatePaxStats();
  }

  ngOnInit() {
    this.loadAvatarUrl();
  }

  async loadAvatarUrl() {
    const pax = await this.paxService.getPax(this.name);
    if (pax?.img_url) {
      this.avatarUrl = pax.img_url;
    }
  }

  async calculatePaxStats() {
    // load the data and no-op if they have no data
    const data = await this.backblastService.getBackblastsForPax(this.name);
    if (data.length === 0) {
      return;
    }

    const aoCount = new Map<string, AoStats>();
    let qCount = 0;
    let firstQDate = undefined;
    let lastQDate = undefined;
    let firstQAo = undefined;
    let lastQAo = undefined;

    for (const post of data) {
      const ao = aoCount.get(post.ao) ?? {name: post.ao, total: 0};
      ao.total++;
      aoCount.set(ao.name, ao);

      // data is date descending, so set the new first Q each time
      if (post.qs.includes(this.name)) {
        qCount++;
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

    this.stats = {
      name: this.name,
      posts: data.length,
      favoriteAo: this.favoriteAos[0].name,
      qs: qCount,
      qRate: qCount / data.length,
      firstBdDate: this.utilService.getRelativeDate(data[data.length - 1].date),
      lastBdDate: this.utilService.getRelativeDate(data[0].date),
      firstAo: data[data.length - 1].ao,
      lastAo: data[0].ao,
      firstQDate: this.utilService.getRelativeDate(firstQDate),
      lastQDate: this.utilService.getRelativeDate(lastQDate),
      firstQAo,
      lastQAo,
    };
  }
}
