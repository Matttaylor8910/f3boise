import {Component, Input, OnChanges} from '@angular/core';
import {PopoverController} from '@ionic/angular';

import {HcPopoverComponent} from '../hc-popover/hc-popover.component';

/** Faces shown before the rest collapse into a "+N" bubble. */
const MAX_AVATARS = 4;

/**
 * Who has HC'd (hard committed) for a beatdown: a stack of faces, tap for
 * the names.
 */
@Component({
  selector: 'app-hc-list',
  templateUrl: './hc-list.component.html',
  styleUrls: ['./hc-list.component.scss'],
})
export class HcListComponent implements OnChanges {
  /** PAX names, any casing. */
  @Input() names: string[] = [];

  avatars: string[] = [];
  overflow = 0;

  constructor(private readonly popoverController: PopoverController) {}

  ngOnChanges() {
    this.avatars = this.names.slice(0, MAX_AVATARS);
    this.overflow = this.names.length - this.avatars.length;
  }

  async showNames(event: Event) {
    event.stopPropagation();
    const popover = await this.popoverController.create({
      component: HcPopoverComponent,
      componentProps: {names: this.names},
      cssClass: 'hc-popover',
      event,
      translucent: true,
    });
    await popover.present();
  }
}
