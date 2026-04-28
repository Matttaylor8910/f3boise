import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {GoogleMapsModule} from '@angular/google-maps';
import {IonicModule} from '@ionic/angular';

import {MapPageRoutingModule} from './map-routing.module';
import {MapPage} from './map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoogleMapsModule,
    MapPageRoutingModule,
  ],
  declarations: [MapPage],
})
export class MapPageModule {
}
