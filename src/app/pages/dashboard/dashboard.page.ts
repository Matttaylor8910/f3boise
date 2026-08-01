import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {IonInfiniteScroll} from '@ionic/angular';
import * as moment from 'moment';
import {BackblastService} from 'src/app/services/backblast.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {WorkoutService} from 'src/app/services/workout.service';
import {Backblast, PaxOrigin} from 'types';

const PAGE_SIZE = 30;

/** Century milestones: 100, 200, 300, ... */
const MILESTONE_STEP = 100;
/** Show PAX within this many BDs of their next milestone. */
const WATCH_WINDOW = 25;
/** Trailing window used to compute a PAX's current pace. */
const PACE_DAYS = 42;
/** A PAX must have posted this recently to count as "on track". */
const ACTIVE_DAYS = 21;
/** Window for "accelerating families" (new PAX brought out). */
const FAMILY_DAYS = 90;

interface PulseStat {
  value: string;
  label: string;
  sub: string;
}

interface TomorrowBd {
  ao: string;
  route: string;
  q: string|null;
  time: string;
  icon: string;
}

interface MilestoneWatchItem {
  name: string;
  bds: number;
  next: number;
  needed: number;
  pct: number;
  paceLabel: string;
}

interface FamilyGrower {
  name: string;
  recent: number;
  total: number;
}

type TimelineEventType = 'milestone'|'vq'|'fng'|'backblast';

interface TimelineEvent {
  type: TimelineEventType;
  date: string;
  showDate: boolean;
  dateLabel: string;
  icon: string;
  paxName?: string;    // the celebrated pax (milestone/vq/fng)
  qNames?: string[];   // backblast Qs
  milestone?: number;  // milestone crossed
  ao: string;
  aoRoute: string;
  backblastId: string;
  paxCount?: number;
  title?: string|null;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  loaded = false;

  pulse: PulseStat[] = [];
  tomorrow: TomorrowBd[] = [];
  milestoneWatch: MilestoneWatchItem[] = [];
  familyGrowers: FamilyGrower[] = [];

