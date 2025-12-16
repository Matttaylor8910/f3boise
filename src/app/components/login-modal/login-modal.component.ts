import {Component} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {PaxService} from 'src/app/services/pax.service';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent {
  email = '';
  isLoading = false;

  constructor(
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
  ) {}

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
