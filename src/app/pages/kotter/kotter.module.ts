import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { KotterPageRoutingModule } from './kotter-routing.module';

import { KotterPage } from './kotter.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    KotterPageRoutingModule
  ],
  declarations: [KotterPage]
})
export class KotterPageModule {}
