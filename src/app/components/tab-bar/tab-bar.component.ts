import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';
import {SidebarService} from 'src/app/services/sidebar.service';

interface Tab {
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
  /** URL prefixes that count as "inside" this tab. */
  matches: string[];
  isActive: boolean;
}

/** Routes that are public marketing pages and get no app chrome. */
const STATIC_PAGES = ['/', '/fng', '/workouts'];

/**
 * Bottom tab bar shown on phones in place of digging through the side menu.
 * The fifth tab opens the side menu for everything else.
 */
@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.component.html',
  styleUrls: ['./tab-bar.component.scss'],
})
export class TabBarComponent implements OnInit, OnDestroy {
  visible = false;

  tabs: Tab[] = [
    {
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
      route: '/stats',
      matches: ['/stats'],
      isActive: false,
    },
    {
      label: 'Workouts',
      icon: 'location-outline',
      activeIcon: 'location',
      route: '/tomorrow',
      matches: ['/tomorrow', '/q-line-up', '/calendar', '/map'],
      isActive: false,
    },
    {
      label: 'Stats',
      icon: 'stats-chart-outline',
      activeIcon: 'stats-chart',
      route: '/aos',
      matches: ['/aos', '/ao/', '/region/', '/dd/', '/pax/'],
      isActive: false,
    },
    {
      label: 'Backblasts',
      icon: 'document-text-outline',
      activeIcon: 'document-text',
      route: '/backblasts',
      matches: ['/backblasts'],
      isActive: false,
    },
  ];

  private routerSubscription?: Subscription;
  private resizeListener?: () => void;

  constructor(
      private readonly router: Router,
      private readonly sidebarService: SidebarService,
  ) {}

  ngOnInit() {
    this.routerSubscription =
        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => this.update());
    this.resizeListener = () => this.update();
    window.addEventListener('resize', this.resizeListener);
    this.update();
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  go(tab: Tab) {
    this.sidebarService.close();
    this.router.navigateByUrl(tab.route);
  }

  openMenu() {
    this.sidebarService.toggle();
  }

  private update() {
    const url = this.router.url.split('?')[0];
    const isYearRoute = /^\/(\d{4})$/.test(url);
    const isMobile = window.innerWidth < 1024;
    this.visible = isMobile && !STATIC_PAGES.includes(url) && !isYearRoute;

    const lower = url.toLowerCase();
    for (const tab of this.tabs) {
      tab.isActive = tab.matches.some(prefix => {
        const dir = prefix.endsWith('/') ? prefix : prefix + '/';
        return lower === prefix || lower.startsWith(dir);
      });
    }
  }
}
