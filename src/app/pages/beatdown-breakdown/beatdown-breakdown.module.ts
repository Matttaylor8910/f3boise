import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {BeatdownBreakdownPageRoutingModule} from './beatdown-breakdown-routing.module';
import {BeatdownBreakdownPage} from './beatdown-breakdown.page';

@NgModule({
  imports: [
    CommonModule,
    ComponentsModule,
    FormsModule,
    IonicModule,
    BeatdownBreakdownPageRoutingModule,
  ],
  declarations: [BeatdownBreakdownPage]
})
export class BeatdownBreakdownPageModule {
}
