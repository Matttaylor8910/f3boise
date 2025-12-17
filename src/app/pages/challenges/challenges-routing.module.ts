import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {ChallengesPage} from './challenges.page';

const routes: Routes = [{path: '', component: ChallengesPage}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChallengesPageRoutingModule {
}