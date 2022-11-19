import {Component} from '@angular/core';
import {Router} from '@angular/router';
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

  constructor(
      private readonly backblastService: BackblastService,
      private readonly router: Router,
  ) {}

  ionViewDidEnter() {
    this.setAos();
  }

  async setAos() {
    const aos = new Set<string>();
    const data = await this.backblastService.getAllData();
    data.forEach(bb => aos.add(bb.ao));

    // sort the aos alphabetically
    this.aos = ['All AOs', ...Array.from(aos.values()).sort()];

    // set up an actions button for smaller screens as well
    this.aoActions = this.aos.map(ao => {
      return {
        label: ao,
        onClick: () => {
          this.router.navigateByUrl(`/ao/${ao.includes('All') ? 'all' : ao}`);
        }
      };
    });
  }
}
