import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';

interface WorkoutsView {
  label: string;
  route: string;
}

/**
 * Segment bar that ties the "where and when" pages together: tomorrow's
 * beatdowns, the Q line up, the calendar and the AO map.
 *
 * Plain buttons rather than ion-segment: Ionic keeps visited pages alive in
 * the router outlet, and a segment on a cached page would hold on to
 * whatever was tapped last instead of following the URL.
 */
@Component({
  selector: 'app-workouts-nav',
  templateUrl: './workouts-nav.component.html',
  styleUrls: ['./workouts-nav.component.scss'],
})
export class WorkoutsNavComponent implements OnInit, OnDestroy {
  views: WorkoutsView[] = [
    {label: 'Tomorrow', route: '/tomorrow'},
    {label: 'Q Line Up', route: '/q-line-up'},
    {label: 'Calendar', route: '/calendar'},
    {label: 'Map', route: '/map'},
  ];

  /** The highlighted route: the URL, or the tap that's about to become it. */
  current = '';

  private routerSubscription?: Subscription;

  constructor(private readonly router: Router) {}

  ngOnInit() {
    this.current = this.routeFromUrl();
    this.routerSubscription =
        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => this.current = this.routeFromUrl());
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  go(route: string) {
    if (route === this.current) return;
    this.current = route;
    this.router.navigateByUrl(route);
  }

  private routeFromUrl(): string {
    return this.router.url.split('?')[0];
  }
}
