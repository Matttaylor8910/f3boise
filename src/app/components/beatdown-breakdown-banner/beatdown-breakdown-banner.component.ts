import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'app-beatdown-breakdown-banner',
  templateUrl: './beatdown-breakdown-banner.component.html',
  styleUrls: ['./beatdown-breakdown-banner.component.scss'],
})
export class BeatdownBreakdownBannerComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  showBanner = false;
  private routerSubscription?: Subscription;

  constructor(private readonly router: Router) {}

  ngOnInit() {
    this.checkIfShouldShow();
    // Subscribe to route changes
    this.routerSubscription = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.checkIfShouldShow();
        });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  private checkIfShouldShow() {
    // Only show banner from December 20 - December 31
    const now = new Date();
    const month = now.getMonth(); // 0-11 (December is 11)
    const day = now.getDate();

    // Check if it's December 20-31
    const isWithinDateRange = month === 11 && day >= 20 && day <= 31;

    if (!isWithinDateRange) {
      this.showBanner = false;
      return;
    }

    const currentUrl = this.router.url.split('?')[0];

    // Don't show on public pages
    const publicPages = ['/', '/fng', '/workouts'];
    if (publicPages.includes(currentUrl)) {
      this.showBanner = false;
      return;
    }

    // Don't show on wrapped pages (e.g., /2025)
    // Check if the route matches a 4-digit year pattern
    const yearPattern = /^\/\d{4}$/;
    if (yearPattern.test(currentUrl)) {
      this.showBanner = false;
      return;
    }

    // Show on all other pages (main app pages)
    this.showBanner = true;
  }

  navigateToBeatdownBreakdown() {
    this.router.navigateByUrl(`/${this.currentYear}`);
  }
}

