import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PaxPageRoutingModule } from './pax-routing.module';

import { PaxPage } from './pax.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PaxPageRoutingModule
  ],
  declarations: [PaxPage]
})
export class PaxPageModule {}
