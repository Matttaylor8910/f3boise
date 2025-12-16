import 'firebase/compat/auth';
import 'firebase/compat/auth';

import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

// Use any for User type since Firebase compat types are complex
// The actual type will be inferred from AngularFireAuth observables at runtime
type FirebaseUser = any;
type FirebaseUserCredential = any;

/**
 * Action code settings for email link authentication
 */
export interface ActionCodeSettings {
  // URL you want to redirect back to. The domain must be in the authorized
  // domains list
  url: string;
  // This must be true for email link sign-in
  handleCodeInApp: true;
  // iOS bundle ID (optional)
  iOS?: {bundleId: string;};
  // Android package name (optional)
  android?:
      {packageName: string; installApp?: boolean; minimumVersion?: string;};
  // Custom link domain (optional)
  linkDomain?: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly EMAIL_STORAGE_KEY = 'emailForSignIn';

  constructor(private readonly afAuth: AngularFireAuth) {}

  /**
   * Observable of the current user
   */
  get user$(): Observable<FirebaseUser|null> {
    return this.afAuth.user;
  }

  /**
   * Observable of the current auth state
   */
  get authState$(): Observable<FirebaseUser|null> {
    return this.afAuth.authState;
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

  /**
   * Send a sign-in link to the user's email address
   * @param email The user's email address
   * @param actionCodeSettings Configuration for the email link
   * @returns Promise that resolves when the email is sent
   */
  async sendSignInLinkToEmail(
      email: string,
      actionCodeSettings: ActionCodeSettings,
      ): Promise<void> {
    try {
      await this.auth.sendSignInLinkToEmail(email, actionCodeSettings);
      // Save the email locally so we don't need to ask for it again
      // if the user opens the link on the same device
      window.localStorage.setItem(this.EMAIL_STORAGE_KEY, email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
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
   * Complete the sign-in process with an email link
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
   * Create default action code settings for email link sign-in
   * @param redirectUrl The URL to redirect to after sign-in
   * @param options Optional settings for iOS/Android apps
   * @returns ActionCodeSettings object
   */
  createActionCodeSettings(
      redirectUrl: string,
      options?: {
        iOS?: {bundleId: string};
        android?: {
          packageName: string;
          installApp?: boolean;
          minimumVersion?: string
        };
        linkDomain?: string;
      },
      ): ActionCodeSettings {
    const settings: ActionCodeSettings = {
      url: redirectUrl,
      handleCodeInApp: true,
    };

    if (options?.iOS) {
      settings.iOS = options.iOS;
    }

    if (options?.android) {
      settings.android = options.android;
    }

    if (options?.linkDomain) {
      settings.linkDomain = options.linkDomain;
    }

    return settings;
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
          message = 'This user account has been disabled.';
          break;
        case 'auth/user-not-found':
          message = 'No user found with this email address.';
          break;
        case 'auth/invalid-action-code':
          message = 'The sign-in link is invalid or has expired.';
          break;
        case 'auth/expired-action-code':
          message = 'The sign-in link has expired. Please request a new one.';
          break;
        case 'auth/invalid-credential':
          message = 'The email address does not match the sign-in link.';
          break;
        case 'auth/email-already-in-use':
          message = 'This email address is already in use.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Email link sign-in is not enabled.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many requests. Please try again later.';
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
