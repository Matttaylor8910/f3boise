import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {ModalController, PopoverController} from '@ionic/angular';
import {UtilService} from 'src/app/services/util.service';

/**
 * The PAX who have committed to a beatdown, the Q badged, each a tap away
 * from their page. Shown as a popover for a handful of names and as a bottom
 * sheet for the big events.
 */
@Component({
  selector: 'app-hc-popover',
  templateUrl: './hc-popover.component.html',
  styleUrls: ['./hc-popover.component.scss'],
})
export class HcPopoverComponent {
  @Input() names: string[] = [];
  /** The Q, shown with a badge. */
  @Input() q?: string;
  /** Presented as a sheet modal rather than a popover. */
  @Input() sheet = false;

  constructor(
      readonly utilService: UtilService,
      private readonly popoverController: PopoverController,
      private readonly modalController: ModalController,
      private readonly router: Router,
  ) {}

  get title(): string {
    return `${this.names.length} ${this.names.length === 1 ? 'HC' : 'HCs'}`;
  }

  isQ(name: string): boolean {
    return !!this.q && name.toLowerCase() === this.q.toLowerCase();
  }

  async close() {
    await (this.sheet ? this.modalController : this.popoverController)
        .dismiss();
  }

  async goToPax(name: string) {
    await this.close();
    await this.router.navigateByUrl(`/pax/${name.toLowerCase()}`);
  }
}
