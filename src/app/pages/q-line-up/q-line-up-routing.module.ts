import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QLineUpPage } from './q-line-up.page';

const routes: Routes = [
  {
    path: '',
    component: QLineUpPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QLineUpPageRoutingModule {}
