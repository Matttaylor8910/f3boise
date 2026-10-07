import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {TomorrowPage} from './tomorrow.page';

const routes: Routes = [
  {
    path: '',
    component: TomorrowPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TomorrowPageRoutingModule {
}
