import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {IonicModule} from '@ionic/angular';

import {SurvivorGridComponent} from './survivor-grid.component';
import {SurvivorPage} from './survivor.page';

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule,
    RouterModule.forChild([{path: '', component: SurvivorPage}])
  ],
  declarations: [SurvivorPage, SurvivorGridComponent]
})
export class SurvivorPageModule {
}