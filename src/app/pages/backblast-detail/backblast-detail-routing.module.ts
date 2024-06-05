import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BackblastDetailPage } from './backblast-detail.page';

const routes: Routes = [
  {
    path: '',
    component: BackblastDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BackblastDetailPageRoutingModule {}
