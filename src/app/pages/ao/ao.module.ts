import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {AoPageRoutingModule} from './ao-routing.module';
import {AoPage} from './ao.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AoPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [AoPage]
})
export class AoPageModule {
}
