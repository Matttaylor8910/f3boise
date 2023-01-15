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
    {label: 'GrowRuck [GTE]', url: '/gte'},
  ];

  constructor(
      private readonly router: Router,
  ) {}

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
