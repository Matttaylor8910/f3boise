import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QLineUpPageRoutingModule } from './q-line-up-routing.module';

import { QLineUpPage } from './q-line-up.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QLineUpPageRoutingModule
  ],
  declarations: [QLineUpPage]
})
export class QLineUpPageModule {}
