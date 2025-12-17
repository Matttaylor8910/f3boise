import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  showMenu = false;
  buttons = [
    {label: 'Home', url: '/'},
    {label: 'New to F3 [FNG]', url: '/fng'},
    {label: 'Workouts [AO]', url: '/workouts'},
  ];

  // Routes that should hide sidebar toggle on mobile
  private staticPages = ['/', '/fng', '/workouts'];
  hideSidebarToggle = false;

  constructor(
      private readonly router: Router,
  ) {
    this.checkIfShouldHide();
    // Subscribe to route changes
    this.router.events.subscribe(() => {
      this.checkIfShouldHide();
    });
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
    this.router.navigateByUrl(button.url);
  }

  isActive(button: {url: string}) {
    return location.pathname === button.url;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }
}
