import {Component, Input, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {Challenge, ChallengeMetric} from 'types';

import {ChallengesService} from '../../services/challenges.service';

@Component({
  selector: 'app-create-challenge-modal',
  templateUrl: './create-challenge-modal.component.html',
  styleUrls: ['./create-challenge-modal.component.scss'],
})
export class CreateChallengeModalComponent implements OnInit {
  @Input() createdBy: string = '';
  @Input() challengeToEdit?: Challenge;

  name = '';
  description = '';
  startDate = '';
  endDate = '';
  isPrivate = false;
  requireJoining = true;
  metrics = {
    bds: false,
    uniqueAos: false,
    qs: false,
    doubleDowns: false,
  };
  goals:
      {bds?: number; uniqueAos?: number; qs?: number;
       doubleDowns?: number;} = {};
  sortBy: ChallengeMetric = ChallengeMetric.BDS;
  isLoading = false;
  readonly today: string = moment().format('YYYY-MM-DD');
  readonly ChallengeMetric = ChallengeMetric;

  // Available sort options based on selected metrics
  availableSortOptions: Array<{value: ChallengeMetric; label: string}> = [];

  get isEditMode(): boolean {
    return !!this.challengeToEdit;
  }

  get isFormInvalid(): boolean {
    return this.isLoading || !this.name.trim() || !this.description.trim() ||
        !this.startDate || !this.endDate;
  }

  constructor(
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
  ) {}

  ngOnInit() {
    this.updateAvailableSortOptions();

    if (this.challengeToEdit) {
      // Populate form with existing challenge data
      this.name = this.challengeToEdit.name;
      this.description = this.challengeToEdit.description;
      this.startDate = this.challengeToEdit.startDate;
      this.endDate = this.challengeToEdit.endDate;
      this.isPrivate = this.challengeToEdit.isPrivate || false;
      this.requireJoining = this.challengeToEdit.requireJoining !== undefined ?
          this.challengeToEdit.requireJoining :
          true;
      this.metrics = {...this.challengeToEdit.metrics};
      this.sortBy = this.challengeToEdit.sortBy;
      this.goals = {...(this.challengeToEdit.goals || {})};
      this.updateAvailableSortOptions();
      // Ensure sortBy is valid for selected metrics
      this.updateSortByIfNeeded();
    }
  }

  onMetricChange() {
    // When metrics change, update available options and sortBy if needed
    this.updateAvailableSortOptions();
    this.updateSortByIfNeeded();
  }

  private updateAvailableSortOptions() {
    const options: Array<{value: ChallengeMetric; label: string}> = [];
    if (this.metrics.bds) {
      options.push({value: ChallengeMetric.BDS, label: '# of BDs'});
    }
    if (this.metrics.uniqueAos) {
      options.push({value: ChallengeMetric.UNIQUE_AOS, label: '# of AOs'});
    }
    if (this.metrics.qs) {
      options.push({value: ChallengeMetric.QS, label: '# of Qs'});
    }
    if (this.metrics.doubleDowns) {
      options.push({value: ChallengeMetric.DOUBLE_DOWNS, label: '# of DDs'});
    }
    this.availableSortOptions = options;
  }

  private updateSortByIfNeeded() {
    // If no metrics selected, nothing to do
    if (this.availableSortOptions.length === 0) {
      return;
    }

    // Check if current sortBy is still valid
    const isCurrentSortValid =
        this.availableSortOptions.some(opt => opt.value === this.sortBy);

    if (!isCurrentSortValid) {
      // Current sortBy is not in available options, select the first one
      this.sortBy = this.availableSortOptions[0].value;
    }
  }

  async createChallenge() {
    // Validate form
    if (!this.name.trim()) {
      await this.showToast('Please enter a challenge name', 'danger');
      return;
    }

    if (!this.description.trim()) {
      await this.showToast('Please enter a description', 'danger');
      return;
    }

    if (!this.startDate || !this.endDate) {
      await this.showToast('Please select start and end dates', 'danger');
      return;
    }

    if (this.startDate >= this.endDate) {
      await this.showToast('End date must be after start date', 'danger');
      return;
    }

    // Check if at least one metric is selected
    if (!this.metrics.bds && !this.metrics.uniqueAos && !this.metrics.qs &&
        !this.metrics.doubleDowns) {
      await this.showToast(
          'Please select at least one metric to track', 'danger');
      return;
    }

    // Ensure sortBy is valid (should already be handled by
    // updateSortByIfNeeded, but double-check)
    const availableOptions = this.availableSortOptions;
    if (availableOptions.length === 0) {
      await this.showToast(
          'Please select at least one metric to track', 'danger');
      return;
    }
    if (!availableOptions.some(opt => opt.value === this.sortBy)) {
      // Fallback: select first available option
      this.sortBy = availableOptions[0].value;
    }

    this.isLoading = true;

    try {
      if (this.isEditMode && this.challengeToEdit?.id) {
        // Update existing challenge
        const challenge: Omit<Challenge, 'id'|'createdAt'|'createdBy'> = {
          name: this.name.trim(),
          description: this.description.trim(),
          startDate: this.startDate,
          endDate: this.endDate,
          isPrivate: this.isPrivate,
          requireJoining: this.requireJoining,
          metrics: this.metrics,
          sortBy: this.sortBy,
          goals: this.getGoalsForChallenge(),
        };

        await this.challengesService.updateChallenge(
            this.challengeToEdit.id, challenge);
        await this.showToast('Challenge updated successfully!', 'success');
        await this.modalController.dismiss({updated: true});
      } else {
        // Create new challenge
        const challenge: Omit<Challenge, 'id'|'createdAt'> = {
          name: this.name.trim(),
          description: this.description.trim(),
          startDate: this.startDate,
          endDate: this.endDate,
          isPrivate: this.isPrivate,
          requireJoining: this.requireJoining,
          metrics: this.metrics,
          sortBy: this.sortBy,
          createdBy: this.createdBy,
          goals: this.getGoalsForChallenge(),
        };

        await this.challengesService.createChallenge(challenge);
        await this.showToast('Challenge created successfully!', 'success');
        await this.modalController.dismiss({created: true});
      }
    } catch (error: any) {
      await this.showToast(
          error.message ||
              `Failed to ${
                  this.isEditMode ? 'update' :
                                    'create'} challenge. Please try again.`,
          'danger',
      );
    } finally {
      this.isLoading = false;
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  private getGoalsForChallenge():
      {bds?: number; uniqueAos?: number; qs?: number;
       doubleDowns?: number;}|undefined {
    const goals:
        {bds?: number; uniqueAos?: number; qs?: number;
         doubleDowns?: number;} = {};
    let hasGoals = false;

    if (this.metrics.bds && this.goals.bds !== undefined &&
        this.goals.bds > 0) {
      goals.bds = this.goals.bds;
      hasGoals = true;
    }
    if (this.metrics.uniqueAos && this.goals.uniqueAos !== undefined &&
        this.goals.uniqueAos > 0) {
      goals.uniqueAos = this.goals.uniqueAos;
      hasGoals = true;
    }
    if (this.metrics.qs && this.goals.qs !== undefined && this.goals.qs > 0) {
      goals.qs = this.goals.qs;
      hasGoals = true;
    }
    if (this.metrics.doubleDowns && this.goals.doubleDowns !== undefined &&
        this.goals.doubleDowns > 0) {
      goals.doubleDowns = this.goals.doubleDowns;
      hasGoals = true;
    }

    return hasGoals ? goals : undefined;
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
