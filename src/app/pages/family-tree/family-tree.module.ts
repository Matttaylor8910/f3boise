import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FamilyTreePageRoutingModule } from './family-tree-routing.module';

import { FamilyTreePage } from './family-tree.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FamilyTreePageRoutingModule
  ],
  declarations: [FamilyTreePage]
})
export class FamilyTreePageModule {}
