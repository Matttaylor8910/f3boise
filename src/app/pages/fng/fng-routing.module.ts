import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FNGPage } from './fng.page';

const routes: Routes = [
  {
    path: '',
    component: FNGPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FNGPageRoutingModule {}
