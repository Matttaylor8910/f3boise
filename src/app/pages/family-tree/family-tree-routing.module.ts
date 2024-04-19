import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FamilyTreePage } from './family-tree.page';

const routes: Routes = [
  {
    path: '',
    component: FamilyTreePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FamilyTreePageRoutingModule {}
