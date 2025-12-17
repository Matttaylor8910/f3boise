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
  metrics = {
    bds: false,
    uniqueAos: false,
    qs: false,
  };
  sortBy: ChallengeMetric = ChallengeMetric.BDS;
  isLoading = false;
  readonly today: string = moment().format('YYYY-MM-DD');
  readonly ChallengeMetric = ChallengeMetric;

  get isEditMode(): boolean {
    return !!this.challengeToEdit;
  }

  constructor(
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
  ) {}

  ngOnInit() {
    if (this.challengeToEdit) {
      // Populate form with existing challenge data
      this.name = this.challengeToEdit.name;
      this.description = this.challengeToEdit.description;
      this.startDate = this.challengeToEdit.startDate;
      this.endDate = this.challengeToEdit.endDate;
      this.metrics = {...this.challengeToEdit.metrics};
      this.sortBy = this.challengeToEdit.sortBy;
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
    if (!this.metrics.bds && !this.metrics.uniqueAos && !this.metrics.qs) {
      await this.showToast(
          'Please select at least one metric to track', 'danger');
      return;
    }

    // Validate that sortBy metric is selected
    if (!this.metrics[this.sortBy]) {
      await this.showToast(
          'The sort metric must be one of the selected tracking metrics',
          'danger');
      return;
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
          metrics: this.metrics,
          sortBy: this.sortBy,
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
          metrics: this.metrics,
          sortBy: this.sortBy,
          createdBy: this.createdBy,
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
