import {Component, Input} from '@angular/core';
import {NavigationExtras, Router} from '@angular/router';
import {PopoverController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {Pax} from 'types';

type FirebaseUser = any;

@Component({
  selector: 'app-user-menu-popover',
  templateUrl: './user-menu-popover.component.html',
  styleUrls: ['./user-menu-popover.component.scss'],
})
export class UserMenuPopoverComponent {
  @Input() pax?: Pax;
  @Input() user?: FirebaseUser|null;

  constructor(
      private readonly authService: AuthService,
      private readonly popoverController: PopoverController,
      private readonly router: Router,
  ) {}

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

  async signOut() {
    await this.popoverController.dismiss();
    await this.authService.signOut();
  }

  async dismiss() {
    await this.popoverController.dismiss();
  }
}
