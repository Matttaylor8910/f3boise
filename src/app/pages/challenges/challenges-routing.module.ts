import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {ChallengeDetailPage} from './challenge-detail/challenge-detail.page';
import {ChallengesPage} from './challenges.page';

const routes: Routes = [
  {path: '', component: ChallengesPage},
  {path: ':id', component: ChallengeDetailPage},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChallengesPageRoutingModule {
}