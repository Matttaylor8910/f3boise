import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
import {ModalController} from '@ionic/angular';
import {UtilService} from 'src/app/services/util.service';

export interface Duo {
  name1: string;
  name2: string;
  count: number;
}

@Component({
  selector: 'app-duos-grid',
  templateUrl: './duos-grid.component.html',
  styleUrls: ['./duos-grid.component.scss'],
})
export class DuosGridComponent {
  @Input() duos: Duo[] = [];
  @Input() title = '';
  @Input() bbShort = 'BD';

  constructor(
      private readonly modalController: ModalController,
      private readonly router: Router,
      public readonly utilService: UtilService,
  ) {}

  async navigateToPax(name: string) {
    await this.modalController.dismiss();
    this.router.navigate(['/pax', name]);
  }

  close() {
    this.modalController.dismiss();
  }
}
