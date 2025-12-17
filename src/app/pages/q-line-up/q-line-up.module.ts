import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {QLineUpPageRoutingModule} from './q-line-up-routing.module';
import {QLineUpPage} from './q-line-up.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QLineUpPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [QLineUpPage]
})
export class QLineUpPageModule {
}
