import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AoPageRoutingModule } from './ao-routing.module';

import { AoPage } from './ao.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AoPageRoutingModule
  ],
  declarations: [AoPage]
})
export class AoPageModule {}
