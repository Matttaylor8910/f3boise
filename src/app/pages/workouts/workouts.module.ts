import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {WorkoutsPageRoutingModule} from './workouts-routing.module';
import {WorkoutsPage} from './workouts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WorkoutsPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [WorkoutsPage]
})
export class WorkoutsPageModule {
}
