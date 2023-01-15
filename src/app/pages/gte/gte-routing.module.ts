import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GtePage } from './gte.page';

const routes: Routes = [
  {
    path: '',
    component: GtePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GtePageRoutingModule {}
