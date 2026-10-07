import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationExtras, Router} from '@angular/router';
import {ModalController, PopoverController} from '@ionic/angular';
import {Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {CurrentPax, CurrentPaxService} from 'src/app/services/current-pax.service';
import {UtilService} from 'src/app/services/util.service';

// Use any for User type - will be properly typed at runtime
type FirebaseUser = any;

import {LoginModalComponent, LoginMode} from '../login-modal/login-modal.component';
import {UserMenuPopoverComponent} from '../user-menu-popover/user-menu-popover.component';

@Component({
  selector: 'app-auth-button',
  templateUrl: './auth-button.component.html',
  styleUrls: ['./auth-button.component.scss'],
})
export class AuthButtonComponent implements OnInit, OnDestroy {
  user: FirebaseUser|null = null;
  current: CurrentPax|undefined;
  private readonly subscriptions = new Subscription();

  constructor(
      private readonly authService: AuthService,
      private readonly currentPaxService: CurrentPaxService,
      private readonly utilService: UtilService,
      private readonly modalController: ModalController,
      private readonly popoverController: PopoverController,
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.subscriptions.add(
        this.authService.authState$.subscribe(user => this.user = user));
    this.subscriptions.add(this.currentPaxService.current$.subscribe(
        current => this.current = current));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /** Someone is known: signed in, or picked themselves from the roster. */
  get known(): boolean {
    return !!this.user || !!this.current;
  }

  async openLoginModal(mode: LoginMode = 'pick') {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      componentProps: {mode},
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  async showUserMenu(event: Event) {
    event.stopPropagation();
    const popover = await this.popoverController.create({
      component: UserMenuPopoverComponent,
      componentProps: {
        pax: this.current?.pax,
        user: this.user,
        chosenOnly: !this.user && this.current?.source === 'chosen',
      },
      cssClass: 'user-menu-popover',
      event,
      translucent: true,
    });
    await popover.present();
  }

  goToPaxPage(event: Event) {
    event.stopPropagation();
    const name = this.current?.pax.name;
    if (name) {
      const navigationExtras: NavigationExtras = {
        replaceUrl: true,  // Replace current history state instead of pushing
      };
      this.router.navigateByUrl(`/pax/${name}`, navigationExtras);
    }
  }

  get displayName(): string {
    // Prefer PAX name if available, otherwise use Firebase displayName or email
    const paxName = this.current?.pax.name;
    if (paxName) return this.utilService.normalizeName(paxName);
    return this.user?.displayName || this.user?.email?.split('@')[0] || 'User';
  }

  get photoURL(): string|null {
    // Prefer PAX img_url if available, otherwise use Firebase photoURL
    return this.current?.pax.img_url || this.user?.photoURL || null;
  }
}
