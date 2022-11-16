import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';

@Component({
  selector: 'app-ao',
  templateUrl: './ao.page.html',
  styleUrls: ['./ao.page.scss'],
})
export class AoPage implements OnInit {
  name: string;

  constructor(
      private readonly route: ActivatedRoute,
      private readonly backblastService: BackblastService,
  ) {
    this.name = this.route.snapshot.params['name'];
  }

  async ngOnInit() {
    const data = await this.backblastService.loadAllData();
    console.log(data);
  }
}
