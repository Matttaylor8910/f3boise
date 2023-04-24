import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-pax-chip',
  templateUrl: './pax-chip.component.html',
  styleUrls: ['./pax-chip.component.scss'],
})
export class PaxChipComponent implements OnInit {
  @Input() name!: string;

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
  ) {}

  ngOnInit() {}

  goToPax() {
    this.router.navigateByUrl(`/pax/${this.name}`);
  }
}
