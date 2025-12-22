import {Component} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-fng',
  templateUrl: './fng.page.html',
  styleUrls: ['./fng.page.scss'],
})
export class FNGPage {
  currentYear = new Date().getFullYear();

  constructor(
      private readonly router: Router,
  ) {}

  navTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
