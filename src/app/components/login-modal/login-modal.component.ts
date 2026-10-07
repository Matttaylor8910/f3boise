import {Component, Input, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {CurrentPaxService} from 'src/app/services/current-pax.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax} from 'types';

/** How many PAX to list under the picker's search box. */
const MAX_PICKER_RESULTS = 8;

export type LoginMode = 'pick'|'email';

/**
 * Two ways in: tell us who you are (a PAX picked from the roster, kept on
 * this device, enough to personalize the app) or a real email-link sign-in,
 * which is what editing the map and the admin tools require.
 */
@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent implements OnInit {
  /** Which way to open on. */
  @Input() mode: LoginMode = 'pick';

  email = '';
  isLoading = false;

  pickerQuery = '';
  pickerResults: Pax[] = [];
  pickerLoading = false;
  private allPax: Pax[] = [];

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly currentPaxService: CurrentPaxService,
      readonly utilService: UtilService,
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
  ) {}

  async ngOnInit() {
    this.pickerLoading = true;
    try {
      this.allPax = [...await this.paxService.getAllData()].sort(
          (a, b) => a.name.localeCompare(b.name));
    } finally {
      this.pickerLoading = false;
    }
    // the user may have started typing before the roster arrived
    this.filterPicker();
  }

  /**
   * Reads the query off the event when there is one: ngModel only catches up
   * with the searchbar after ionInput has fired, so it is a keystroke behind.
   */
  filterPicker(event?: Event) {
    if (event) {
      const target = event.target as HTMLIonSearchbarElement|null;
      this.pickerQuery = target?.value ?? '';
    }
    const query = this.pickerQuery.toLowerCase().trim();
    if (!query) {
      this.pickerResults = [];
      return;
    }
    const starts = this.allPax.filter(
        pax => pax.name.toLowerCase().startsWith(query));
    const contains = this.allPax.filter(
        pax => !pax.name.toLowerCase().startsWith(query) &&
            pax.name.toLowerCase().includes(query));
    this.pickerResults = [...starts, ...contains].slice(0, MAX_PICKER_RESULTS);
  }

  async pick(pax: Pax) {
    this.currentPaxService.choose(pax);
    await this.showToast(
        `Welcome, ${this.utilService.normalizeName(pax.name)}!`, 'success');
    await this.modalController.dismiss();
  }

  async sendLoginLink() {
    if (!this.email || !this.isValidEmail(this.email)) {
      await this.showToast('Please enter a valid email address', 'danger');
      return;
    }

    this.isLoading = true;

    try {
      // Check if email is registered as a PAX
      const pax = await this.paxService.getPaxByEmail(this.email);
      if (!pax) {
        await this.showToast(
            'This email is not registered. Please contact an admin to register your email.',
            'danger',
        );
        this.isLoading = false;
        return;
      }

      const actionCodeSettings = this.authService.createActionCodeSettings(
          window.location.origin + window.location.pathname,
      );

      await this.authService.sendSignInLinkToEmail(
          this.email, actionCodeSettings);
      await this.showToast(
          'Check your email for a sign-in link!',
          'success',
      );
      await this.modalController.dismiss();
    } catch (error: any) {
      await this.showToast(
          error.message || 'Failed to send login link. Please try again.',
          'danger',
      );
    } finally {
      this.isLoading = false;
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
