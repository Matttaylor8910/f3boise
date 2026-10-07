import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {NavigationStart, Router} from '@angular/router';
import {ModalController} from '@ionic/angular';
import * as moment from 'moment';
import {filter, Subscription} from 'rxjs';
import {UtilService} from 'src/app/services/util.service';
import {aoColor} from 'src/app/util/ao-colors';
import {Backblast} from 'types';

interface DayStat {
  value: number;
  label: string;
}

interface DayBeatdown {
  id: string;
  ao: string;
  aoRoute: string;
  color: string;
  title: string;
  qs: string[];
  pax: string[];
  fngs: string[];
  /** The featured PAX Q'd this one (PAX context only). */
  featuredQd: boolean;
}

/**
 * Everything that happened on one day of the attendance grid: a bottom sheet
 * with the day's totals and a card per beatdown, with the Qs, FNGs and every
 * PAX who posted.
 */
@Component({
  selector: 'app-day-detail-modal',
  templateUrl: './day-detail-modal.component.html',
  styleUrls: ['./day-detail-modal.component.scss'],
})
export class DayDetailModalComponent implements OnInit, OnDestroy {
  /** The day, in any format moment parses. */
  @Input() date!: string;
  /** The beatdowns on that day in the grid's scope. */
  @Input() bds: Backblast[] = [];
  /** When the grid is one PAX's, their name: they're featured in each card. */
  @Input() name?: string;

  dayLabel = '';
  relativeLabel = '';
  featured = '';
  stats: DayStat[] = [];
  beatdowns: DayBeatdown[] = [];

  private navSubscription?: Subscription;

  constructor(
      readonly utilService: UtilService,
      private readonly modalController: ModalController,
      private readonly router: Router,
  ) {}

  ngOnInit() {
    const day = moment(this.date, ['YYYY/MM/DD', 'YYYY-MM-DD']);
    this.dayLabel = day.format('dddd, MMMM D, YYYY');
    this.relativeLabel = day.isSame(moment(), 'day') ? 'Today' : day.fromNow();
    this.featured = this.name ? this.utilService.normalizeName(this.name) : '';

    const lowerName = this.name?.toLowerCase();
    this.beatdowns =
        [...this.bds]
            .sort((a, b) => b.pax.length - a.pax.length)
            .map((bd): DayBeatdown => {
              const qs = bd.qs ?? [];
              const featuredQd =
                  !!lowerName && qs.some(q => q.toLowerCase() === lowerName);
              return {
                id: bd.id,
                ao: this.utilService.normalizeName(bd.ao),
                aoRoute: bd.ao.toLowerCase(),
                color: aoColor(bd.ao),
                title: bd.title?.trim() ?? '',
                qs,
                pax: this.orderPax(bd.pax, qs, lowerName),
                fngs: bd.fngs ?? [],
                featuredQd,
              };
            });

    const pax = new Set<string>();
    const fngs = new Set<string>();
    let posts = 0;
    for (const bd of this.bds) {
      posts += bd.pax.length;
      bd.pax.forEach(p => pax.add(p.toLowerCase()));
      (bd.fngs ?? []).forEach(f => fngs.add(f.toLowerCase()));
    }
    this.stats = [
      {value: pax.size, label: 'PAX'},
      {
        value: this.bds.length,
        label: this.bds.length === 1 ? 'Beatdown' : 'Beatdowns',
      },
      {value: fngs.size, label: fngs.size === 1 ? 'FNG' : 'FNGs'},
    ];
    // a double-down day: the same PAX can post more than once
    if (posts !== pax.size) {
      this.stats.splice(1, 0, {value: posts, label: 'Posts'});
    }

    // any navigation out of the sheet (a PAX chip, an AO link) closes it
    this.navSubscription =
        this.router.events.pipe(filter(e => e instanceof NavigationStart))
            .subscribe(() => void this.modalController.dismiss());
  }

  ngOnDestroy() {
    this.navSubscription?.unsubscribe();
  }

  async close() {
    await this.modalController.dismiss();
  }

  async open(url: string) {
    await this.modalController.dismiss();
    await this.router.navigateByUrl(url);
  }

  isFeatured(pax: string): boolean {
    return !!this.name && pax.toLowerCase() === this.name.toLowerCase();
  }

  isQ(pax: string, bd: DayBeatdown): boolean {
    const lower = pax.toLowerCase();
    return bd.qs.some(q => q.toLowerCase() === lower);
  }

  /** Featured PAX first, then the Qs, then everyone else alphabetically. */
  private orderPax(pax: string[], qs: string[], featured?: string): string[] {
    const qSet = new Set(qs.map(q => q.toLowerCase()));
    const rank = (p: string) => {
      const lower = p.toLowerCase();
      if (lower === featured) return 0;
      if (qSet.has(lower)) return 1;
      return 2;
    };
    return [...pax].sort(
        (a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }
}
