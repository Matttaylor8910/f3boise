import {Component, Input, OnChanges} from '@angular/core';
import {ModalController, PopoverController} from '@ionic/angular';

import {HcPopoverComponent} from '../hc-popover/hc-popover.component';

/** Faces shown before the rest collapse into a "+N" bubble. */
const MAX_AVATARS = 4;
/** Past this many names the list opens as a sheet, which always fits. */
const POPOVER_MAX = 8;

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

  constructor(
      private readonly popoverController: PopoverController,
      private readonly modalController: ModalController,
  ) {}

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
    const props = {names: this.committed, q: this.q?.trim() || undefined};
    if (this.committed.length > POPOVER_MAX) {
      const modal = await this.modalController.create({
        component: HcPopoverComponent,
        componentProps: {...props, sheet: true},
        cssClass: 'hc-sheet',
        // fully open from the start so the list scrolls; the sheet's own
        // height (see .hc-sheet) keeps it from covering the whole screen
        breakpoints: [0, 1],
        initialBreakpoint: 1,
        handle: true,
      });
      await modal.present();
      return;
    }
    const popover = await this.popoverController.create({
      component: HcPopoverComponent,
      componentProps: props,
      cssClass: 'hc-popover',
      event,
      translucent: true,
    });
    await popover.present();
  }
}
