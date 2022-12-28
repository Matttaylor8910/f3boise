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
    loadChildren: () => import('./pages/fng/fng.module').then( m => m.FNGPageModule)
  },
  {
    path: 'workouts',
    loadChildren: () => import('./pages/workouts/workouts.module').then( m => m.WorkoutsPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules}),
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
