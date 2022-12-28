import {CommonModule, CurrencyPipe} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
import {HeaderComponent} from './header/header.component';
import {PaxListItemComponent} from './pax-list-item/pax-list-item.component';
import {PAXNameComponent} from './pax-name/pax-name.component';
import {TimeFilterComponent} from './time-filter/time-filter.component';

@NgModule({
  declarations: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    HeaderComponent,
    PaxListItemComponent,
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
    HeaderComponent,
    PaxListItemComponent,
    PAXNameComponent,
    TimeFilterComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
