import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { KotterPage } from './kotter.page';

const routes: Routes = [
  {
    path: '',
    component: KotterPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class KotterPageRoutingModule {}
