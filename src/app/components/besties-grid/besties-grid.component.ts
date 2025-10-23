import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
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
