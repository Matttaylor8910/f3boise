import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {default as firebase} from 'firebase/compat/app';
import {Observable} from 'rxjs';
import {take} from 'rxjs/operators';
import {User} from 'types';

const DEVS = ['taylor.matt777@gmail.com'];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  loggedIn: boolean = localStorage.getItem('loggedIn') === 'true';

  constructor(
      private readonly afAuth: AngularFireAuth,
      private readonly afs: AngularFirestore,
  ) {}

  // Returns current user data
  get currentUser(): Observable<firebase.User|null> {
    return this.afAuth.user;
  }

  // return a promise that will resolve true if a user is authenticated
  async isAuthenticated(): Promise<boolean> {
    return new Promise(resolve => {
      this.afAuth.authState.pipe(take(1)).subscribe(user => {
        const isLoggedIn = user !== null;
        this.setLoggedIn(isLoggedIn);
        resolve(isLoggedIn);
      });
    });
  }

  // return a promise that will resolve true if it's Will or Matt
  async isDev(): Promise<boolean> {
    return new Promise(resolve => {
      this.afAuth.authState.pipe(take(1)).subscribe(user => {
        resolve(DEVS.includes(user?.email ?? ''));
      });
    });
  }

  /**
   * Login given an email and password
   */
  async loginWithEmailAndPassword(email: string, password: string) {
    return this.afAuth.signInWithEmailAndPassword(email, password)
        .catch(this.errorHandler.bind(this));
  }

  /**
   * Create an account with the given email and password then save the given
   * name to their user document
   */
  async signUpWithEmailAndPassword(email: string, password: string) {
    const userCredential =
        await this.afAuth.createUserWithEmailAndPassword(email, password)
            .catch(this.errorHandler.bind(this));

    // if we have a valid user credential, add/update the user document
    if (userCredential && userCredential.user !== null) {
      this.updateUserData(userCredential.user);
    }

    return userCredential;
  }

  /**
   * Send a password reset email and catch errors
   */
  async sendPasswordResetEmail(email: string) {
    try {
      await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      // do nothing in the case of a failure except re-throw
      if (!(error as {code: string}).code.startsWith('auth/')) {
        throw error;
      }
    }
    this.showToast(
        `If an account exists for ${
            email}, an email will be sent with further instructions`,
        10000, 'Okay');
  }

  /**
   * Handle AngularFireAuth errors and present toasts
   */
  errorHandler(error: {code: string; message: string}) {
    let {message} = error;
    switch (error.code) {
      case 'auth/invalid-email':
        message = 'Please enter a valid email address';
        break;
      case 'auth/user-not-found':
        message = 'An account with that email address does not exist';
        break;
      case 'auth/wrong-password':
        message = 'Invalid email or password';
        break;
      case 'auth/email-already-in-use':
        message = 'This email is already in use. Login or reset password';
        break;
      case 'auth/popup-closed-by-user':
        // if they close the popup, just do nothing
        return;
      default:
        break;
    }

    // show a toast and re-throw the error if it's not from Firebase Auth
    this.showToast(message);
    if (!error.code.startsWith('auth/')) {
      throw error;
    }
  }

  /**
   * Show a given message for the given duration
   */
  showToast(message: string, duration = 4000, buttonText?: string) {
    console.log(`TODO: show message: ${message}`);
  }

  /**
   * Set a local variable for showing UI components for being logged in
   * This eliminates flicker of the nav bar between login/other pages
   * @param isLoggedIn
   */
  setLoggedIn(isLoggedIn: boolean) {
    this.loggedIn = isLoggedIn;
    localStorage.setItem('loggedIn', isLoggedIn.toString());
  }

  /**
   * Logs out the current user.
   */
  logOut(): Promise<void> {
    this.setLoggedIn(false);
    return this.afAuth.signOut();
  }

  /**
   * Whenever a user logs in in with any auth service, call this function to
   * add/update that user's data in Firestore
   * Additionally, call the Cloud Function that adds this user as admin for all
   * festivals they are invited to.
   */
  private async updateUserData(
      firebaseUser: firebase.User, additionalInfo?: Partial<User>) {
    const path = `users/${firebaseUser.uid}`;
    const data: Partial<User> = {};

    if (firebaseUser.displayName) {
      data.name = firebaseUser.displayName;
    }
    if (firebaseUser.email) {
      data.email = firebaseUser.email;
    }
    if (firebaseUser.photoURL) {
      data.photoURL = firebaseUser.photoURL;
    }

    // assign any additional info passed in
    Object.assign(data, additionalInfo);

    await this.afs.doc(path).set(data, {merge: true});
  }
}
