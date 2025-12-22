import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {ModalController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {LoginModalComponent} from 'src/app/components/login-modal/login-modal.component';

type FirebaseUser = any;

@Component({
  selector: 'app-wrapped',
  templateUrl: './wrapped.page.html',
  styleUrls: ['./wrapped.page.scss'],
})
export class WrappedPage {
  user: FirebaseUser|null = null;
  private readonly WRAPPED_REDIRECT_KEY = 'wrappedRedirectAfterLogin';

  constructor(
      private readonly authService: AuthService,
      private readonly router: Router,
      private readonly modalController: ModalController,
  ) {}

  ionViewWillEnter() {
    this.authService.authState$.subscribe(user => {
      this.user = user;
      
      // Check if we should redirect after login
      if (user?.uid) {
        const shouldRedirect = localStorage.getItem(this.WRAPPED_REDIRECT_KEY);
        if (shouldRedirect) {
          localStorage.removeItem(this.WRAPPED_REDIRECT_KEY);
          this.router.navigateByUrl(`/beatdown-breakdown/${user.uid}`);
        }
      }
    });
  }

  async onLetsRoll() {
    if (this.user?.uid) {
      this.router.navigateByUrl(`/beatdown-breakdown/${this.user.uid}`);
    } else {
      localStorage.setItem(this.WRAPPED_REDIRECT_KEY, 'true');
      await this.openLoginModal();
    }
  }

  private async openLoginModal() {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  ionViewDidEnter() {
    if (this.authService.isSignInWithEmailLink()) {
      this.completeEmailSignIn();
    }
  }

  private async completeEmailSignIn() {
    try {
      const email = this.authService.getStoredEmail();
      if (email) {
        await this.authService.signInWithEmailLink(email);
        const shouldRedirect = localStorage.getItem(this.WRAPPED_REDIRECT_KEY);
        if (shouldRedirect && this.user?.uid) {
          localStorage.removeItem(this.WRAPPED_REDIRECT_KEY);
          this.router.navigateByUrl(`/beatdown-breakdown/${this.user.uid}`);
        }
      }
    } catch (error: any) {
      console.error('Error completing sign-in:', error);
    }
  }
}