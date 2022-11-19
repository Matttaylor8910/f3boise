import {CommonModule, CurrencyPipe} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
import {PAXNameComponent} from './pax-name/pax-name.component';
import {TimeFilterComponent} from './time-filter/time-filter.component';

@NgModule({
  declarations: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    PAXNameComponent,
    TimeFilterComponent,
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
    TimeFilterComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
