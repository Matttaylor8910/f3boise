import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {CurrentPaxService} from 'src/app/services/current-pax.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax} from 'types';

/** How many PAX to list under the picker's search box. */
const MAX_PICKER_RESULTS = 8;

/** Firebase's floor; anything shorter is rejected server-side anyway. */
const MIN_PASSWORD_LENGTH = 6;

/** How often to ask Firebase whether the confirmation link was clicked. */
const VERIFY_POLL_MS = 4000;

/**
 * Which way to open on: find yourself in the roster, sign in to an existing
 * account, or the "check your email" screen for a signed-in PAX who hasn't
 * confirmed his address yet.
 */
export type LoginMode = 'pick'|'signin'|'verify';

/**
 * The picker's steps. Searching lands on a PAX; from there he either keeps
 * it to this device or sets a password, which creates his account and sends
 * the email that proves the address is his.
 */
type PickStep = 'search'|'picked'|'password'|'sent';

/**
 * Who are you? A PAX picked from the roster is enough to personalize the
 * app. A password on top of that makes it an account, created with the
 * email the roster already has, and a confirmation email proves it is his.
 * That is what creating challenges and the admin tools require.
 */
@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent implements OnInit, OnDestroy {
  /** Which way to open on. */
  @Input() mode: LoginMode = 'pick';

  step: PickStep = 'search';
  isLoading = false;

  pickerQuery = '';
  pickerResults: Pax[] = [];
  pickerLoading = false;
  private allPax: Pax[] = [];

  /** The PAX the user says he is. */
  picked?: Pax;
  password = '';
  confirmPassword = '';
  showPassword = false;
  /** createAccount said that email already has an account. */
  accountExists = false;

  /** Sign-in form. */
  email = '';
  signInPassword = '';
  showSignInPassword = false;

  /** Where the confirmation email went. */
  sentTo = '';
  private verifyPoll?: ReturnType<typeof setInterval>;

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly currentPaxService: CurrentPaxService,
      readonly utilService: UtilService,
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
  ) {}

  async ngOnInit() {
    if (this.mode === 'verify') {
      this.sentTo = this.authService.currentUser?.email ?? '';
      this.startVerifyPoll();
    }
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

  ngOnDestroy() {
    this.stopVerifyPoll();
  }

  get title(): string {
    if (this.mode === 'verify' || this.step === 'sent') {
      return 'Check your email';
    }
    return this.mode === 'signin' ? 'Sign in' : 'Who are you?';
  }

  /** Switching tabs restarts the picker; a half-typed password is dropped. */
  setMode(mode: LoginMode) {
    this.mode = mode;
    if (mode !== 'verify') {
      this.stopVerifyPoll();
      this.step = 'search';
      this.accountExists = false;
    }
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

  /** Found himself in the roster: now, device-only or an account? */
  select(pax: Pax) {
    this.picked = pax;
    this.step = 'picked';
    this.accountExists = false;
    this.password = '';
    this.confirmPassword = '';
  }

  /** The PAX's email with most of it hidden, for a screen anyone could see. */
  get maskedEmail(): string {
    const email = this.picked?.email ?? '';
    const at = email.indexOf('@');
    if (at <= 0) return '';
    const local = email.slice(0, at);
    const shown = local.slice(0, Math.min(2, local.length));
    return `${shown}${'•'.repeat(5)}${email.slice(at)}`;
  }

  get pickedName(): string {
    return this.picked ? this.utilService.normalizeName(this.picked.name) : '';
  }

  backToSearch() {
    this.picked = undefined;
    this.step = 'search';
    this.accountExists = false;
  }

  /** No proof, personalization only: how the app has always worked. */
  async useThisDevice() {
    if (!this.picked) return;
    this.currentPaxService.choose(this.picked);
    await this.showToast(`Welcome, ${this.pickedName}!`, 'success');
    await this.modalController.dismiss();
  }

  startPassword() {
    this.step = 'password';
  }

  get passwordProblem(): string|null {
    if (this.password.length < MIN_PASSWORD_LENGTH) {
      return `At least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (this.confirmPassword && this.confirmPassword !== this.password) {
      return 'Those passwords don\'t match.';
    }
    return null;
  }

  get canCreate(): boolean {
    return !this.isLoading && !!this.picked?.email && !this.passwordProblem &&
        this.confirmPassword === this.password;
  }

  /**
   * Make the account with the email on file, sign in, and send the
   * confirmation email. The PAX is remembered on this device right away so
   * the app is his while he goes to find the email.
   */
  async createAccount() {
    const pax = this.picked;
    if (!pax?.email || !this.canCreate) return;

    this.isLoading = true;
    try {
      await this.authService.createAccount(pax.email, this.password);
      this.currentPaxService.choose(pax);
      this.sentTo = pax.email;
      this.step = 'sent';
      this.startVerifyPoll();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        this.accountExists = true;
      } else {
        await this.showToast(
            error.message || 'Couldn\'t create your account. Try again.',
            'danger');
      }
    } finally {
      this.isLoading = false;
    }
  }

  /** He already has an account: carry his email over to the sign-in form. */
  goSignIn() {
    this.email = this.picked?.email ?? this.email;
    this.setMode('signin');
  }

  async signIn() {
    if (!this.email.trim() || !this.signInPassword) return;

    this.isLoading = true;
    try {
      await this.authService.signInWithPassword(
          this.email, this.signInPassword);
      const user = this.authService.currentUser;
      const pax = user?.email ?
          await this.paxService.getPaxByEmail(user.email) :
          undefined;
      if (pax) this.currentPaxService.choose(pax);

      if (user && !user.emailVerified) {
        // Made an account but never clicked the link: send a fresh one
        this.sentTo = user.email;
        try {
          await this.authService.sendVerificationEmail();
        } catch (e) {
          // rate limited, most likely; the screen offers a resend
        }
        this.setMode('verify');
        this.startVerifyPoll();
        return;
      }

      const name = pax ? this.utilService.normalizeName(pax.name) :
                         user?.email ?? '';
      await this.showToast(`Welcome back, ${name}!`, 'success');
      await this.modalController.dismiss();
    } catch (error: any) {
      await this.showToast(
          error.message || 'Couldn\'t sign in. Try again.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * A reset link, which also serves a PAX who only ever signed in with an
   * email link and wants a password. Uses the typed email, or the picked
   * PAX's when he got here from "that email already has an account".
   */
  async sendPasswordReset() {
    const email = (this.email || this.picked?.email || '').trim();
    if (!email) {
      await this.showToast('Enter your email first.', 'warning');
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.sendPasswordReset(email);
      await this.showToast(
          `If ${email} has an account, a reset link is on its way.`,
          'success', 5000);
    } catch (error: any) {
      await this.showToast(
          error.message || 'Couldn\'t send the email. Try again.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async resendVerification() {
    this.isLoading = true;
    try {
      await this.authService.sendVerificationEmail();
      await this.showToast(`Sent another email to ${this.sentTo}.`, 'success');
    } catch (error: any) {
      await this.showToast(
          error.message || 'Couldn\'t send the email. Try again.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /** "I clicked it": ask Firebase, and finish if so. */
  async checkVerified() {
    this.isLoading = true;
    try {
      const verified = await this.authService.refreshVerification();
      if (verified) {
        await this.finishVerified();
      } else {
        await this.showToast(
            'Not confirmed yet. Open the email and tap the link.', 'warning');
      }
    } finally {
      this.isLoading = false;
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  private startVerifyPoll() {
    this.stopVerifyPoll();
    this.verifyPoll = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (await this.authService.refreshVerification()) {
        await this.finishVerified();
      }
    }, VERIFY_POLL_MS);
  }

  private stopVerifyPoll() {
    if (this.verifyPoll) {
      clearInterval(this.verifyPoll);
      this.verifyPoll = undefined;
    }
  }

  private async finishVerified() {
    this.stopVerifyPoll();
    await this.showToast('Email confirmed. You\'re all set!', 'success');
    await this.modalController.dismiss({verified: true});
  }

  private async showToast(message: string, color: string, duration = 3000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
