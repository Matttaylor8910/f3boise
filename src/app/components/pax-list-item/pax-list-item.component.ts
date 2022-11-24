import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {PaxService} from 'src/app/services/pax.service';
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

  avatarUrl = '/assets/f3.jpg';

  constructor(
      private readonly paxService: PaxService,
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.loadAvatarUrl();
  }

  async loadAvatarUrl() {
    const pax = await this.paxService.getPax(this.pax.name);
    console.log(pax);
    if (pax?.img_url) {
      this.avatarUrl = pax.img_url;
    }
  }

  goToPaxPage() {
    this.router.navigateByUrl(`/pax/${this.pax.name}`);
  }
}
