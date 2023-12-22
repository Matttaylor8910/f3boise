import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {SummaryPageRoutingModule} from './summary-routing.module';
import {SummaryPage} from './summary.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SummaryPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [SummaryPage]
})
export class SummaryPageModule {
}
