import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {WrappedPageRoutingModule} from './wrapped-routing.module';
import {WrappedPage} from './wrapped.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WrappedPageRoutingModule,
    ComponentsModule
  ],
  declarations: [WrappedPage]
})
export class WrappedPageModule {}