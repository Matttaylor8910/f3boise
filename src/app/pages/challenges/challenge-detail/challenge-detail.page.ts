import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertController, ModalController, ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {combineLatest, Subscription} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {Backblast, BBType, Challenge, ChallengeLeaderboardEntry, ChallengeMetric, ChallengeParticipant,} from 'types';

import {AddParticipantModalComponent} from '../../../components/add-participant-modal/add-participant-modal.component';
import {CreateChallengeModalComponent} from '../../../components/create-challenge-modal/create-challenge-modal.component';
import {LoginModalComponent} from '../../../components/login-modal/login-modal.component';
import {AuthService} from '../../../services/auth.service';
import {BackblastService} from '../../../services/backblast.service';
import {ChallengesService} from '../../../services/challenges.service';
import {PaxService} from '../../../services/pax.service';

@Component({
  selector: 'app-challenge-detail',
  templateUrl: './challenge-detail.page.html',
  styleUrls: ['./challenge-detail.page.scss'],
})
export class ChallengeDetailPage implements OnInit, OnDestroy {
  challengeId: string = '';
  challenge?: Challenge;
  participants: ChallengeParticipant[] = [];
  leaderboard: ChallengeLeaderboardEntry[] = [];
  isLoading = false;
  isJoining = false;
  isWithdrawing = false;
  removingParticipant: string|null = null;
  isDeleting = false;
  challengeLoading = true;
  user: any = null;
  isParticipant = false;
  private subscriptions: Subscription[] = [];

  constructor(
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly challengesService: ChallengesService,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly authService: AuthService,
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
      private readonly alertController: AlertController,
  ) {
    this.challengeId = this.route.snapshot.params['id'];
  }

