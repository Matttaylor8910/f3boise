import {Component, Input, OnChanges} from '@angular/core';
import {PopoverController} from '@ionic/angular';

import {HcPopoverComponent} from '../hc-popover/hc-popover.component';

/** Faces shown before the rest collapse into a "+N" bubble. */
const MAX_AVATARS = 4;

/**
 * Who's committed to a beatdown: the Q first, then everyone who HC'd, as a
 * stack of faces with a count. Tap for the names.
 */
@Component({
  selector: 'app-hc-list',
  templateUrl: './hc-list.component.html',
  styleUrls: ['./hc-list.component.scss'],
})
export class HcListComponent implements OnChanges {
  /** PAX who HC'd, any casing. */
  @Input() names: string[] = [];
  /** The Q, who counts as committed whether or not they HC'd. */
  @Input() q?: string|null;

  /** The Q (first) and the HCs, deduped. */
  committed: string[] = [];
  avatars: string[] = [];
  overflow = 0;

  constructor(private readonly popoverController: PopoverController) {}

  ngOnChanges() {
    const q = this.q?.trim();
    const hcs = this.names.filter(
        name => !q || name.toLowerCase() !== q.toLowerCase());
    this.committed = q ? [q, ...hcs] : hcs;
    this.avatars = this.committed.slice(0, MAX_AVATARS);
    this.overflow = this.committed.length - this.avatars.length;
  }

  async showNames(event: Event) {
    event.stopPropagation();
    const popover = await this.popoverController.create({
      component: HcPopoverComponent,
      componentProps: {names: this.committed, q: this.q?.trim() || undefined},
      cssClass: 'hc-popover',
      event,
      translucent: true,
    });
    await popover.present();
  }
}
