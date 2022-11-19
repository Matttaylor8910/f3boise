import {CommonModule, CurrencyPipe} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
import {PAXNameComponent} from './pax-name/pax-name.component';

@NgModule({
  declarations: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    PAXNameComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
  exports: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    PAXNameComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
