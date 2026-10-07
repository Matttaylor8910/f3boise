import {Component, Input} from '@angular/core';
import {NavigationExtras, Router} from '@angular/router';
import {ModalController, PopoverController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {CurrentPaxService} from 'src/app/services/current-pax.service';
import {UserProfilesService} from 'src/app/services/user-profiles.service';
import {Pax} from 'types';

import {LoginModalComponent, LoginMode} from '../login-modal/login-modal.component';

type FirebaseUser = any;

@Component({
  selector: 'app-user-menu-popover',
  templateUrl: './user-menu-popover.component.html',
  styleUrls: ['./user-menu-popover.component.scss'],
})
export class UserMenuPopoverComponent {
  @Input() pax?: Pax;
  @Input() user?: FirebaseUser|null;
  /** The PAX was picked from the roster, not proven by a sign-in. */
  @Input() chosenOnly = false;

  constructor(
      private readonly authService: AuthService,
      private readonly currentPaxService: CurrentPaxService,
      private readonly modalController: ModalController,
      private readonly popoverController: PopoverController,
      private readonly router: Router,
      readonly userProfiles: UserProfilesService,
  ) {}

  async goToAdmin() {
    await this.popoverController.dismiss();
    const navigationExtras: NavigationExtras = {
      replaceUrl: true,
    };
    this.router.navigateByUrl('/admin', navigationExtras);
  }

  async goToProfile() {
    if (this.pax?.name) {
      await this.popoverController.dismiss();
      const navigationExtras: NavigationExtras = {
        replaceUrl: true,  // Replace current history state instead of pushing
      };
      this.router.navigateByUrl(`/pax/${this.pax.name}`, navigationExtras);
    }
  }

  async goToBeatdownBreakdown() {
    await this.popoverController.dismiss();
    // Navigate to current year's breakdown
    const currentYear = new Date().getFullYear();
    this.router.navigateByUrl(`/${currentYear}`);
  }

  /** Forget the chosen PAX and offer the roster again. */
  async switchPax() {
    await this.popoverController.dismiss();
    this.currentPaxService.clearChoice();
    await this.openLoginModal('pick');
  }

  /** A real sign-in, for the things a chosen PAX can't do. */
  async signIn() {
    await this.popoverController.dismiss();
    await this.openLoginModal('email');
  }

  async signOut() {
    await this.popoverController.dismiss();
    this.currentPaxService.clearChoice();
    await this.authService.signOut();
  }

  private async openLoginModal(mode: LoginMode) {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      componentProps: {mode},
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  async dismiss() {
    await this.popoverController.dismiss();
  }
}
