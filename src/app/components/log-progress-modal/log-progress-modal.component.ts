import {Component, Input, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {Challenge, ChallengeCustomMetric, ChallengeLog} from 'types';

import {ChallengesService} from '../../services/challenges.service';

/**
 * Log one PAX's custom-metric numbers for a day of a challenge. Picking a day
 * that already has numbers loads them, so the same sheet edits past days.
 */
@Component({
  selector: 'app-log-progress-modal',
  templateUrl: './log-progress-modal.component.html',
  styleUrls: ['./log-progress-modal.component.scss'],
})
export class LogProgressModalComponent implements OnInit {
  @Input() challenge!: Challenge;
  @Input() userId = '';
  @Input() paxName?: string;
  /** Who is saving; differs from userId when the creator logs for a PAX. */
  @Input() updatedBy = '';
  /** What this PAX has already logged against the challenge. */
  @Input() logs: ChallengeLog[] = [];

  date = '';
  minDate = '';
  maxDate = '';
  /** The picked day's amount per 'total' metric; null while left empty. */
  amounts: {[metricId: string]: number|null} = {};
  /** Whether the picked day is checked off, per 'days' metric. */
  done: {[metricId: string]: boolean} = {};
  totals: {[metricId: string]: number} = {};
  isSaving = false;

  constructor(
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
  ) {}

  get metrics(): ChallengeCustomMetric[] {
    return this.challenge.customMetrics ?? [];
  }

  get isForSomeoneElse(): boolean {
    return this.userId.toLowerCase() !== this.updatedBy.toLowerCase();
  }

  ngOnInit() {
    const today = moment().format('YYYY-MM-DD');
    this.minDate = this.challenge.startDate;
    this.maxDate =
        today < this.challenge.endDate ? today : this.challenge.endDate;
    this.date = this.maxDate;
    this.totals = this.challengesService
                      .customMetricTotals(this.challenge, this.logs)
                      .get(this.userId.toLowerCase()) ??
        {};
    this.loadDay();
  }

  /** Fill the form with whatever is already logged for the picked day. */
  loadDay() {
    for (const metric of this.metrics) {
      const logged = this.logs.find(
          log => log.metricId === metric.id && log.date === this.date);
      const value = logged?.value ?? 0;
      if (metric.type === 'days') {
        this.done[metric.id] = value > 0;
      } else {
        this.amounts[metric.id] = value > 0 ? value : null;
      }
    }
  }

  async save() {
    if (!this.date || this.date < this.minDate || this.date > this.maxDate) {
      await this.showToast('Pick a day within the challenge', 'danger');
      return;
    }

    const values: {[metricId: string]: number} = {};
    for (const metric of this.metrics) {
      if (metric.type === 'days') {
        values[metric.id] = this.done[metric.id] ? 1 : 0;
        continue;
      }
      const amount = Number(this.amounts[metric.id] ?? 0);
      if (!isFinite(amount) || amount < 0) {
        await this.showToast(
            `${metric.name} can't be a negative number`, 'danger');
        return;
      }
      values[metric.id] = amount;
    }

    this.isSaving = true;
    try {
      await this.challengesService.saveLogs(
          this.challenge.id!, this.userId, this.paxName, this.date, values,
          this.updatedBy);
      await this.showToast('Progress saved', 'success');
      await this.modalController.dismiss({saved: true});
    } catch (error: any) {
      console.error('Error saving challenge progress:', error);
      await this.showToast(
          error.message || 'Failed to save progress. Please try again.',
          'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
