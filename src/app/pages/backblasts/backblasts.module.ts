import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {BackblastsPageRoutingModule} from './backblasts-routing.module';
import {BackblastsPage} from './backblasts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackblastsPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [BackblastsPage]
})
export class BackblastsPageModule {
}
