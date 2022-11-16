import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';

interface PaxStats {
  name: string;
  posts: number;
  favoriteAo: string;
  qs: number;
  qRate: number;
  firstBdDate: string;
  lastBdDate: string;
  firstQDate?: string;
  lastQDate?: string;
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

  stats?: PaxStats;
  favoriteAos?: AoStats[];

  constructor(
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
  }

  ionViewDidEnter() {
    this.calculatePaxStats();
  }

  async calculatePaxStats() {
    const data = await this.backblastService.getBackblastsForPax(this.name);
    const aoCount = new Map<string, AoStats>();

    for (const post of data) {
      const ao = aoCount.get(post.ao) ?? {name: post.ao, total: 0};
      ao.total++;
      aoCount.set(ao.name, ao);
    }

    this.favoriteAos = Array.from(aoCount.values())
                           .sort((a, b) => b.total - a.total)
                           .slice(0, 3);
  }
}
