import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {WrappedPage} from './wrapped.page';

const routes: Routes = [
  {
    path: '',
    component: WrappedPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WrappedPageRoutingModule {}