import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {ChallengesPageRoutingModule} from './challenges-routing.module';
import {ChallengesPage} from './challenges.page';

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule, ChallengesPageRoutingModule,
    ComponentsModule
  ],
  declarations: [ChallengesPage]
})
export class ChallengesPageModule {
}