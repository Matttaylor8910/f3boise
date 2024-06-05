import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BackblastDetailPageRoutingModule } from './backblast-detail-routing.module';

import { BackblastDetailPage } from './backblast-detail.page';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackblastDetailPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [BackblastDetailPage]
})
export class BackblastDetailPageModule {}
