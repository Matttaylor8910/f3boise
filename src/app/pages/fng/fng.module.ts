import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {FNGPageRoutingModule} from './fng-routing.module';
import {FNGPage} from './fng.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FNGPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [FNGPage]
})
export class FNGPageModule {
}
