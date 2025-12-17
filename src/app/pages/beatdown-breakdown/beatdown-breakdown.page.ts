import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AuthService} from 'src/app/services/auth.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';

type FirebaseUser = any;

@Component({
  selector: 'app-beatdown-breakdown',
  templateUrl: './beatdown-breakdown.page.html',
  styleUrls: ['./beatdown-breakdown.page.scss'],
})
export class BeatdownBreakdownPage {
  userId: string;
  user: FirebaseUser|null = null;
  paxName: string|undefined;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
  ) {
    this.userId = this.route.snapshot.params['userId'];
  }

  ionViewDidEnter() {
    // Get the current user to verify they're viewing their own breakdown
    this.authService.authState$.subscribe(async user => {
      this.user = user;
      if (user?.email) {
        const pax = await this.paxService.getPaxByEmail(user.email);
        this.paxName = pax?.name;
      }
    });
  }
}
