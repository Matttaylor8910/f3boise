import {CommonModule, CurrencyPipe} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
import {HeaderComponent} from './header/header.component';
import {PaxAvatarComponent} from './pax-avatar/pax-avatar.component';
import {PaxChipComponent} from './pax-chip/pax-chip.component';
import {PaxListItemComponent} from './pax-list-item/pax-list-item.component';
import {PAXNameComponent} from './pax-name/pax-name.component';
import {TimeFilterComponent} from './time-filter/time-filter.component';
import {YearGridComponent} from './year-grid/year-grid.component';
import { BackblastCardComponent } from './backblast-card/backblast-card.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    BackblastCardComponent,
    HeaderComponent,
    PaxAvatarComponent,
    PaxChipComponent,
    PaxListItemComponent,
    PAXNameComponent,
    TimeFilterComponent,
    YearGridComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule,
  ],
  exports: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    BackblastCardComponent,
    HeaderComponent,
    PaxAvatarComponent,
    PaxChipComponent,
    PaxListItemComponent,
    PAXNameComponent,
    TimeFilterComponent,
    YearGridComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
