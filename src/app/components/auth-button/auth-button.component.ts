import {Component, OnDestroy, OnInit} from '@angular/core';
import {ModalController, PopoverController} from '@ionic/angular';
import {Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {PaxService} from 'src/app/services/pax.service';
import {Pax} from 'types';

// Use any for User type - will be properly typed at runtime
type FirebaseUser = any;

import {LoginModalComponent} from '../login-modal/login-modal.component';
import {UserMenuPopoverComponent} from '../user-menu-popover/user-menu-popover.component';

@Component({
  selector: 'app-auth-button',
  templateUrl: './auth-button.component.html',
  styleUrls: ['./auth-button.component.scss'],
})
export class AuthButtonComponent implements OnInit, OnDestroy {
  user: FirebaseUser|null = null;
  pax: Pax|undefined;
  private authSubscription?: Subscription;

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly modalController: ModalController,
      private readonly popoverController: PopoverController,
  ) {}

  ngOnInit() {
    this.authSubscription =
        this.authService.authState$.subscribe(async user => {
          this.user = user;
          if (user?.email) {
            this.pax = await this.paxService.getPaxByEmail(user.email);
          } else {
            this.pax = undefined;
          }
        });
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }

  async openLoginModal() {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  async showUserMenu(event: Event) {
    event.stopPropagation();
    const popover = await this.popoverController.create({
      component: UserMenuPopoverComponent,
      componentProps: {
        pax: this.pax,
      },
      cssClass: 'user-menu-popover',
      event,
      translucent: true,
    });
    await popover.present();
  }

  get displayName(): string {
    if (!this.user) return '';
    // Prefer PAX name if available, otherwise use Firebase displayName or email
    return this.pax?.name || this.user.displayName ||
        this.user.email?.split('@')[0] || 'User';
  }

  get photoURL(): string|null {
    // Prefer PAX img_url if available, otherwise use Firebase photoURL
    return this.pax?.img_url || this.user?.photoURL || null;
  }
}
