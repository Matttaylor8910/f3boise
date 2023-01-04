import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {KotterPageRoutingModule} from './kotter-routing.module';
import {KotterPage} from './kotter.page';

@NgModule({
  imports: [
    CommonModule,
    ComponentsModule,
    FormsModule,
    IonicModule,
    KotterPageRoutingModule,
  ],
  declarations: [KotterPage]
})
export class KotterPageModule {
}
