import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {AoDirectoryPage} from './ao-directory.page';

const routes: Routes = [
  {
    path: '',
    component: AoDirectoryPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AoDirectoryPageRoutingModule {
}
