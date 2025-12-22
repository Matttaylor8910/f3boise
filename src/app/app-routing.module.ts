import {Component, NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

import {LuckyGuard} from './guards/lucky.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
        import('./pages/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'ao/:name',
    loadChildren: () => import('./pages/ao/ao.module').then(m => m.AoPageModule)
  },
  {
    path: 'region/:name',
    loadChildren: () => import('./pages/ao/ao.module').then(m => m.AoPageModule)
  },
  {
    path: 'dd/:name',
    loadChildren: () => import('./pages/ao/ao.module').then(m => m.AoPageModule)
  },
  {
    path: 'pax/:name',
    loadChildren: () =>
        import('./pages/pax/pax.module').then(m => m.PaxPageModule)
  },
  {
    path: 'beatdown-breakdown/:userId',
    loadChildren: () =>
        import('./pages/beatdown-breakdown/beatdown-breakdown.module')
            .then(m => m.BeatdownBreakdownPageModule)
  },
  {
    path: 'fng',
    loadChildren: () =>
        import('./pages/fng/fng.module').then(m => m.FNGPageModule)
  },
  {
    path: 'workouts',
    loadChildren: () => import('./pages/workouts/workouts.module')
                            .then(m => m.WorkoutsPageModule)
  },
  {
    path: 'ao/:name/kotter',
    loadChildren: () =>
        import('./pages/kotter/kotter.module').then(m => m.KotterPageModule)
  },
  {
    path: 'q-line-up',
    loadChildren: () => import('./pages/q-line-up/q-line-up.module')
                            .then(m => m.QLineUpPageModule)
  },
  {
    path: 'gte',
    loadChildren: () =>
        import('./pages/gte/gte.module').then(m => m.GtePageModule)
  },
  {
    path: 'challenges',
    loadChildren: () => import('./pages/challenges/challenges.module')
                            .then(m => m.ChallengesPageModule)
  },
  {
    path: 'backblasts',
    loadChildren: () => import('./pages/backblasts/backblasts.module')
                            .then(m => m.BackblastsPageModule)
  },
  {
    path: 'backblasts/:id',
    loadChildren: () =>
        import('./pages/backblast-detail/backblast-detail.module')
            .then(m => m.BackblastDetailPageModule)
  },
  {
    path: 'calendar',
    loadChildren: () => import('./pages/calendar/calendar.module')
                            .then(m => m.CalendarPageModule)
  },
  {
    path: 'summary',
    loadChildren: () =>
        import('./pages/summary/summary.module').then(m => m.SummaryPageModule)
  },
  {
    path: 'family-tree',
    loadChildren: () => import('./pages/family-tree/family-tree.module')
                            .then(m => m.FamilyTreePageModule)
  },
  {
    path: 'lucky',
    component: Component,
    canActivate: [LuckyGuard],
  },
  {
    path: 'exicon',
    loadChildren: () =>
        import('./pages/exicon/exicon.module').then(m => m.ExiconPageModule)
  },
  {
    path: 'wrapped',
    loadChildren: () =>
        import('./pages/wrapped/wrapped.module').then(m => m.WrappedPageModule)
  }
];

// fallback to home, must be the last route in this list
routes.push({
  path: '**',
  redirectTo: '',
  pathMatch: 'full',
});

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules}),
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
