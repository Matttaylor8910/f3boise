import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {ComponentsModule} from 'src/app/components/components.module';

import {AdminPageRoutingModule} from './admin-routing.module';
import {AdminPage} from './admin.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [AdminPage],
})
export class AdminPageModule {
}
