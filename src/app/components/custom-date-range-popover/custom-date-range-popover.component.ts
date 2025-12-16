import {Component} from '@angular/core';
import {PopoverController} from '@ionic/angular';
import * as moment from 'moment';

@Component({
  selector: 'app-custom-date-range-popover',
  templateUrl: './custom-date-range-popover.component.html',
  styleUrls: ['./custom-date-range-popover.component.scss'],
})
export class CustomDateRangePopoverComponent {
  startDate?: string;
  endDate?: string;
  readonly today: string = moment().format('YYYY-MM-DD');

  constructor(private readonly popoverController: PopoverController) {}

  apply() {
    if (this.startDate && this.endDate) {
      this.popoverController.dismiss({
        startDate: this.startDate,
        endDate: this.endDate,
      });
    }
  }

  clear() {
    this.popoverController.dismiss({cleared: true});
  }
}