  private timeline: TimelineEvent[] = [];
  visibleEvents: TimelineEvent[] = [];

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly workoutService: WorkoutService,
  ) {}

  async ionViewDidEnter() {
    const [allBds] = await Promise.all([
      this.backblastService.getAllData(),
      this.loadTomorrow(),
    ]);

    this.calculatePulse(allBds);
    this.calculateMilestoneWatch(allBds);
    await this.calculateFamilyGrowers(allBds);
    this.buildTimeline(allBds);

    this.visibleEvents = this.timeline.slice(0, PAGE_SIZE);
    this.loaded = true;
  }

  goToPax(name: string) {
    this.router.navigateByUrl(`/pax/${name.toLowerCase()}`);
  }

  goToBackblast(event: TimelineEvent) {
    this.router.navigateByUrl(`/backblasts/${event.backblastId}`);
  }

  loadMore(event: any) {
    this.visibleEvents =
        this.timeline.slice(0, this.visibleEvents.length + PAGE_SIZE);
    event.target.complete();
    if (this.visibleEvents.length >= this.timeline.length) {
      event.target.disabled = true;
    }
  }

  private async loadTomorrow() {
    const workouts = await this.workoutService.getAllData();
    const tomorrowDay = moment().add(1, 'day').format('ddd');

    this.tomorrow =
        workouts.filter(workout => workout.is_tomorrow && !workout.closed)
            .map(workout => {
              const times = (workout.workout_dates as any)[tomorrowDay] ?? [];
              return {
                ao: this.utilService.normalizeName(workout.name),
                route: workout.name.trim().toLowerCase(),
                q: workout.tomorrows_q,
                time: times.length > 0 ? this.formatTime(times[0]) : '',
                icon: workout.icon,
              };
            })
            .sort((a, b) => (a.time || 'z').localeCompare(b.time || 'z'));
  }

  private formatTime(time: string): string {
    return new Date(`1970-01-01T${time}Z`).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  private calculatePulse(allBds: Backblast[]) {
    const now = moment();
    let weekBds = 0;
    let weekPosts = 0;
    const weekPax = new Set<string>();
    const monthFngs = new Set<string>();

    for (const bb of allBds) {
      const days = now.diff(moment(bb.date), 'days');
      if (days > 30) break;  // allBds is date descending

      if (days <= 7) {
        weekBds++;
        weekPosts += bb.pax.length;
        bb.pax.forEach(name => weekPax.add(name.toLowerCase()));
      }
      (bb.fngs ?? []).forEach(name => monthFngs.add(name.toLowerCase()));
    }

    this.pulse = [
      {value: `${weekBds}`, label: 'Beatdowns', sub: 'last 7 days'},
      {value: `${weekPosts}`, label: 'Posts', sub: 'last 7 days'},
      {value: `${weekPax.size}`, label: 'Unique PAX', sub: 'last 7 days'},
      {value: `${monthFngs.size}`, label: 'FNGs', sub: 'last 30 days'},
    ];
  }

  private calculateMilestoneWatch(allBds: Backblast[]) {
    const now = moment();
    const counts = new Map<string, number>();
    const displayNames = new Map<string, string>();
    const lastPostDays = new Map<string, number>();
    const paceCounts = new Map<string, number>();

    for (const bb of allBds) {
      const days = now.diff(moment(bb.date), 'days');
      for (const name of bb.pax) {
        const lower = name.toLowerCase();
        counts.set(lower, (counts.get(lower) ?? 0) + 1);
        if (!displayNames.has(lower)) displayNames.set(lower, name);
        // allBds is date descending, so the first sighting is the latest
        if (!lastPostDays.has(lower)) lastPostDays.set(lower, days);
        if (days <= PACE_DAYS) {
          paceCounts.set(lower, (paceCounts.get(lower) ?? 0) + 1);
        }
      }
    }

    const watch: MilestoneWatchItem[] = [];
    for (const [lower, bds] of counts) {
      const next = (Math.floor(bds / MILESTONE_STEP) + 1) * MILESTONE_STEP;
      const needed = next - bds;
      const pace = paceCounts.get(lower) ?? 0;
      const lastDays = lastPostDays.get(lower) ?? Infinity;

      if (needed > WATCH_WINDOW || lastDays > ACTIVE_DAYS || pace === 0) {
        continue;
      }

      const perWeek = pace / (PACE_DAYS / 7);
      const weeks = needed / perWeek;
      const paceLabel = weeks <= 1.5 ?
          'could get there this week' :
          `~${Math.round(weeks)} weeks away at current pace`;

      watch.push({
        name: displayNames.get(lower)!,
        bds,
        next,
        needed,
        pct: (bds % MILESTONE_STEP) / MILESTONE_STEP * 100,
        paceLabel,
      });
    }

    this.milestoneWatch =
        watch.sort((a, b) => a.needed - b.needed || b.bds - a.bds).slice(0, 8);
  }

  private async calculateFamilyGrowers(allBds: Backblast[]) {
    // when did each pax first post?
    const firstBdDate = new Map<string, string>();
    for (const bb of allBds) {
      // allBds is date descending, so keep overwriting to end at the earliest
      for (const name of bb.pax) {
        firstBdDate.set(name.toLowerCase(), bb.date);
      }
    }

    // make sure the pax tree is loaded, then group children by parent
    if (this.paxService.parentMap.size === 0) {
      await this.paxService.loadPaxTree();
    }

    const now = moment();
    const families = new Map<string, FamilyGrower>();
    for (const [child, first] of firstBdDate) {
      const parent = this.paxService.parentMap.get(child);
      if (parent?.type !== PaxOrigin.PAX || !parent.name) continue;

      const lower = parent.name.toLowerCase();
      const family = families.get(lower) ??
          {name: parent.name, recent: 0, total: 0};
      family.total++;
      if (now.diff(moment(first), 'days') <= FAMILY_DAYS) family.recent++;
      families.set(lower, family);
    }

    this.familyGrowers = Array.from(families.values())
                             .filter(family => family.recent > 0)
                             .sort((a, b) => b.recent - a.recent || b.total - a.total)
                             .slice(0, 8);
  }

  /**
   * Builds the full activity feed: every backblast, plus derived events for
   * FNGs welcomed, VQs taken, and century milestones crossed.
   */
  private buildTimeline(allBds: Backblast[]) {
    const counts = new Map<string, number>();
    const hasQd = new Set<string>();
    const events: TimelineEvent[] = [];

    // walk oldest → newest so running totals are correct
    for (let i = allBds.length - 1; i >= 0; i--) {
      const bb = allBds[i];
      const base = {
        date: bb.date,
        showDate: false,
        dateLabel: '',
        ao: this.utilService.normalizeName(bb.ao),
        aoRoute: bb.ao.trim().toLowerCase(),
        backblastId: bb.id,
      };

      events.push({
        ...base,
        type: 'backblast',
        icon: 'barbell-outline',
        qNames: bb.qs ?? [],
        paxCount: bb.pax.length,
        title: bb.title,
      });

      for (const fng of bb.fngs ?? []) {
        events.push({...base, type: 'fng', icon: 'person-add-outline', paxName: fng});
      }

      for (const q of bb.qs ?? []) {
        const lower = q.toLowerCase();
        if (!hasQd.has(lower)) {
          hasQd.add(lower);
          events.push({...base, type: 'vq', icon: 'star-outline', paxName: q});
        }
      }

      for (const name of bb.pax) {
        const lower = name.toLowerCase();
        const count = (counts.get(lower) ?? 0) + 1;
        counts.set(lower, count);
        if (count > 0 && count % MILESTONE_STEP === 0) {
          events.push({
            ...base,
            type: 'milestone',
            icon: 'trophy-outline',
            paxName: name,
            milestone: count,
          });
        }
      }
    }

    // newest first, with a date header on the first event of each day
    events.reverse();
    let lastDate = '';
    for (const event of events) {
      if (event.date !== lastDate) {
        event.showDate = true;
        event.dateLabel = this.utilService.getRelativeDate(event.date);
        lastDate = event.date;
      }
    }

    this.timeline = events;
  }
}
