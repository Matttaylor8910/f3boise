import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ExiconPageRoutingModule } from './exicon-routing.module';

import { ExiconPage } from './exicon.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ExiconPageRoutingModule
  ],
  declarations: [ExiconPage]
})
export class ExiconPageModule {}
