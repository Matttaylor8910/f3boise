import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {PopoverController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {Pax} from 'types';

@Component({
  selector: 'app-user-menu-popover',
  templateUrl: './user-menu-popover.component.html',
  styleUrls: ['./user-menu-popover.component.scss'],
})
export class UserMenuPopoverComponent {
  @Input() pax?: Pax;

  constructor(
      private readonly authService: AuthService,
      private readonly popoverController: PopoverController,
      private readonly router: Router,
  ) {}

  async goToProfile() {
    if (this.pax?.name) {
      await this.popoverController.dismiss();
      this.router.navigateByUrl(`/pax/${this.pax.name}`);
    }
  }

  async goToBeatdownBreakdown() {
    if (this.pax?.name) {
      await this.popoverController.dismiss();
      this.router.navigateByUrl(`/beatdown-breakdown/${this.pax.name}`);
    }
  }

  async signOut() {
    await this.popoverController.dismiss();
    await this.authService.signOut();
  }

  async dismiss() {
    await this.popoverController.dismiss();
  }
}
