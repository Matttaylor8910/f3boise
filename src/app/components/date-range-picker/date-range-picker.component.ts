import {Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {PopoverController} from '@ionic/angular';
import * as moment from 'moment';

import {CustomDateRangePopoverComponent} from '../custom-date-range-popover/custom-date-range-popover.component';

export interface DateRange {
  startDate: string|null;
  endDate: string|null;
}

export enum DateRangePreset {
  ALL_TIME = 'all-time',
  LAST_90_DAYS = 'last-90-days',
  LAST_30_DAYS = 'last-30-days',
  THIS_MONTH = 'this-month',
  THIS_YEAR = 'this-year',
}

@Component({
  selector: 'app-date-range-picker',
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss'],
})
export class DateRangePickerComponent implements OnInit, OnChanges {
  @Input() selectedRange?: DateRange;
  @Output() rangeChange = new EventEmitter<DateRange>();

  selectedPreset: DateRangePreset = DateRangePreset.ALL_TIME;
  customStartDate?: string;
  customEndDate?: string;
  hasCustomRange = false;
  customRangeLabel = '';
  DateRangePreset = DateRangePreset;

  readonly currentMonthName: string = moment().format('MMMM');
  readonly currentYearName: string = moment().format('YYYY');
  readonly presets: Array<{value: DateRangePreset; label: string}>;

  constructor(private readonly popoverController: PopoverController) {
    // Initialize presets with current month and year names
    this.presets = [
      {value: DateRangePreset.ALL_TIME, label: 'All Time'},
      {value: DateRangePreset.LAST_90_DAYS, label: 'Last 90 Days'},
      {value: DateRangePreset.LAST_30_DAYS, label: 'Last 30 Days'},
      {value: DateRangePreset.THIS_MONTH, label: this.currentMonthName},
      {value: DateRangePreset.THIS_YEAR, label: this.currentYearName},
    ];
  }

  ngOnInit() {
    if (this.selectedRange) {
      this.determinePresetFromRange(this.selectedRange);
    }
  }

  ngOnChanges() {
    if (this.selectedRange) {
      this.determinePresetFromRange(this.selectedRange);
    }
  }

  private determinePresetFromRange(range: DateRange) {
    if (!range.startDate && !range.endDate) {
      this.selectedPreset = DateRangePreset.ALL_TIME;
      this.hasCustomRange = false;
      return;
    }

    const now = moment();
    const startMoment = range.startDate ? moment(range.startDate) : null;
    const endMoment = range.endDate ? moment(range.endDate) : null;

    // Check if it matches a preset
    if (startMoment && endMoment) {
      const daysDiff = now.diff(startMoment, 'days');
      const isEndToday = endMoment.isSame(now, 'day');

      if (daysDiff === 30 && isEndToday) {
        this.selectedPreset = DateRangePreset.LAST_30_DAYS;
        this.hasCustomRange = false;
        return;
      }
      if (daysDiff === 90 && isEndToday) {
        this.selectedPreset = DateRangePreset.LAST_90_DAYS;
        this.hasCustomRange = false;
        return;
      }
      // Check if it's the current month (from start of month to today)
      const startOfMonth = now.clone().startOf('month');
      if (startMoment.isSame(startOfMonth, 'day') && isEndToday) {
        this.selectedPreset = DateRangePreset.THIS_MONTH;
        this.hasCustomRange = false;
        return;
      }
      // Check if it's the current year (from start of year to today)
      const startOfYear = now.clone().startOf('year');
      if (startMoment.isSame(startOfYear, 'day') && isEndToday) {
        this.selectedPreset = DateRangePreset.THIS_YEAR;
        this.hasCustomRange = false;
        return;
      }
    }

    // If it doesn't match a preset, it's custom
    this.hasCustomRange = true;
    this.customStartDate = range.startDate || undefined;
    this.customEndDate = range.endDate || undefined;
    this.updateCustomRangeLabel();
  }

  onPresetSelect(preset: DateRangePreset) {
    this.selectedPreset = preset;
    this.hasCustomRange = false;

    let range: DateRange;

    switch (preset) {
      case DateRangePreset.ALL_TIME:
        range = {startDate: null, endDate: null};
        break;
      case DateRangePreset.LAST_90_DAYS:
        range = {
          startDate: moment().subtract(90, 'days').format('YYYY-MM-DD'),
          endDate: moment().format('YYYY-MM-DD'),
        };
        break;
      case DateRangePreset.LAST_30_DAYS:
        range = {
          startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
          endDate: moment().format('YYYY-MM-DD'),
        };
        break;
      case DateRangePreset.THIS_MONTH:
        range = {
          startDate: moment().startOf('month').format('YYYY-MM-DD'),
          endDate: moment().format('YYYY-MM-DD'),
        };
        break;
      case DateRangePreset.THIS_YEAR:
        range = {
          startDate: moment().startOf('year').format('YYYY-MM-DD'),
          endDate: moment().format('YYYY-MM-DD'),
        };
        break;
    }

    this.rangeChange.emit(range);
  }

  async openCustomDatePicker(event: Event) {
    event.stopPropagation();
    const popover = await this.popoverController.create({
      component: CustomDateRangePopoverComponent,
      componentProps: {
        startDate: this.customStartDate,
        endDate: this.customEndDate,
      },
      event: event,
      translucent: true,
      cssClass: 'custom-date-range-popover',
    });

    await popover.present();

    const {data} = await popover.onDidDismiss();
    if (data) {
      if (data.cleared) {
        // Clear custom range and reset to All Time
        this.hasCustomRange = false;
        this.customRangeLabel = '';
        this.selectedPreset = DateRangePreset.ALL_TIME;
        this.rangeChange.emit({startDate: null, endDate: null});
      } else if (data.startDate && data.endDate) {
        // Set custom range
        this.hasCustomRange = true;
        this.customStartDate = data.startDate;
        this.customEndDate = data.endDate;
        this.updateCustomRangeLabel();
        this.rangeChange.emit({
          startDate: data.startDate,
          endDate: data.endDate,
        });
      }
    }
  }

  clearCustomRange() {
    this.hasCustomRange = false;
    this.customRangeLabel = '';
    this.selectedPreset = DateRangePreset.ALL_TIME;
    this.rangeChange.emit({startDate: null, endDate: null});
  }

  private updateCustomRangeLabel() {
    if (!this.customStartDate || !this.customEndDate) {
      this.customRangeLabel = '';
      return;
    }
    const start = moment(this.customStartDate).format('MMM D, YYYY');
    const end = moment(this.customEndDate).format('MMM D, YYYY');
    this.customRangeLabel = `${start} - ${end}`;
  }
}
