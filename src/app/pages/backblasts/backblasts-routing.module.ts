import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BackblastsPage } from './backblasts.page';

const routes: Routes = [
  {
    path: '',
    component: BackblastsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BackblastsPageRoutingModule {}
