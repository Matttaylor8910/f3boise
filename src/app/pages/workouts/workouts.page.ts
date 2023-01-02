import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {BackblastService} from 'src/app/services/backblast.service';

@Component({
  selector: 'app-workouts',
  templateUrl: './workouts.page.html',
  styleUrls: ['./workouts.page.scss'],
})
export class WorkoutsPage {
  aos: string[] = [];

  constructor(
      public readonly backblastService: BackblastService,
      private readonly router: Router,
  ) {
    this.setAos();
  }

  async setAos() {
    const aos = new Set<string>();

    const data = await this.backblastService.getAllData();
    data.forEach(bb => {
      aos.add(bb.ao);
    });

    this.aos = Array.from(aos).sort((a, b) => a.localeCompare(b));
  }

  navToAo(ao: string) {
    this.router.navigateByUrl(`/ao/${ao}`);
  }
}
