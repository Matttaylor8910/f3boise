import {Component, Input, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {Challenge, ChallengeCustomMetric, ChallengeLog} from 'types';

import {ChallengesService} from '../../services/challenges.service';

/**
 * Post a check-in for one PAX on a challenge: reps to add to his totals, days
 * to check off, one-time things to tick, and an optional note.
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
  note = '';
  /** Amount to add per 'total' metric; null while left empty. */
  amounts: {[metricId: string]: number|null} = {};
  /** Whether to check the picked day off ('days') or tick it ('done'). */
  done: {[metricId: string]: boolean} = {};
  /** What the picked day already has, per metric. */
  dayTotals: {[metricId: string]: number} = {};
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

  /** Work out what the picked day already has checked in. */
  loadDay() {
    for (const metric of this.metrics) {
      this.dayTotals[metric.id] =
          this.logs.filter(log => log.date === this.date)
              .reduce((sum, log) => sum + (log.values?.[metric.id] || 0), 0);
      if (metric.type === 'days') {
        // one metric, not done yet: checking in is the whole point
        this.done[metric.id] =
            this.metrics.length === 1 && !this.dayTotals[metric.id];
      } else if (metric.type === 'done') {
        this.done[metric.id] =
            this.metrics.length === 1 && !this.totals[metric.id];
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
        if (this.done[metric.id] && !this.dayTotals[metric.id]) {
          values[metric.id] = 1;
        }
        continue;
      }
      if (metric.type === 'done') {
        // once is all it takes; a second tick would just be noise
        if (this.done[metric.id] && !this.totals[metric.id]) {
          values[metric.id] = 1;
        }
        continue;
      }
      const amount = Number(this.amounts[metric.id] ?? 0);
      if (!isFinite(amount) || amount < 0) {
        await this.showToast(
            `${metric.name} can't be a negative number`, 'danger');
        return;
      }
      if (amount > 0) values[metric.id] = amount;
    }
    if (Object.keys(values).length === 0) {
      await this.showToast('Enter something to check in', 'danger');
      return;
    }

    this.isSaving = true;
    try {
      await this.challengesService.addCheckIn(
          this.challenge.id!, this.userId, this.paxName, this.date, values,
          this.note, this.updatedBy);
      await this.showToast('Checked in!', 'success');
      await this.modalController.dismiss({saved: true});
    } catch (error: any) {
      console.error('Error posting challenge check-in:', error);
      await this.showToast(
          error.message || 'Failed to check in. Please try again.', 'danger');
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
