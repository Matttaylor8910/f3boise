import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-pax-name',
  templateUrl: './pax-name.component.html',
  styleUrls: ['./pax-name.component.scss'],
})
export class PAXNameComponent {
  @Input() name!: string;

  constructor(
      private readonly router: Router,
  ) {}

  goToPaxPage() {
    this.router.navigateByUrl(`/pax/${this.name}`);
  }
}
