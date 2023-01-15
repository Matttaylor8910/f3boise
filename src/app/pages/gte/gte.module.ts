import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {GtePageRoutingModule} from './gte-routing.module';
import {GtePage} from './gte.page';

@NgModule({
  imports: [
    CommonModule,
    ComponentsModule,
    FormsModule,
    IonicModule,
    GtePageRoutingModule,
  ],
  declarations: [GtePage]
})
export class GtePageModule {
}
