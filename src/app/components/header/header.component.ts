import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  buttons = [
    {label: 'Home', url: '/'},
    {label: 'New to F3 [FNG]', url: '/fng'},
    {label: 'Workouts [AO]', url: '/workouts'},
  ];

  constructor(
      private readonly router: Router,
  ) {}

  goHome() {
    this.router.navigateByUrl('/');
  }

  navToUrl(button: {url: string}) {
    this.router.navigateByUrl(button.url);
  }

  isActive(button: {url: string}) {
    return location.pathname === button.url;
  }
}
