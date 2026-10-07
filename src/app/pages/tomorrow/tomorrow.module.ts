import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {TomorrowPageRoutingModule} from './tomorrow-routing.module';
import {TomorrowPage} from './tomorrow.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TomorrowPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [TomorrowPage]
})
export class TomorrowPageModule {
}
