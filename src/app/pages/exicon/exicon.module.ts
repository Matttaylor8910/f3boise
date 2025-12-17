import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {ExiconPageRoutingModule} from './exicon-routing.module';
import {ExiconPage} from './exicon.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ExiconPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [ExiconPage]
})
export class ExiconPageModule {
}
