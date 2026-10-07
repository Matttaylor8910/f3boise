import {Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NavigationEnd, NavigationExtras, Router} from '@angular/router';
import {ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {filter, Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {ChallengesService} from 'src/app/services/challenges.service';
import {CurrentPaxService, MyAo} from 'src/app/services/current-pax.service';
import {PaxService} from 'src/app/services/pax.service';
import {SidebarService} from 'src/app/services/sidebar.service';
import {UtilService} from 'src/app/services/util.service';
import {Challenge, Pax} from 'types';

import {CANYON_AOS, CITY_OF_TREES_AOS, HIGH_DESERT_AOS, REGION_AGNOSTIC_AOS, SETTLERS_AOS} from '../../../../constants';

interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  /** URL prefixes that count as "inside" this item. */
  matches: string[];
  isActive: boolean;
}

interface NavGroup {
  key: string;
  title: string;
  items: NavigationItem[];
  collapsed: boolean;
}

interface SearchEntry {
  name: string;
  normalizedName: string;
  kind: 'PAX'|'AO';
  route: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  isOpen = false;
  isMobile = false;
  shouldHide = false;
  private subscription?: Subscription;
  private routerSubscription?: Subscription;
  private resizeListener?: () => void;

  // Routes that should hide sidebar (public static pages and special views)
  private staticPages = ['/', '/fng', '/workouts'];

  /** The things people check on daily or weekly. */
  mainItems: NavigationItem[] = [
    {
      label: 'Home',
      route: '/stats',
      icon: 'home-outline',
      matches: ['/stats'],
      isActive: false,
    },
    {
      label: 'Workouts',
      route: '/tomorrow',
      icon: 'location-outline',
      matches: ['/tomorrow', '/q-line-up', '/calendar', '/map'],
      isActive: false,
    },
    {
      label: 'Stats',
      route: '/aos',
      icon: 'stats-chart-outline',
      matches: ['/aos', '/ao/', '/region/', '/dd/'],
      isActive: false,
    },
    {
      label: 'Backblasts',
      route: '/backblasts',
      icon: 'document-text-outline',
      matches: ['/backblasts'],
      isActive: false,
    },
    {
      label: 'Challenges',
      route: '/challenges',
      icon: 'trophy-outline',
      matches: ['/challenges'],
      isActive: false,
    },
  ];

  /** The fun stuff and the public site, grouped and collapsible. */
  groups: NavGroup[] = [
    {
      key: 'explore',
      title: 'Explore',
      collapsed: false,
      items: [
        {
          label: 'Family Tree',
          route: '/family-tree',
          icon: 'git-network-outline',
          matches: ['/family-tree'],
          isActive: false,
        },
        {
          label: 'Bestie Web',
          route: '/bestie-web',
          icon: 'people-outline',
          matches: ['/bestie-web'],
          isActive: false,
        },
        {
          label: 'Head to Head',
          route: '/vs',
          icon: 'swap-horizontal-outline',
          matches: ['/vs'],
          isActive: false,
        },
        {
          label: `${new Date().getFullYear()} in Review`,
          route: `/${new Date().getFullYear()}`,
          icon: 'sparkles-outline',
          matches: [`/${new Date().getFullYear()}`],
          isActive: false,
        },
        {
          label: 'Random Backblast',
          route: '/lucky',
          icon: 'shuffle-outline',
          matches: ['/lucky'],
          isActive: false,
        },
      ],
    },
    {
      key: 'about',
      title: 'About F3',
      collapsed: true,
      items: [
        {
          label: 'Main site',
          route: '/',
          icon: 'globe-outline',
          matches: ['/'],
          isActive: false,
        },
        {
          label: 'New here? (FNG)',
          route: '/fng',
          icon: 'hand-right-outline',
          matches: ['/fng'],
          isActive: false,
        },
        {
          label: 'Workouts & schedule',
          route: '/workouts',
          icon: 'calendar-outline',
          matches: ['/workouts'],
          isActive: false,
        },
        {
          label: 'Exicon',
          route: '/exicon',
          icon: 'book-outline',
          matches: ['/exicon'],
          isActive: false,
        },
      ],
    },
  ];

  currentChallenges: Challenge[] = [];
  private challengesSubscription?: Subscription;

  pax?: Pax;
  myAos: MyAo[] = [];
  activeAo = '';
  private paxSubscription?: Subscription;

  @ViewChild('paxSearchInput') paxSearchInput?: ElementRef<HTMLInputElement>;
  paxSearchOpen = false;
  paxSearchQuery = '';
  paxSearchResults: SearchEntry[] = [];
  paxSearchLoading = false;
  private allPaxEntries: SearchEntry[] = [];
  private aoEntries: SearchEntry[] = [];
  private readonly maxPaxResults = 30;

  constructor(
      private readonly sidebarService: SidebarService,
      private readonly router: Router,
      public readonly utilService: UtilService,
      private readonly authService: AuthService,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
      private readonly paxService: PaxService,
      private readonly currentPaxService: CurrentPaxService,
  ) {}

  ngOnInit() {
    // Handle email link sign-in (check on every page load)
    this.handleEmailLinkSignIn();

    // Every AO is searchable alongside PAX
    const allAos = new Set<string>([
      ...CITY_OF_TREES_AOS,
      ...HIGH_DESERT_AOS,
      ...SETTLERS_AOS,
      ...CANYON_AOS,
      ...REGION_AGNOSTIC_AOS,
    ]);
    this.aoEntries = Array.from(allAos)
                         .map((ao): SearchEntry => ({
                                name: ao,
                                normalizedName: this.utilService.normalizeName(ao),
                                kind: 'AO',
                                route: `/ao/${ao}`,
                              }))
                         .sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

    // Remember which groups the viewer collapsed
    this.groups = this.groups.map(group => {
      const stored = localStorage.getItem(`sidebar-group-collapsed-${group.key}`);
      return {
        ...group,
        collapsed: stored !== null ? stored === 'true' : group.collapsed,
      };
    });

    this.subscription = this.sidebarService.isOpen$.subscribe(isOpen => {
      this.isOpen = isOpen;
    });

    // Subscribe to router events to update active states
    this.routerSubscription =
        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
              // Use setTimeout to ensure router URL is updated
              setTimeout(() => {
                this.updateActiveStates();
                this.checkIfShouldHide();
              }, 0);
            });

    this.checkMobile();
    this.checkIfShouldHide();
    this.updateActiveStates();  // Initial update
    this.resizeListener = () => {
      this.checkMobile();
      this.handleResize();
    };
    window.addEventListener('resize', this.resizeListener);

    // Load current challenges
    this.loadCurrentChallenges();

    // Pin the signed-in PAX's own AOs
    this.paxSubscription =
        this.currentPaxService.pax$.subscribe(async (pax: Pax|undefined) => {
          this.pax = pax;
          this.myAos = pax ? await this.currentPaxService.getMyAos(pax.name) :
                             [];
        });
  }

  checkMobile() {
    this.isMobile = window.innerWidth < 1024;
    this.checkIfShouldHide();
  }

  private checkIfShouldHide() {
    const currentUrl = this.router.url.split('?')[0];
    // Check if it's a year route (4 digits)
    const isYearRoute = /^\/(\d{4})$/.test(currentUrl);
    this.shouldHide = this.staticPages.includes(currentUrl) || isYearRoute;
    // Close sidebar if it should be hidden
    if (this.shouldHide && this.isOpen) {
      this.sidebarService.close();
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.challengesSubscription?.unsubscribe();
    this.paxSubscription?.unsubscribe();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  @HostListener('window:resize', ['$event'])
  handleResize() {
    // On large screens, always keep sidebar open
    if (window.innerWidth >= 1024) {
      this.sidebarService.open();
    }
  }

  toggle() {
    this.sidebarService.toggle();
  }

  close() {
    // Only close on small screens
    if (window.innerWidth < 1024) {
      this.sidebarService.close();
    }
  }

  async togglePaxSearch() {
    this.paxSearchOpen = !this.paxSearchOpen;
    if (!this.paxSearchOpen) {
      this.paxSearchQuery = '';
      this.paxSearchResults = [];
      return;
    }

    // Focus the input once it renders
    setTimeout(() => this.paxSearchInput?.nativeElement?.focus(), 0);

    if (this.allPaxEntries.length === 0) {
      this.paxSearchLoading = true;
      try {
        const allPax = await this.paxService.getAllData();
        this.allPaxEntries =
            allPax
                .map((pax): SearchEntry => ({
                       name: pax.name,
                       normalizedName: this.utilService.normalizeName(pax.name),
                       kind: 'PAX',
                       route: `/pax/${pax.name.toLowerCase()}`,
                     }))
                .sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
      } finally {
        this.paxSearchLoading = false;
      }
    }
    this.filterPaxResults();
  }

  filterPaxResults() {
    const query = this.paxSearchQuery.toLowerCase().trim();
    if (!query) {
      this.paxSearchResults = [];
      return;
    }
    const matches = (entry: SearchEntry) =>
        entry.normalizedName.toLowerCase().includes(query);
    // AOs first (there are only a few), then PAX
    this.paxSearchResults = [
      ...this.aoEntries.filter(matches),
      ...this.allPaxEntries.filter(matches),
    ].slice(0, this.maxPaxResults);
  }

  selectPax(entry: SearchEntry) {
    this.paxSearchOpen = false;
    this.paxSearchQuery = '';
    this.paxSearchResults = [];
    this.navigate(entry.route);
  }

  navigate(route: string) {
    const navigationExtras: NavigationExtras = {
      replaceUrl: true,  // Replace current history state instead of pushing
    };
    this.router.navigateByUrl(route, navigationExtras).then(() => {
      // Update active states after navigation completes
      this.updateActiveStates();
    });
    this.close();
  }

  toggleGroup(group: NavGroup, event: Event) {
    event.stopPropagation();
    group.collapsed = !group.collapsed;
    localStorage.setItem(
        `sidebar-group-collapsed-${group.key}`, String(group.collapsed));
  }

  private loadCurrentChallenges() {
    this.challengesSubscription =
        this.challengesService.getChallenges().subscribe(challenges => {
          const today = moment().startOf('day');
          // Filter to only current challenges (endDate >= today)
          this.currentChallenges = challenges.filter(challenge => {
            const endDate = moment(challenge.endDate).startOf('day');
            return endDate.isSameOrAfter(today);
          });
          // Sort by end date (soonest first)
          this.currentChallenges.sort((a, b) => {
            return moment(a.endDate).diff(moment(b.endDate));
          });
        });
  }

  isChallengeActive(challenge: Challenge): boolean {
    const currentUrl = this.router.url.split('?')[0];
    return currentUrl === `/challenges/${challenge.id}`;
  }

  isMyAoActive(ao: MyAo): boolean {
    return this.activeAo === ao.name;
  }

  private updateActiveStates() {
    const currentUrl = this.router.url.split('?')[0];  // Remove query params
    const lower = currentUrl.toLowerCase();

    const isInside = (item: NavigationItem) => item.matches.some(prefix => {
      if (prefix === '/') return lower === '/';
      const dir = prefix.endsWith('/') ? prefix : prefix + '/';
      return lower === prefix || lower.startsWith(dir);
    });

    this.mainItems.forEach(item => item.isActive = isInside(item));
    for (const group of this.groups) {
      group.items.forEach(item => item.isActive = isInside(item));
    }

    // Highlight the pinned AO when viewing its page
    this.activeAo = '';
    if (lower.startsWith('/ao/')) {
      let aoNameFromUrl = lower.replace('/ao/', '').split('/')[0].trim();
      try {
        aoNameFromUrl = decodeURIComponent(aoNameFromUrl);
      } catch (e) {
        // If decoding fails, use as-is (already decoded)
      }
      this.activeAo = aoNameFromUrl.replace(/\+/g, ' ').toLowerCase().trim();
    }
  }

  private async handleEmailLinkSignIn() {
    if (this.authService.isSignInWithEmailLink()) {
      try {
        await this.authService.signInWithEmailLink();
        const toast = await this.toastController.create({
          message: 'Successfully signed in!',
          duration: 3000,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        // Clean up the URL by removing the query parameters
        const currentUrl = this.router.url.split('?')[0];
        this.router.navigate([currentUrl], {
          queryParams: {},
          replaceUrl: true,
        });
      } catch (error: any) {
        const toast = await this.toastController.create({
          message: error.message || 'Failed to sign in. Please try again.',
          duration: 5000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      }
    }
  }
}
