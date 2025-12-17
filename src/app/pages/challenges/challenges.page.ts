import {Component, OnDestroy, OnInit} from '@angular/core';
import {ModalController} from '@ionic/angular';
import * as moment from 'moment';
import {Subscription} from 'rxjs';
import {Challenge} from 'types';

import {CreateChallengeModalComponent} from '../../components/create-challenge-modal/create-challenge-modal.component';
import {LoginModalComponent} from '../../components/login-modal/login-modal.component';
import {AuthService} from '../../services/auth.service';
import {ChallengesService} from '../../services/challenges.service';

@Component({
  selector: 'app-challenges',
  templateUrl: './challenges.page.html',
  styleUrls: ['./challenges.page.scss'],
})
export class ChallengesPage implements OnInit, OnDestroy {
  challenges: Challenge[] = [];
  isLoading = false;
  user: any = null;
  private authSubscription?: Subscription;
  private challengesSubscription?: Subscription;

  constructor(
      private readonly challengesService: ChallengesService,
      private readonly authService: AuthService,
      private readonly modalController: ModalController,
  ) {}

  ngOnInit() {
    // Subscribe to auth state
    this.authSubscription = this.authService.authState$.subscribe(user => {
      this.user = user;
    });

    // Load challenges
    this.loadChallenges();
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.challengesSubscription?.unsubscribe();
  }

  loadChallenges() {
    this.isLoading = true;
    this.challengesSubscription =
        this.challengesService.getChallenges().subscribe({
          next: (challenges) => {
            this.challenges = challenges;
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error loading challenges:', error);
            this.isLoading = false;
          },
        });
  }

  async createChallenge() {
    if (!this.user) {
      await this.openLoginModal();
      return;
    }

    const modal = await this.modalController.create({
      component: CreateChallengeModalComponent,
      componentProps: {
        createdBy: this.user.email || this.user.uid,
      },
      cssClass: 'create-challenge-modal',
    });

    await modal.present();

    const {data} = await modal.onDidDismiss();
    if (data?.created) {
      // Challenges will automatically update via the subscription
    }
  }

  async openLoginModal() {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  formatDate(dateString: string): string {
    return moment(dateString).format('MMM D, YYYY');
  }

  getDateRange(challenge: Challenge): string {
    return `${this.formatDate(challenge.startDate)} - ${
        this.formatDate(challenge.endDate)}`;
  }

  getMetricsList(challenge: Challenge): string {
    const metrics: string[] = [];
    if (challenge.metrics.bds) metrics.push('# of BDs');
    if (challenge.metrics.uniqueAos) metrics.push('Unique # of AOs');
    if (challenge.metrics.qs) metrics.push('# of Qs');
    return metrics.join(', ');
  }

  getSortByLabel(challenge: Challenge): string {
    switch (challenge.sortBy) {
      case 'bds':
        return '# of BDs';
      case 'uniqueAos':
        return 'Unique # of AOs';
      case 'qs':
        return '# of Qs';
      default:
        return challenge.sortBy;
    }
  }

  isOwner(challenge: Challenge): boolean {
    if (!this.user) return false;
    return challenge.createdBy === this.user.email ||
        challenge.createdBy === this.user.uid;
  }

  async editChallenge(challenge: Challenge) {
    if (!this.user || !this.isOwner(challenge)) {
      return;
    }

    const modal = await this.modalController.create({
      component: CreateChallengeModalComponent,
      componentProps: {
        challengeToEdit: challenge,
        createdBy: this.user.email || this.user.uid,
      },
      cssClass: 'create-challenge-modal',
    });

    await modal.present();

    const {data} = await modal.onDidDismiss();
    if (data?.updated || data?.created) {
      // Challenges will automatically update via the subscription
    }
  }
}