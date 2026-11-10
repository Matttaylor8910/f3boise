import 'firebase/compat/auth';

import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import {merge, Observable, Subject} from 'rxjs';
import {map, shareReplay} from 'rxjs/operators';

// Use any for User type since Firebase compat types are complex
// The actual type will be inferred from AngularFireAuth observables at runtime
type FirebaseUser = any;
type FirebaseUserCredential = any;

/**
 * Firebase Auth, wrapped. Accounts are email + password, where the email is
 * the one the scraper has on file for the PAX, so nobody types one. Because
 * those emails are public, an account is worth nothing until its owner
 * clicks the confirmation email: everything that writes checks
 * `emailVerified`, and so do the Firestore rules.
 */
@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly EMAIL_STORAGE_KEY = 'emailForSignIn';

  /**
   * Fires after we reload the user by hand (to pick up a fresh
   * `emailVerified`), since Firebase only emits on sign-in and sign-out.
   */
  private readonly refreshed$ = new Subject<void>();

  /**
   * Observable of the current auth state. Re-emits the same user after
   * {@link refreshVerification} so subscribers see `emailVerified` flip.
   */
  readonly authState$: Observable<FirebaseUser|null> =
      merge(
          this.afAuth.authState,
          this.refreshed$.pipe(map(() => this.auth.currentUser)),
          )
          .pipe(shareReplay({bufferSize: 1, refCount: true}));

  /** The signed-in user once he has confirmed his email, else null. */
  readonly verifiedUser$: Observable<FirebaseUser|null> =
      this.authState$.pipe(map(user => user?.emailVerified ? user : null));

  constructor(private readonly afAuth: AngularFireAuth) {
    // The confirmation link opens in the browser; when the PAX comes back to
    // the installed app, pick up that he is now verified.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.refreshVerification();
      }
    });
  }

  /**
   * Observable of the current user
   */
  get user$(): Observable<FirebaseUser|null> {
    return this.authState$;
  }

  /**
   * Observable indicating whether a user is currently signed in
   */
  get isAuthenticated$(): Observable<boolean> {
    return this.authState$.pipe(map(user => !!user));
  }

  /**
   * Get the Firebase auth instance
   */
  private get auth(): any {
    // Access Firebase auth - with default import, auth() is available
    return firebase.auth();
  }

  /**
   * Get the current user synchronously (may be null)
   */
  get currentUser(): FirebaseUser|null {
    return this.auth.currentUser;
  }

  /** Signed in and the email has been confirmed. */
  get isVerified(): boolean {
    return !!this.currentUser?.emailVerified;
  }

  /**
   * Create an account for a PAX with the email we have on file, sign him in,
   * and send the email that proves the address is his.
   */
  async createAccount(email: string, password: string):
      Promise<FirebaseUserCredential> {
    try {
      const credential = await this.auth.createUserWithEmailAndPassword(
          email.trim(), password);
      await this.sendVerificationEmail();
      return credential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /** Sign in with email and password. */
  async signInWithPassword(email: string, password: string):
      Promise<FirebaseUserCredential> {
    try {
      return await this.auth.signInWithEmailAndPassword(
          email.trim(), password);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Email the signed-in user a confirmation link. The link lands on
   * Firebase's action page, which then offers to continue to the site.
   */
  async sendVerificationEmail(): Promise<void> {
    const user = this.currentUser;
    if (!user) throw new Error('Sign in first.');
    try {
      await user.sendEmailVerification({url: window.location.origin});
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Email a password reset link. Also how a PAX who only ever signed in with
   * an email link gives his account a password. Resolves even when no account
   * has that email, so nobody can probe which PAX have accounts.
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await this.auth.sendPasswordResetEmail(
          email.trim(), {url: window.location.origin});
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Re-read the user from Firebase and refresh his ID token so a just-clicked
   * confirmation link counts, here and in Firestore rules.
   * @returns Whether the email is now verified
   */
  async refreshVerification(): Promise<boolean> {
    const user = this.currentUser;
    if (!user) return false;
    if (user.emailVerified) return true;
    try {
      await user.reload();
      if (this.auth.currentUser?.emailVerified) {
        await this.auth.currentUser.getIdToken(true);
      }
    } catch (e) {
      // offline, or the user was deleted: report what we last knew
    }
    this.refreshed$.next();
    return this.isVerified;
  }

  /**
   * Check if the current URL is a sign-in with email link
   * @param url The URL to check (defaults to current window location)
   * @returns True if the URL is a sign-in link
   */
  isSignInWithEmailLink(url?: string): boolean {
    const urlToCheck = url || window.location.href;
    return this.auth.isSignInWithEmailLink(urlToCheck);
  }

  /**
   * Complete a sign-in with an email link sent before passwords existed.
   * @param email The user's email address (required for security)
   * @param emailLink The full email link URL (defaults to current window
   *     location)
   * @returns Promise that resolves with the user credential
   */
  async signInWithEmailLink(
      email?: string,
      emailLink?: string,
      ): Promise<FirebaseUserCredential> {
    try {
      // Get the email if not provided
      const userEmail = email || this.getStoredEmail();
      if (!userEmail) {
        throw new Error(
            'Email is required to complete sign-in. ' +
                'Please provide your email address.',
        );
      }

      const link = emailLink || window.location.href;
      const credential = await this.auth.signInWithEmailLink(userEmail, link);

      // Clear the stored email after successful sign-in
      this.clearStoredEmail();

      return credential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out the current user
   * @returns Promise that resolves when sign-out is complete
   */
  async signOut(): Promise<void> {
    try {
      await this.afAuth.signOut();
      this.clearStoredEmail();
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get the stored email from localStorage
   * @returns The stored email or null
   */
  getStoredEmail(): string|null {
    return window.localStorage.getItem(this.EMAIL_STORAGE_KEY);
  }

  /**
   * Clear the stored email from localStorage
   */
  clearStoredEmail(): void {
    window.localStorage.removeItem(this.EMAIL_STORAGE_KEY);
  }

  /**
   * Handle authentication errors and provide user-friendly messages
   * @param error The error object from Firebase
   * @returns Error with user-friendly message
   */
  private handleAuthError(error: any): Error {
    let message = 'An authentication error occurred';

    if (error.code) {
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'The email address is invalid.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          message = 'Wrong email or password.';
          break;
        case 'auth/missing-password':
          message = 'Enter a password.';
          break;
        case 'auth/weak-password':
          message = 'Pick a longer password: at least 6 characters.';
          break;
        case 'auth/email-already-in-use':
          message = 'There is already an account with that email.';
          break;
        case 'auth/invalid-action-code':
          message = 'That link is invalid or has expired.';
          break;
        case 'auth/expired-action-code':
          message = 'That link has expired. Please request a new one.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Email sign-in is not enabled.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many attempts. Please wait a bit and try again.';
          break;
        case 'auth/network-request-failed':
          message = 'No connection. Check your network and try again.';
          break;
        default:
          message = error.message || message;
      }
    } else if (error.message) {
      message = error.message;
    }

    const authError = new Error(message);
    (authError as any).code = error.code;
    return authError;
  }
}
