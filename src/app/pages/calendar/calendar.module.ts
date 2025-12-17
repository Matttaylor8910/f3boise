import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {CalendarPageRoutingModule} from './calendar-routing.module';
import {CalendarPage} from './calendar.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CalendarPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [CalendarPage]
})
export class CalendarPageModule {
}
