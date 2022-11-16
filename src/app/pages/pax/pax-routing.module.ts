import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PaxPage } from './pax.page';

const routes: Routes = [
  {
    path: '',
    component: PaxPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PaxPageRoutingModule {}
