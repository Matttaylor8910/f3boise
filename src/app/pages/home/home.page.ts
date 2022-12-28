import {Component} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';
import {PopoverAction} from 'src/app/components/actions-popover/actions-popover.component';
import {BackblastService} from 'src/app/services/backblast.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  aos: string[] = [];
  aoActions: PopoverAction[] = [];

  // default to these counts for the home page
  paxCount: number = 100;
  aoCount: number = 10;

  constructor(
      private readonly backblastService: BackblastService,
      private readonly router: Router,
  ) {}

  ionViewDidEnter() {
    this.setAos();
  }

  async setAos() {
    const aos = new Set<string>();
    const uniquePaxLast90Days = new Set<string>();

    const now = moment();
    const data = await this.backblastService.getAllData();
    data.forEach(bb => {
      aos.add(bb.ao);

      const days = now.diff(moment(bb.date), 'days');
      if (days <= 90) {
        bb.pax.forEach(name => uniquePaxLast90Days.add(name));
      }
    });

    this.aoCount = aos.size;
    this.paxCount = uniquePaxLast90Days.size - (uniquePaxLast90Days.size % 25);

    // sort the aos alphabetically
    this.aos = ['All AOs', ...Array.from(aos.values()).sort()];

    // set up an actions button for smaller screens as well
    this.aoActions = this.aos.map(ao => {
      return {label: ao, onClick: () => this.navToAo(ao)};
    });
  }

  navToAo(ao: string) {
    this.navTo(`/ao/${ao.includes('All') ? 'all' : ao}`);
  }

  navTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
