import {Component} from '@angular/core';
import {Router} from '@angular/router';

interface WorkoutsView {
  label: string;
  route: string;
}

/**
 * Segment bar that ties the "where and when" pages together: tomorrow's
 * beatdowns, the Q line up, the calendar and the AO map.
 */
@Component({
  selector: 'app-workouts-nav',
  templateUrl: './workouts-nav.component.html',
  styleUrls: ['./workouts-nav.component.scss'],
})
export class WorkoutsNavComponent {
  views: WorkoutsView[] = [
    {label: 'Tomorrow', route: '/tomorrow'},
    {label: 'Q Line Up', route: '/q-line-up'},
    {label: 'Calendar', route: '/calendar'},
    {label: 'Map', route: '/map'},
  ];

  constructor(private readonly router: Router) {}

  get current(): string {
    return this.router.url.split('?')[0];
  }

  go(route: string) {
    if (route !== this.current) {
      this.router.navigateByUrl(route);
    }
  }
}
