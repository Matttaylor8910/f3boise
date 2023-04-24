import {Component, OnInit} from '@angular/core';
import {DETAILS} from 'ao-schedule';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {Backblast} from 'types';

interface BackblastWithTime extends Backblast {
  time: string;
}

const SIZE = 48;

@Component({
  selector: 'app-backblasts',
  templateUrl: './backblasts.page.html',
  styleUrls: ['./backblasts.page.scss'],
})
export class BackblastsPage implements OnInit {
  allBackblasts?: BackblastWithTime[];
  backblasts?: BackblastWithTime[];

  loading = true;

  constructor(
      private readonly backblastService: BackblastService,
  ) {}

  async ngOnInit() {
    this.allBackblasts = (await this.backblastService.getAllData()).map(bb => {
      const backblast = bb as BackblastWithTime;
      const day = moment(backblast.date).format('dddd');

      backblast.time = (DETAILS as any)[backblast.ao]?.schedule[day] ?? '';

      return backblast;
    });

    this.loadMore();
  }

  loadMore() {
    this.loading = true;

    setTimeout(() => {
      if (!this.backblasts) this.backblasts = [];

      const all = this.allBackblasts ?? [];
      const start = this.backblasts.length;
      const end = start + SIZE;
      this.backblasts.push(...all.slice(start, end));

      this.loading = false;
    });
  }
}
