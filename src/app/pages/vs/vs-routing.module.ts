import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {VsPage} from './vs.page';

const routes: Routes = [
  {
    path: '',
    component: VsPage,
  },
  {
    path: ':name1/:name2',
    component: VsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VsPageRoutingModule {
}
