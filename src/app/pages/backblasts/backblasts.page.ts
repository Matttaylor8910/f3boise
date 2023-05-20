import {Component, OnInit} from '@angular/core';
import {BackblastService} from 'src/app/services/backblast.service';
import {Backblast} from 'types';

const SIZE = 48;

@Component({
  selector: 'app-backblasts',
  templateUrl: './backblasts.page.html',
  styleUrls: ['./backblasts.page.scss'],
})
export class BackblastsPage implements OnInit {
  allBackblasts?: Backblast[];
  filteredBackblasts?: Backblast[];
  backblasts?: Backblast[];

  loading = true;
  filterText = '';

  constructor(
      private readonly backblastService: BackblastService,
  ) {}

  get showLoadMore(): boolean {
    const moreBackblasts =
        (this.filteredBackblasts?.length ?? 0) > (this.backblasts?.length ?? 0);
    return !this.loading && moreBackblasts;
  }

  async ngOnInit() {
    this.allBackblasts = await this.backblastService.getAllData();

    this.applyFilter();
  }

  applyFilter() {
    this.loading = true;

    delete this.backblasts;
    const lowercase = this.filterText.toLowerCase();
    this.filteredBackblasts = this.filterText.trim().length === 0 ?
        this.allBackblasts :
        this.allBackblasts?.filter(bb => {
          return bb.date.includes(lowercase) ||
              bb.ao.toLowerCase().includes(lowercase) ||
              bb.pax.some(q => q.includes(lowercase));
        });

    this.loadMore();
  }

  loadMore() {
    this.loading = true;

    setTimeout(() => {
      const backblasts = this.backblasts ?? [];

      const filtered = this.filteredBackblasts ?? [];
      const start = backblasts.length;
      const end = start + SIZE;
      backblasts.push(...filtered.slice(start, end));
      this.backblasts = backblasts;

      this.loading = false;
    });
  }

  trackByBackblast(_index: number, backblast: Backblast) {
    return `${backblast.ao}_${backblast.date}`;
  }
}
