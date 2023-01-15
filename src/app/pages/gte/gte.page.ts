import {Component} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-gte',
  templateUrl: './gte.page.html',
  styleUrls: ['./gte.page.scss'],
})
export class GtePage {
  constructor(
      private readonly router: Router,
  ) {}

  navTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
