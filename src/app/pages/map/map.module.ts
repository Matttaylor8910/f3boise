import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {GoogleMapsModule} from '@angular/google-maps';
import {IonicModule} from '@ionic/angular';

import {ComponentsModule} from '../../components/components.module';
import {MapAoDetailComponent} from './components/ao-detail/ao-detail.component';
import {MapRegionTreeComponent} from './components/region-tree/region-tree.component';
import {MapPageRoutingModule} from './map-routing.module';
import {MapPage} from './map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GoogleMapsModule,
    ComponentsModule,
    MapPageRoutingModule,
  ],
  declarations: [
    MapPage,
    MapAoDetailComponent,
    MapRegionTreeComponent,
  ],
})
export class MapPageModule {
}
