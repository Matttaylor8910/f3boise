import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {BeatdownBreakdownPage} from './beatdown-breakdown.page';

const routes: Routes = [{path: '', component: BeatdownBreakdownPage}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BeatdownBreakdownPageRoutingModule {
}
