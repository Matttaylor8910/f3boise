import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {VsPageRoutingModule} from './vs-routing.module';
import {VsPage} from './vs.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VsPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [VsPage]
})
export class VsPageModule {
}
