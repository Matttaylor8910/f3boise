import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
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
  participantCounts: Map<string, number> = new Map();
  isLoading = false;
  user: any = null;
  private authSubscription?: Subscription;
  private challengesSubscription?: Subscription;
  private participantSubscriptions: Subscription[] = [];

  constructor(
      private readonly challengesService: ChallengesService,
      private readonly authService: AuthService,
      private readonly modalController: ModalController,
      private readonly router: Router,
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
    this.participantSubscriptions.forEach(sub => sub.unsubscribe());
  }

  loadChallenges() {
    this.isLoading = true;
    this.challengesSubscription =
        this.challengesService.getChallenges().subscribe({
          next: (challenges) => {
            // Filter out private challenges that the user doesn't own
            const filteredChallenges = challenges.filter(challenge => {
              if (!challenge.isPrivate) {
                return true;  // Show all public challenges
              }
              // For private challenges, only show if user is the owner
              return this.isOwner(challenge);
            });
            this.challenges = filteredChallenges;
            this.loadParticipantCounts(filteredChallenges);
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error loading challenges:', error);
            this.isLoading = false;
          },
        });
  }

  loadParticipantCounts(challenges: Challenge[]) {
    // Unsubscribe from previous participant subscriptions
    this.participantSubscriptions.forEach(sub => sub.unsubscribe());
    this.participantSubscriptions = [];

    // Subscribe to participant counts for each challenge
    challenges.forEach(challenge => {
      if (challenge.id) {
        const sub = this.challengesService.getParticipants(challenge.id)
                        .subscribe(participants => {
                          this.participantCounts.set(
                              challenge.id!, participants.length);
                        });
        this.participantSubscriptions.push(sub);
      }
    });
  }

  getParticipantCount(challengeId?: string): number {
    if (!challengeId) return 0;
    return this.participantCounts.get(challengeId) || 0;
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
    if (challenge.metrics.doubleDowns) metrics.push('Double Downs');
    return metrics.join(', ');
  }

  getSortByLabel(challenge: Challenge): string {
    switch (challenge.sortBy) {
      case 'bds':
        return '# of BDs';
      case 'uniqueAos':
        return '# of AOs';
      case 'qs':
        return '# of Qs';
      case 'doubleDowns':
        return '# of DDs';
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

  goToChallenge(challenge: Challenge) {
    if (challenge.id) {
      this.router.navigateByUrl(`/challenges/${challenge.id}`);
    }
  }
}