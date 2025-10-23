import {Component, Input} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {UtilService} from 'src/app/services/util.service';

export interface Bestie {
  name: string;
  count: number;
}

@Component({
  selector: 'app-besties-grid',
  templateUrl: './besties-grid.component.html',
  styleUrls: ['./besties-grid.component.scss'],
})
export class BestiesGridComponent {
  @Input() besties: Bestie[] = [];
  @Input() paxName: string = '';

  constructor(
      private readonly modalController: ModalController,
      public readonly utilService: UtilService,
  ) {}

  async navigateToPax(name: string) {
    await this.modalController.dismiss();
    window.location.href = `/pax/${name}`;
  }

  close() {
    this.modalController.dismiss();
  }
}
