import {Injectable} from '@angular/core';
import {AlertController} from '@ionic/angular';
import * as moment from 'moment';

@Injectable({providedIn: 'root'})
export class UtilService {
  constructor(
      private readonly alertCtrl: AlertController,
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

  normalizeName(ao: string): string {
    const sections: string[] = [];
    ao.split(/(?=[A-Z])/).forEach(splitUppercase => {
      splitUppercase.split('-').forEach(splitHyphen => {
        splitHyphen.split(' ').forEach(word => {
          sections.push(word);
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
    if (name === 'Discovery Park') return 'Discovery';

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
}
