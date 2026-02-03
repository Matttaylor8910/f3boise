import {Component} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {GoogleFormModalComponent} from 'src/app/components/google-form-modal/google-form-modal.component';

const ADD_EVENT_URL = 'https://forms.gle/18XCU2naNH7D1Hcp8';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
})
export class CalendarPage {
  constructor(private readonly modalController: ModalController) {}

  async addEvent() {
    const modal = await this.modalController.create({
      component: GoogleFormModalComponent,
      componentProps: {
        formUrl: ADD_EVENT_URL,
      },
      cssClass: 'google-form-modal',
      showBackdrop: true,
      backdropDismiss: true,
    });

    await modal.present();
  }
}
