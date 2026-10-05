import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {BestieWebPageRoutingModule} from './bestie-web-routing.module';
import {BestieWebPage} from './bestie-web.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BestieWebPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [BestieWebPage]
})
export class BestieWebPageModule {
}
