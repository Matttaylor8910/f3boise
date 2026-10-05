import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {BestieWebPage} from './bestie-web.page';

const routes: Routes = [
  {
    path: '',
    component: BestieWebPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BestieWebPageRoutingModule {
}
