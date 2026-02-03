import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, NavigationExtras, Router} from '@angular/router';
import {ToastController} from '@ionic/angular';
import * as moment from 'moment';
import {filter, Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {ChallengesService} from 'src/app/services/challenges.service';
import {SidebarService} from 'src/app/services/sidebar.service';
import {UtilService} from 'src/app/services/util.service';
import {Challenge} from 'types';

import {CANYON_AOS, CITY_OF_TREES_AOS, DISCONTINUED_AOS, HIGH_DESERT_AOS, REGION_AGNOSTIC_AOS, SETTLERS_AOS} from '../../../../constants';

interface AoInfo {
  name: string;
  normalizedName: string;
  isActive: boolean;
}

interface RegionInfo {
  name: string;
  route: string;
  aos: AoInfo[];
  isActive: boolean;
  collapsed: boolean;
}

interface OtherAOSection {
  title: string;
  aos: AoInfo[];
  collapsed: boolean;
}

interface NavigationItem {
  label: string;
  route: string;
  isActive: boolean;
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

  regions: RegionInfo[] = [];

  navigationItems: NavigationItem[] = [
    {label: 'All Stats', route: '/ao/all', isActive: false},
    {label: 'Challenges', route: '/challenges', isActive: false},
    {label: 'Backblasts', route: '/backblasts', isActive: false},
    {label: 'Calendar', route: '/calendar', isActive: false},
    {label: 'Family Tree', route: '/family-tree', isActive: false},
    {label: 'Q Line Up', route: '/q-line-up', isActive: false},
    {label: 'Exicon', route: '/exicon', isActive: false},
  ];

  allStatsItem: NavigationItem = this.navigationItems[0];
  otherNavigationItems: NavigationItem[] = this.navigationItems.slice(1);

  otherAOSections: OtherAOSection[] = [];
  doubleDownsActive = false;
  currentChallenges: Challenge[] = [];
  private challengesSubscription?: Subscription;

  constructor(
      private readonly sidebarService: SidebarService,
      private readonly router: Router,
      public readonly utilService: UtilService,
      private readonly authService: AuthService,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
  ) {}

  ngOnInit() {
    // Handle email link sign-in (check on every page load)
    this.handleEmailLinkSignIn();

    // Initialize regions with normalized AO names
    // Filter out region-agnostic AOs from region lists
    const regionAgnosticSet = REGION_AGNOSTIC_AOS;
    const filterOutRegionAgnostic = (ao: string) => !regionAgnosticSet.has(ao);

    const regionData = [
      {
        name: 'City of Trees',
        route: '/region/city-of-trees',
        aos: Array.from(CITY_OF_TREES_AOS)
                 .filter(filterOutRegionAgnostic)
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        isActive: false,
      },
      {
        name: 'High Desert',
        route: '/region/high-desert',
        aos: Array.from(HIGH_DESERT_AOS)
                 .filter(filterOutRegionAgnostic)
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        isActive: false,
      },
      {
        name: 'Settlers',
        route: '/region/settlers',
        aos: Array.from(SETTLERS_AOS)
                 .filter(filterOutRegionAgnostic)
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        isActive: false,
      },
      {
        name: 'Canyon',
        route: '/region/canyon',
        aos: Array.from(CANYON_AOS)
                 .filter(filterOutRegionAgnostic)
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        isActive: false,
      },
    ];

    // Sort regions alphabetically
    regionData.sort((a, b) => a.name.localeCompare(b.name));

    // Load collapsed state from localStorage and apply to regions
    this.regions = regionData.map(region => {
      const storageKey = `sidebar-region-collapsed-${region.route}`;
      const collapsedState = localStorage.getItem(storageKey);
      return {
        ...region,
        collapsed: collapsedState === 'true',
      };
    });

    // Initialize other AO sections (region-agnostic and discontinued)
    this.otherAOSections = [
      {
        title: 'Region Agnostic',
        aos: Array.from(REGION_AGNOSTIC_AOS)
                 .sort()
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        collapsed: false,  // Default: expanded
      },
      {
        title: 'Discontinued',
        aos: Array.from(DISCONTINUED_AOS)
                 .sort()
                 .map(ao => ({
                        name: ao,
                        normalizedName: this.utilService.normalizeName(ao),
                        isActive: false,
                      })),
        collapsed: true,  // Default: collapsed
      },
    ];

    // Load collapsed state for other AO sections from localStorage
    this.otherAOSections = this.otherAOSections.map(section => {
      const storageKey = `sidebar-section-collapsed-${
          section.title.toLowerCase().replace(/\s+/g, '-')}`;
      const collapsedState = localStorage.getItem(storageKey);
      // If there's a stored value, use it; otherwise use the default
      return {
        ...section,
        collapsed: collapsedState !== null ? collapsedState === 'true' :
                                             section.collapsed,
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

  toggleRegionCollapse(region: RegionInfo, event: Event) {
    event.stopPropagation();  // Prevent navigation when clicking toggle button
    region.collapsed = !region.collapsed;

    // Save to localStorage
    const storageKey = `sidebar-region-collapsed-${region.route}`;
    localStorage.setItem(storageKey, String(region.collapsed));
  }

  toggleOtherAOSectionCollapse(section: OtherAOSection, event: Event) {
    event.stopPropagation();  // Prevent navigation when clicking toggle button
    section.collapsed = !section.collapsed;

    // Save to localStorage
    const storageKey = `sidebar-section-collapsed-${
        section.title.toLowerCase().replace(/\s+/g, '-')}`;
    localStorage.setItem(storageKey, String(section.collapsed));
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

  private updateActiveStates() {
    const currentUrl = this.router.url.split('?')[0];  // Remove query params
    const currentUrlLower = currentUrl.toLowerCase();

    // Update navigation items
    this.navigationItems.forEach(item => {
      item.isActive = currentUrl === item.route;
    });

    // Update Double Downs active state
    this.doubleDownsActive = currentUrl === '/dd/all';

    // First, reset all regions, AOs, and other AO sections
    for (const region of this.regions) {
      region.isActive = false;
      region.aos.forEach(ao => {
        ao.isActive = false;
      });
    }
    for (const section of this.otherAOSections) {
      section.aos.forEach(ao => {
        ao.isActive = false;
      });
    }

    // Check if we're on an AO page
    if (currentUrlLower.startsWith('/ao/')) {
      // Get the AO name from URL - router.url should already be decoded, but
      // handle both cases
      let aoNameFromUrl =
          currentUrlLower.replace('/ao/', '').split('?')[0].trim();

      // Try to decode if it's still encoded (handles %20, etc.)
      try {
        aoNameFromUrl = decodeURIComponent(aoNameFromUrl);
      } catch (e) {
        // If decoding fails, use as-is (already decoded)
      }

      // Normalize: replace + with space and lowercase
      const normalizedAoName =
          aoNameFromUrl.replace(/\+/g, ' ').toLowerCase().trim();

      // Find which region or other AO section contains this AO
      // Only highlight the AO, not its parent region
      let found = false;
      for (const region of this.regions) {
        const aoFound = region.aos.find(ao => {
          const normalizedAoInList = ao.name.toLowerCase().trim();
          return normalizedAoInList === normalizedAoName;
        });
        if (aoFound) {
          // Don't set region.isActive = true, only highlight the AO
          aoFound.isActive = true;
          found = true;
          break;  // Found it, no need to continue
        }
      }
      // If not found in regions, check other AO sections
      if (!found) {
        for (const section of this.otherAOSections) {
          const aoFound = section.aos.find(ao => {
            const normalizedAoInList = ao.name.toLowerCase().trim();
            return normalizedAoInList === normalizedAoName;
          });
          if (aoFound) {
            aoFound.isActive = true;
            break;
          }
        }
      }
    } else {
      // Check if we're on a region page
      for (const region of this.regions) {
        if (currentUrl.startsWith(region.route)) {
          region.isActive = true;
          break;
        }
      }
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