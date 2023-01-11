import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {AoPaxStats} from 'types';

@Component({
  selector: 'app-pax-list-item',
  templateUrl: './pax-list-item.component.html',
  styleUrls: ['./pax-list-item.component.scss'],
})
export class PaxListItemComponent {
  @Input() pax!: AoPaxStats;
  @Input() subtext!: string;
  @Input() metric!: string;
  @Input() index!: number;
  @Input() showMore = false;

  limit = 10;
  smallLimit = 3;

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
  ) {}

  goToPaxPage() {
    this.router.navigateByUrl(`/pax/${this.pax.name}`);
  }
}
