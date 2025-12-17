import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationExtras, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  showMenu = false;
  buttons = [
    {label: 'Home', url: '/'},
    {label: 'New to F3 [FNG]', url: '/fng'},
    {label: 'Workouts [AO]', url: '/workouts'},
  ];

  // Routes that should hide sidebar toggle on mobile
  private staticPages = ['/', '/fng', '/workouts'];
  hideSidebarToggle = false;
  isAuthenticated = false;
  showPaxStatsButton = false;
  private authSubscription?: Subscription;

  constructor(
      public readonly router: Router,
      private readonly authService: AuthService,
  ) {
    this.checkIfShouldHide();
    // Subscribe to route changes
    this.router.events.subscribe(() => {
      this.checkIfShouldHide();
      this.updatePaxStatsButton();
    });
  }

  ngOnInit() {
    // Subscribe to authentication state
    this.authSubscription = this.authService.authState$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.updatePaxStatsButton();
    });
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }

  private updatePaxStatsButton() {
    const currentUrl = this.router.url.split('?')[0];
    this.showPaxStatsButton =
        this.isAuthenticated && this.staticPages.includes(currentUrl);
  }

  private checkIfShouldHide() {
    const currentUrl = this.router.url.split('?')[0];
    this.hideSidebarToggle = this.staticPages.includes(currentUrl);
  }

  goHome() {
    this.showMenu = false;
    this.router.navigateByUrl('/');
  }

  navToUrl(button: {url: string}) {
    this.showMenu = false;

    // If navigating to /ao/all from the header, replace history to make it root
    const navigationExtras: NavigationExtras =
        button.url === '/ao/all' ? {replaceUrl: true} : {};

    this.router.navigateByUrl(button.url, navigationExtras);
  }

  isActive(button: {url: string}) {
    return location.pathname === button.url;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }
}
