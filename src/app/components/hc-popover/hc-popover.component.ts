import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {PopoverController} from '@ionic/angular';
import {UtilService} from 'src/app/services/util.service';

/** The PAX who have HC'd for a beatdown, each a tap away from their page. */
@Component({
  selector: 'app-hc-popover',
  templateUrl: './hc-popover.component.html',
  styleUrls: ['./hc-popover.component.scss'],
})
export class HcPopoverComponent {
  @Input() names: string[] = [];
  /** The Q, shown with a badge. */
  @Input() q?: string;

  constructor(
      readonly utilService: UtilService,
      private readonly popoverController: PopoverController,
      private readonly router: Router,
  ) {}

  isQ(name: string): boolean {
    return !!this.q && name.toLowerCase() === this.q.toLowerCase();
  }

  async goToPax(name: string) {
    await this.popoverController.dismiss();
    await this.router.navigateByUrl(`/pax/${name.toLowerCase()}`);
  }
}
