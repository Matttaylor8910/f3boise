import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';
import {Subscription} from 'rxjs';
import {BackblastService} from 'src/app/services/backblast.service';
import {CurrentPaxService} from 'src/app/services/current-pax.service';
import {Pax} from 'types';

/** Set once a linked PAX has been sent to their dashboard this session. */
const REDIRECTED_KEY = 'home-redirected-to-dashboard';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  // default to these counts for the home page
  paxCount: number = 100;
  aoCount: number = 10;
  currentYear = new Date().getFullYear();

  /** The signed-in PAX, when there is one. */
  pax?: Pax;
  private paxSubscription?: Subscription;

  /**
   * True when this page is the first thing the app routed to (a fresh load
   * or a bookmark), false when someone navigated here from inside the app.
   * The router flips `navigated` only after the first activation, so it has
   * to be read here in the constructor.
   */
  private readonly initialLoad: boolean;

  constructor(
      private readonly backblastService: BackblastService,
      private readonly router: Router,
      private readonly currentPaxService: CurrentPaxService,
  ) {
    this.initialLoad = !this.router.navigated;
  }

  ngOnInit() {
    this.paxSubscription =
        this.currentPaxService.pax$.subscribe((pax: Pax|undefined) => {
          this.pax = pax;
          this.maybeRedirectToDashboard();
        });
  }

  ngOnDestroy() {
    this.paxSubscription?.unsubscribe();
  }

  ionViewDidEnter() {
    this.setAos();
  }

  /**
   * A PAX who opens the site lands on their dashboard, not the pitch for
   * FNGs. Only on a fresh load, and only once per session: the sidebar's
   * "Main site" link and the logo still bring them back here.
   */
  private maybeRedirectToDashboard() {
    if (!this.pax || !this.initialLoad) return;
    let alreadyRedirected = false;
    try {
      alreadyRedirected = sessionStorage.getItem(REDIRECTED_KEY) === 'true';
      sessionStorage.setItem(REDIRECTED_KEY, 'true');
    } catch (e) {
      // storage can be unavailable (private mode); redirect once regardless
    }
    if (alreadyRedirected) return;
    this.router.navigateByUrl('/stats', {replaceUrl: true});
  }

  async setAos() {
    const aos = new Set<string>();
    const uniquePaxLast90Days = new Set<string>();

    const now = moment();
    const data = await this.backblastService.getAllData();
    data.forEach(bb => {
      aos.add(bb.ao);

      const days = now.diff(moment(bb.date), 'days');
      if (days <= 90) {
        bb.pax.forEach(name => uniquePaxLast90Days.add(name));
      }
    });

    this.aoCount = aos.size;
    this.paxCount = uniquePaxLast90Days.size - (uniquePaxLast90Days.size % 25);
  }

  navTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
