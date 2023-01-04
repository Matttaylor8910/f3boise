import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {PaxPageRoutingModule} from './pax-routing.module';
import {PaxPage} from './pax.page';

@NgModule({
  imports: [
    CommonModule,
    ComponentsModule,
    FormsModule,
    IonicModule,
    PaxPageRoutingModule,
  ],
  declarations: [PaxPage]
})
export class PaxPageModule {
}
