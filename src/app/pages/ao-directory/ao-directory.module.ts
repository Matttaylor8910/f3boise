import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {AoDirectoryPageRoutingModule} from './ao-directory-routing.module';
import {AoDirectoryPage} from './ao-directory.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AoDirectoryPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [AoDirectoryPage]
})
export class AoDirectoryPageModule {
}