  ngOnInit() {
    // Subscribe to auth state
    const authSub = this.authService.authState$.subscribe(user => {
      const wasSignedOut = !this.user && user;
      this.user = user;
      this.checkParticipation();

      // If user just signed in and there's a pending challenge join, auto-join
      if (wasSignedOut && user) {
        this.handlePendingJoin();
      }
    });
    this.subscriptions.push(authSub);

    // Load challenge
    const challengeSub =
        this.challengesService.getChallenge(this.challengeId).subscribe({
          next: (challenge) => {
            this.challenge = challenge;
            this.challengeLoading = false;
            if (challenge) {
              this.loadLeaderboard();
            }
          },
          error: (error) => {
            console.error('Error loading challenge:', error);
            this.challengeLoading = false;
          },
        });
    this.subscriptions.push(challengeSub);

    // Load participants
    const participantsSub =
        this.challengesService.getParticipants(this.challengeId)
            .subscribe(participants => {
              this.participants = participants;
              this.checkParticipation();

              // Check access for private challenges after participants load
              if (this.challenge?.isPrivate) {
                const currentUserId = this.user?.email || this.user?.uid;
                const hasAccess = this.isOwner() ||
                    (currentUserId &&
                     participants.some(p => p.userId === currentUserId));
                if (!hasAccess) {
                  this.showToast(
                      'You do not have access to this private challenge',
                      'danger');
                  this.router.navigateByUrl('/challenges');
                  return;
                }
              }

              if (this.challenge) {
                this.loadLeaderboard();
              }
            });
    this.subscriptions.push(participantsSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  checkParticipation() {
    if (!this.user || !this.participants.length) {
      this.isParticipant = false;
      return;
    }
    const userId = this.user.email || this.user.uid;
    this.isParticipant = this.participants.some(p => p.userId === userId);
  }

  async loadLeaderboard() {
    if (!this.challenge || !this.participants.length) {
      this.leaderboard = [];
      return;
    }

    this.isLoading = true;

    try {
      const startDate = moment(this.challenge.startDate);
      const endDate = moment(this.challenge.endDate).endOf('day');

      // Get all backblasts in the date range
      const allBackblasts = await this.backblastService.getAllData();
      const filteredBackblasts = allBackblasts.filter(bb => {
        const bbDate = moment(bb.date);
        return bbDate.isSameOrAfter(startDate, 'day') &&
            bbDate.isSameOrBefore(endDate, 'day');
      });

      // Get all double downs in the date range
      let allDoubleDowns: Backblast[] = [];
      let filteredDoubleDowns: Backblast[] = [];
      if (this.challenge.metrics.doubleDowns) {
        allDoubleDowns =
            await this.backblastService.getAllData(BBType.DOUBLEDOWN);
        filteredDoubleDowns = allDoubleDowns.filter(dd => {
          const ddDate = moment(dd.date);
          return ddDate.isSameOrAfter(startDate, 'day') &&
              ddDate.isSameOrBefore(endDate, 'day');
        });
      }

      // Get all PAX data for name mapping
      const allPax = await this.paxService.loadPaxData();
      const paxMap = new Map<string, string>();
      allPax.forEach(pax => {
        paxMap.set(pax.name.toLowerCase(), pax.name);
      });

      // Calculate metrics for each participant
      const leaderboardMap = new Map<string, ChallengeLeaderboardEntry>();

      // Initialize entries for all participants
      this.participants.forEach(participant => {
        const paxName = this.getPaxNameForUser(participant.userId, allPax);
        leaderboardMap.set(participant.userId, {
          userId: participant.userId,
          paxName,
          bds: 0,
          uniqueAos: 0,
          qs: 0,
          doubleDowns: 0,
        });
      });

      // Create a map of PAX name to participant userId for quick lookup
      const paxNameToUserIdMap = new Map<string, string>();
      this.participants.forEach(participant => {
        const paxName = participant.paxName ||
            this.getPaxNameForUser(participant.userId, allPax);
        if (paxName) {
          paxNameToUserIdMap.set(paxName.toLowerCase(), participant.userId);
        }
      });

      // Calculate metrics from backblasts
      const uniqueAosMap = new Map<string, Set<string>>();

      for (const backblast of filteredBackblasts) {
        // Count BDs and unique AOs for each participant
        for (const paxName of backblast.pax) {
          const normalizedPaxName = paxName.toLowerCase();
          const userId = paxNameToUserIdMap.get(normalizedPaxName);

          if (userId) {
            const entry = leaderboardMap.get(userId);
            if (entry) {
              if (this.challenge.metrics.bds) {
                entry.bds++;
              }
              if (this.challenge.metrics.uniqueAos) {
                if (!uniqueAosMap.has(userId)) {
                  uniqueAosMap.set(userId, new Set());
                }
                uniqueAosMap.get(userId)!.add(backblast.ao.toLowerCase());
                entry.uniqueAos = uniqueAosMap.get(userId)!.size;
              }
            }
          }
        }

        // Count Qs for each participant
        if (this.challenge.metrics.qs) {
          for (const qName of backblast.qs) {
            const normalizedQName = qName.toLowerCase();
            const userId = paxNameToUserIdMap.get(normalizedQName);

            if (userId) {
              const entry = leaderboardMap.get(userId);
              if (entry) {
                entry.qs++;
              }
            }
          }
        }
      }

      // Count Double Downs for each participant
      if (this.challenge.metrics.doubleDowns) {
        for (const doubleDown of filteredDoubleDowns) {
          for (const paxName of doubleDown.pax) {
            const normalizedPaxName = paxName.toLowerCase();
            const userId = paxNameToUserIdMap.get(normalizedPaxName);

            if (userId) {
              const entry = leaderboardMap.get(userId);
              if (entry) {
                entry.doubleDowns++;
              }
            }
          }
        }
      }

      // Convert to array and sort
      this.leaderboard = Array.from(leaderboardMap.values());
      this.sortLeaderboard();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      await this.showToast('Failed to load leaderboard', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  sortLeaderboard() {
    if (!this.challenge) return;

    const sortBy = this.challenge.sortBy;
    this.leaderboard.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      return bValue - aValue;  // Descending order
    });
  }

  trackByLeaderboardEntry(index: number, entry: ChallengeLeaderboardEntry):
      string {
    return entry.userId;
  }

  getPaxNameForUser(userId: string, allPax: any[]): string|undefined {
    // Try to find PAX by email first
    const pax =
        allPax.find(p => p.email?.toLowerCase() === userId.toLowerCase());
    if (pax) return pax.name;

    // Check participants for stored paxName
    const participant = this.participants.find(p => p.userId === userId);
    if (participant?.paxName) return participant.paxName;

    return undefined;
  }

  async joinChallenge() {
    if (!this.user) {
      // Save challenge ID to localStorage so we can auto-join after sign-in
      localStorage.setItem('pendingChallengeJoin', this.challengeId);
      await this.openLoginModal();
      return;
    }

    if (!this.challenge) {
      await this.showToast('Challenge not found', 'danger');
      return;
    }

    await this.performJoin();
  }

  private async performJoin() {
    if (!this.user || !this.challenge || this.isJoining) return;

    this.isJoining = true;

    try {
      const userId = this.user.email || this.user.uid;
      if (!userId) {
        throw new Error('User ID not available');
      }

      const pax = await this.paxService.getPaxByEmail(userId);
      const paxName = pax?.name;

      await this.challengesService.joinChallenge(
          this.challengeId, userId, paxName);
      await this.showToast('Successfully joined the challenge!', 'success');
      // Clear pending join from localStorage
      localStorage.removeItem('pendingChallengeJoin');
      // The participant list will update automatically via subscription
    } catch (error: any) {
      console.error('Error joining challenge:', error);
      await this.showToast(
          error.message || 'Failed to join challenge. Please try again.',
          'danger',
      );
    } finally {
      this.isJoining = false;
    }
  }

  async withdrawFromChallenge() {
    if (!this.user || !this.challenge) {
      return;
    }

    if (this.isWithdrawing) return;

    this.isWithdrawing = true;

    try {
      const userId = this.user.email || this.user.uid;
      if (!userId) {
        throw new Error('User ID not available');
      }

      await this.challengesService.withdrawFromChallenge(
          this.challengeId, userId);
      await this.showToast(
          'Successfully withdrew from the challenge', 'success');
      // The participant list will update automatically via subscription
    } catch (error: any) {
      console.error('Error withdrawing from challenge:', error);
      await this.showToast(
          error.message ||
              'Failed to withdraw from challenge. Please try again.',
          'danger',
      );
    } finally {
      this.isWithdrawing = false;
    }
  }

  async removeParticipant(userId: string) {
    if (!this.user || !this.challenge) {
      return;
    }

    const currentUserId = this.user.email || this.user.uid;
    const isRemovingSelf = userId === currentUserId;
    const isOwnerRemoving = this.isOwner();

    // Only allow if removing self or if owner is removing someone else
    if (!isRemovingSelf && !isOwnerRemoving) {
      return;
    }

    if (this.removingParticipant === userId) return;

    // Find participant name for confirmation message
    const participant = this.participants.find(p => p.userId === userId);
    const participantName = participant?.paxName || userId;

    // Show confirmation dialog
    const confirmed =
        await this.showRemoveConfirmation(isRemovingSelf, participantName);
    if (!confirmed) {
      return;
    }

    this.removingParticipant = userId;

    try {
      await this.challengesService.removeParticipant(this.challengeId, userId);
      const message = isRemovingSelf ?
          'Successfully withdrew from the challenge' :
          'Participant removed successfully';
      await this.showToast(message, 'success');
      // The participant list will update automatically via subscription
    } catch (error: any) {
      console.error('Error removing participant:', error);
      await this.showToast(
          error.message || 'Failed to remove participant. Please try again.',
          'danger',
      );
    } finally {
      this.removingParticipant = null;
    }
  }

  async deleteChallenge() {
    if (!this.user || !this.challenge || !this.isOwner()) {
      return;
    }

    if (this.isDeleting) return;

    // Show confirmation dialog
    const confirmed = await this.showDeleteConfirmation();
    if (!confirmed) {
      return;
    }

    this.isDeleting = true;

    try {
      await this.challengesService.deleteChallenge(this.challengeId);
      await this.showToast('Challenge deleted successfully', 'success');
      // Navigate back to challenges list
      this.router.navigateByUrl('/challenges');
    } catch (error: any) {
      console.error('Error deleting challenge:', error);
      await this.showToast(
          error.message || 'Failed to delete challenge. Please try again.',
          'danger',
      );
    } finally {
      this.isDeleting = false;
    }
  }

  private async showDeleteConfirmation(): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertController.create({
        header: 'Delete Challenge?',
        message: `Are you sure you want to delete "${
            this.challenge
                ?.name}"? This action cannot be undone. All participant data will be permanently removed.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              resolve(false);
            },
          },
          {
            text: 'Delete',
            role: 'destructive',
            cssClass: 'alert-button-destructive',
            handler: () => {
              resolve(true);
            },
          },
        ],
      });

      await alert.present();
    });
  }

  private async showRemoveConfirmation(
      isRemovingSelf: boolean, participantName: string): Promise<boolean> {
    return new Promise(async resolve => {
      const header =
          isRemovingSelf ? 'Withdraw from Challenge?' : 'Remove Participant?';
      const message = isRemovingSelf ?
          'Are you sure you want to withdraw from this challenge? Your progress will be removed from the leaderboard.' :
          `Are you sure you want to remove ${
              participantName} from this challenge? Their progress will be removed from the leaderboard.`;

      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              resolve(false);
            },
          },
          {
            text: isRemovingSelf ? 'Withdraw' : 'Remove',
            role: 'destructive',
            cssClass: 'alert-button-destructive',
            handler: () => {
              resolve(true);
            },
          },
        ],
      });

      await alert.present();
    });
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

  getDateRange(): string {
    if (!this.challenge) return '';
    return `${this.formatDate(this.challenge.startDate)} - ${
        this.formatDate(this.challenge.endDate)}`;
  }

  getMetricsList(): string {
    if (!this.challenge) return '';
    const metrics: string[] = [];
    if (this.challenge.metrics.bds) metrics.push('# of BDs');
    if (this.challenge.metrics.uniqueAos) metrics.push('# of AOs');
    if (this.challenge.metrics.qs) metrics.push('# of Qs');
    if (this.challenge.metrics.doubleDowns) metrics.push('# of DDs');
    return metrics.join(', ');
  }

  getSortByLabel(): string {
    if (!this.challenge) return '';
    switch (this.challenge.sortBy) {
      case 'bds':
        return '# of BDs';
      case 'uniqueAos':
        return '# of AOs';
      case 'qs':
        return '# of Qs';
      case 'doubleDowns':
        return '# of DDs';
      default:
        return this.challenge.sortBy;
    }
  }

  isOwner(): boolean {
    if (!this.user || !this.challenge) return false;
    return this.challenge.createdBy === this.user.email ||
        this.challenge.createdBy === this.user.uid;
  }

  async editChallenge() {
    if (!this.user || !this.isOwner() || !this.challenge) {
      return;
    }

    const modal = await this.modalController.create({
      component: CreateChallengeModalComponent,
      componentProps: {
        challengeToEdit: this.challenge,
        createdBy: this.user.email || this.user.uid,
      },
      cssClass: 'create-challenge-modal',
    });

    await modal.present();

    const {data} = await modal.onDidDismiss();
    if (data?.updated || data?.created) {
      // Challenge will automatically update via the subscription
    }
  }

  private async handlePendingJoin() {
    const pendingChallengeId = localStorage.getItem('pendingChallengeJoin');
    if (pendingChallengeId && pendingChallengeId === this.challengeId) {
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        this.performJoin();
      }, 500);
    }
  }

  async openAddParticipantModal() {
    if (!this.challenge || !this.isOwner()) {
      return;
    }

    const existingParticipantIds = this.participants.map(p => p.userId);

    const modal = await this.modalController.create({
      component: AddParticipantModalComponent,
      componentProps: {
        challengeId: this.challengeId,
        existingParticipantIds,
      },
      cssClass: 'add-participant-modal',
    });

    await modal.present();

    const {data} = await modal.onDidDismiss();
    // Participants will automatically update via the subscription
  }

  goBack() {
    this.router.navigateByUrl('/challenges');
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
