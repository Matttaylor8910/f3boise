import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {NgxOrgChartModule} from 'ngx-org-chart';
import {ComponentsModule} from 'src/app/components/components.module';

import {FamilyTreePageRoutingModule} from './family-tree-routing.module';
import {FamilyTreePage} from './family-tree.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FamilyTreePageRoutingModule,
    NgxOrgChartModule,
    ComponentsModule,
  ],
  declarations: [FamilyTreePage]
})
export class FamilyTreePageModule {
}
