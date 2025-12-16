import {Component, Input, OnChanges} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';
import {AoPaxStats} from 'types';

@Component({
  selector: 'app-pax-list-item',
  templateUrl: './pax-list-item.component.html',
  styleUrls: ['./pax-list-item.component.scss'],
})
export class PaxListItemComponent implements OnChanges {
  @Input() pax!: AoPaxStats;
  @Input() subtext!: string;
  @Input() metric!: string;
  @Input() index!: number;
  @Input() showMore = false;

  limit = 10;
  smallLimit = 3;
  normalizedName = '';

  constructor(
      private readonly utilService: UtilService,
  ) {}

  ngOnChanges() {
    if (this.pax?.name) {
      this.normalizedName = this.utilService.normalizeName(this.pax.name);
    }
  }
}
