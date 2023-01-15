import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

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
    path: 'pax/:name',
    loadChildren: () =>
        import('./pages/pax/pax.module').then(m => m.PaxPageModule)
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
    loadChildren: () => import('./pages/gte/gte.module').then( m => m.GtePageModule)
  },
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
