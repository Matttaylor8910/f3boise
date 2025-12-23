import {Injectable} from '@angular/core';
import {AlertController, ToastController} from '@ionic/angular';
import * as moment from 'moment';

@Injectable({providedIn: 'root'})
export class UtilService {
  constructor(
      private readonly alertCtrl: AlertController,
      private readonly toastCtrl: ToastController,
  ) {}

  getRelativeDate(date?: string): string {
    // no-op if no date given
    if (!date) return '';

    const postMoment = moment(date);
    const days = moment().startOf('day').diff(postMoment, 'days');
    let dateString = '';

    // relative times
    if (days === 0) {
      dateString = 'Today';
    } else if (days === 1) {
      dateString = 'Yesterday';
    } else if (days > 1 && days < 7) {
      dateString = postMoment.format('dddd');
    } else {
      dateString = postMoment.format('ddd, MMM D');
    }

    // dates a year in the past should include year to be more clear
    if (days >= 365) {
      dateString += ` ${postMoment.format('YYYY')}`;
    }

    return dateString;
  }

  normalizeName(ao: string|null): string {
    if (!ao) return '';

    const sections: string[] = [];
    ao.split(/(?=[A-Z])/).forEach(splitUppercase => {
      splitUppercase.split('-').forEach(splitHyphen => {
        splitHyphen.split(' ').forEach(word => {
          if (word !== '') sections.push(word);
        });
      });
    });

    const name = sections
                     .map(word => {
                       return word.charAt(0).toUpperCase() + word.slice(1);
                     })
                     .join(' ');

    // TODO: ask Stinger to unify the ao naming lmao
    if (name === 'Warhorse') return 'War Horse';

    return name;
  }

  /**
   * Show an alert popup
   */
  alert(header: string, message: string, okText: string): Promise<void> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [{
          text: okText,
          handler: () => {
            resolve();
          }
        }]
      });

      await alert.present();
    });
  }

  // Copies a string to the clipboard. Must be called from within an
  // event handler such as click. May return false if it failed, but
  // this is not always possible. Browser support for Chrome 43+,
  // Firefox 42+, Safari 10+, Edge and IE 10+.
  // IE: The clipboard feature may be disabled by an administrator. By
  // default a prompt is shown the first time the clipboard is
  // used (per session).
  copyToClipboard(text: string, successText = 'Copied link to clipboard') {
    if (document.queryCommandSupported &&
        document.queryCommandSupported('copy')) {
      const textarea = document.createElement('textarea');
      textarea.textContent = text;
      // Prevent scrolling to bottom of page in MS Edge.
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        // Security exception may be thrown by some browsers.
        document.execCommand('copy');
        this.showToast(successText);
      } catch (ex) {
        this.showToast('Copy to clipboard failed');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  async showToast(message: string, duration: number = 2000, options?: any) {
    const toast = await this.toastCtrl.create({message, duration, ...options});
    await toast.present();
    return toast;
  }

  shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
