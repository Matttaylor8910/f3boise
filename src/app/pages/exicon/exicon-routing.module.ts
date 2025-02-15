import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ExiconPage } from './exicon.page';

const routes: Routes = [
  {
    path: '',
    component: ExiconPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExiconPageRoutingModule {}
