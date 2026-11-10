import {Component, Input, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {Challenge, ChallengeCustomMetric, ChallengeLog, Pax} from 'types';

import {ChallengesService} from '../../services/challenges.service';
import {PaxService} from '../../services/pax.service';
import {UtilService} from '../../services/util.service';

/** How many PAX to list under the "for" picker's search box. */
const MAX_PAX_RESULTS = 8;

/**
 * Post a check-in for one PAX on a challenge: reps to add to his totals, days
 * to check off, one-time things to tick, and an optional note. Or, given a
 * check-in to edit, change what it says: then the amounts replace its own.
 * The challenge creator can also point it at any PAX, who joins the
 * challenge if he isn't in it yet.
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
  /** A check-in to change instead of a new one to post. */
  @Input() editing?: ChallengeLog;
  /** The creator may pick who the check-in is for. */
  @Input() canReassign = false;
  /** Every check-in on the challenge, so a newly picked PAX has his totals. */
  @Input() allLogs?: ChallengeLog[];

  /** Who the check-in was for when the modal opened. */
  private originalUserId = '';
  pickingPax = false;
  paxQuery = '';
  paxResults: Pax[] = [];
  private allPax: Pax[] = [];

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
      private readonly paxService: PaxService,
      readonly utilService: UtilService,
  ) {}

  get metrics(): ChallengeCustomMetric[] {
    return this.challenge.customMetrics ?? [];
  }

  get isForSomeoneElse(): boolean {
    return this.userId.toLowerCase() !== this.updatedBy.toLowerCase();
  }

  get isEditing(): boolean {
    return !!this.editing;
  }

  /** Every check-in but the one being edited: what the totals rest on. */
  private get otherLogs(): ChallengeLog[] {
    return this.logs.filter(log => log.id !== this.editing?.id);
  }

  /** The check-in now points at someone other than it did at first. */
  get reassigned(): boolean {
    return this.userId.toLowerCase() !== this.originalUserId.toLowerCase();
  }

  get forName(): string {
    return this.paxName ? this.utilService.normalizeName(this.paxName) :
                          this.userId;
  }

  ngOnInit() {
    this.originalUserId = this.userId;
    const today = moment().format('YYYY-MM-DD');
    this.minDate = this.challenge.startDate;
    this.maxDate =
        today < this.challenge.endDate ? today : this.challenge.endDate;
    this.date = this.maxDate;
    if (this.editing) {
      this.date = this.editing.date;
      this.note = this.editing.note ?? '';
      // the day may fall outside the picker's window once a challenge
      // ends; still let the edit stand on its own day
      if (this.date < this.minDate) this.minDate = this.date;
      if (this.date > this.maxDate) this.maxDate = this.date;
    }
    this.loadTotals();
    if (this.editing) {
      for (const metric of this.metrics) {
        const value = this.editing.values?.[metric.id] ?? 0;
        if (metric.type === 'total') {
          this.amounts[metric.id] = value > 0 ? value : null;
        } else {
          this.done[metric.id] = value > 0;
        }
      }
    }
  }

  private loadTotals() {
    this.totals = this.challengesService
                      .customMetricTotals(this.challenge, this.otherLogs)
                      .get(this.userId.toLowerCase()) ??
        {};
    this.loadDay();
  }

  async startPickingPax() {
    this.pickingPax = true;
    this.paxQuery = '';
    this.paxResults = [];
    if (this.allPax.length === 0) {
      this.allPax = [...await this.paxService.getAllData()].sort(
          (a, b) => a.name.localeCompare(b.name));
    }
  }

  /** Reads the query off the event: ngModel is a keystroke behind ionInput. */
  filterPax(event?: Event) {
    if (event) {
      const target = event.target as HTMLIonSearchbarElement|null;
      this.paxQuery = target?.value ?? '';
    }
    const query = this.paxQuery.toLowerCase().trim();
    if (!query) {
      this.paxResults = [];
      return;
    }
    const starts =
        this.allPax.filter(pax => pax.name.toLowerCase().startsWith(query));
    const contains = this.allPax.filter(
        pax => !pax.name.toLowerCase().startsWith(query) &&
            pax.name.toLowerCase().includes(query));
    this.paxResults = [...starts, ...contains].slice(0, MAX_PAX_RESULTS);
  }

  /** Point the check-in at this PAX and show his numbers instead. */
  choosePax(pax: Pax) {
    // the same id the leaderboard and participants use for him
    this.userId = pax.email || pax.name;
    this.paxName = pax.name;
    this.pickingPax = false;
    const pool = this.allLogs ?? this.logs;
    this.logs = pool.filter(
        log => log.userId.toLowerCase() === this.userId.toLowerCase());
    this.amounts = {};
    this.done = {};
    this.loadTotals();
  }

  cancelPickingPax() {
    this.pickingPax = false;
  }

  /** Work out what the picked day already has checked in. */
  loadDay() {
    for (const metric of this.metrics) {
      this.dayTotals[metric.id] =
          this.otherLogs.filter(log => log.date === this.date)
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
      await this.showToast(
          this.editing ? 'Enter something, or remove the check-in instead' :
                         'Enter something to check in',
          'danger');
      return;
    }

    this.isSaving = true;
    try {
      // a PAX the creator picked is in the challenge from here on
      if (this.canReassign && this.reassigned) {
        await this.challengesService.joinChallenge(
            this.challenge.id!, this.userId, this.paxName);
      }
      if (this.editing) {
        await this.challengesService.updateCheckIn(
            this.editing.id!, this.date, values, this.note, this.updatedBy,
            this.reassigned ? {userId: this.userId, paxName: this.paxName} :
                              undefined);
        await this.showToast('Check-in updated', 'success');
      } else {
        await this.challengesService.addCheckIn(
            this.challenge.id!, this.userId, this.paxName, this.date, values,
            this.note, this.updatedBy);
        await this.showToast('Checked in!', 'success');
      }
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
