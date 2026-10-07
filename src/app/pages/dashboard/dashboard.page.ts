import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {IonInfiniteScroll, ModalController} from '@ionic/angular';
import * as moment from 'moment';
import {firstValueFrom, Subscription} from 'rxjs';
import {LoginModalComponent} from 'src/app/components/login-modal/login-modal.component';
import {AuthService} from 'src/app/services/auth.service';
import {BackblastService} from 'src/app/services/backblast.service';
import {ChallengesService} from 'src/app/services/challenges.service';
import {CurrentPaxService, MyAo} from 'src/app/services/current-pax.service';
import {PaxService} from 'src/app/services/pax.service';
import {PreblastHcService} from 'src/app/services/preblast-hc.service';
import {QService} from 'src/app/services/q.service';
import {UtilService} from 'src/app/services/util.service';
import {WorkoutService} from 'src/app/services/workout.service';
import {Backblast, BBType, Challenge, ChallengeMetric, Pax, PaxOrigin} from 'types';

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
/** How far ahead to look for open Q slots at the viewer's AOs. */
const OPEN_SLOT_DAYS = 14;
/** How many open slots / recent backblasts to show on the personal cards. */
const PERSONAL_LIST_SIZE = 5;

type FirebaseUser = any;

/** The signed-in PAX's own numbers for the top of the page. */
interface MyWeek {
  name: string;
  postsThisYear: number;
  qsThisYear: number;
  streakWeeks: number;
  lastSeen: string;
  lastAo: string;
  lastAoRoute: string;
}

interface OpenSlot {
  ao: string;
  route: string;
  date: string;
  dateLabel: string;
}

interface ChallengeStanding {
  id: string;
  name: string;
  metricLabel: string;
  value: number;
  goal?: number;
  pct: number;
  rank: number;
  total: number;
  joined: boolean;
}

interface MyBackblast {
  id: string;
  ao: string;
  aoRoute: string;
  dateLabel: string;
  qs: string[];
  paxCount: number;
  title: string|null;
}

interface MetricTally {
  bds: number;
  aos: Set<string>;
  qs: number;
  doubleDowns: number;
}

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
  /** Display name of the AO they've HC'd for tomorrow, when one BD away. */
  tomorrowAo?: string;
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
export class DashboardPage implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  loaded = false;

  pulse: PulseStat[] = [];
  tomorrow: TomorrowBd[] = [];
  milestoneWatch: MilestoneWatchItem[] = [];
  familyGrowers: FamilyGrower[] = [];

  private timeline: TimelineEvent[] = [];
  visibleEvents: TimelineEvent[] = [];

  // the personal half of the page, only when a signed-in user maps to a PAX
  user: FirebaseUser|null = null;
  pax?: Pax;
  personalLoaded = false;
  myWeek?: MyWeek;
  myAos: MyAo[] = [];
  tomorrowMine: TomorrowBd[] = [];
  openSlots: OpenSlot[] = [];
  standings: ChallengeStanding[] = [];
  recentMine: MyBackblast[] = [];

  private authSubscription?: Subscription;
  private paxSubscription?: Subscription;

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly workoutService: WorkoutService,
      private readonly authService: AuthService,
      private readonly currentPaxService: CurrentPaxService,
      private readonly qService: QService,
      private readonly challengesService: ChallengesService,
      private readonly preblastHcService: PreblastHcService,
      private readonly modalController: ModalController,
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.authState$.subscribe(user => {
      this.user = user;
    });
    this.paxSubscription =
        this.currentPaxService.pax$.subscribe((pax: Pax|undefined) => {
          this.pax = pax;
          this.loadPersonal();
        });
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.paxSubscription?.unsubscribe();
  }

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

    // tomorrow's list is ready now, so the personal filter of it can run
    this.filterTomorrowMine();

    // hits the network, so let the page render first
    await this.markMilestonesDueTomorrow();
  }

  async openLoginModal() {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal',
    });
    await modal.present();
  }

  goToAo(route: string) {
    this.router.navigateByUrl(`/ao/${route}`);
  }

  /**
   * Everything that is about the viewer rather than the region: their
   * numbers, their AOs, open Q slots there, where they stand in the current
   * challenges, and what's new at their AOs.
   */
  private async loadPersonal() {
    const pax = this.pax;
    if (!pax) {
      this.personalLoaded = false;
      this.myWeek = undefined;
      this.myAos = [];
      this.tomorrowMine = [];
      this.openSlots = [];
      this.standings = [];
      this.recentMine = [];
      return;
    }

    const [allBds, myBds, myAos] = await Promise.all([
      this.backblastService.getAllData(),
      this.backblastService.getBackblastsForPax(pax.name),
      this.currentPaxService.getMyAos(pax.name),
    ]);

    // the pax may have changed (sign out) while we were loading
    if (this.pax !== pax) return;

    this.myAos = myAos;
    this.myWeek = this.calculateMyWeek(pax.name, myBds);
    this.recentMine = this.findRecentAtMyAos(allBds);
    this.filterTomorrowMine();

    // these two hit the network, so let the page render first
    this.personalLoaded = true;
    await Promise.all([
      this.loadOpenSlots(),
      this.loadStandings(pax.name, allBds),
    ]);
  }

  private calculateMyWeek(name: string, myBds: Backblast[]): MyWeek {
    const thisYear = moment().year();
    const lower = name.toLowerCase();
    let postsThisYear = 0;
    let qsThisYear = 0;
    const weeks = new Set<string>();

    for (const bd of myBds) {
      const date = moment(bd.date);
      weeks.add(date.format('GGGG-WW'));
      if (date.year() !== thisYear) continue;
      postsThisYear++;
      if ((bd.qs ?? []).some(q => q.toLowerCase() === lower)) qsThisYear++;
    }

    // consecutive weeks with at least one post, counting back from this week
    // (or last week, so a streak doesn't vanish on Monday morning)
    let cursor = moment();
    if (!weeks.has(cursor.format('GGGG-WW'))) cursor = cursor.subtract(1, 'week');
    let streakWeeks = 0;
    while (weeks.has(cursor.format('GGGG-WW')) && streakWeeks < 1000) {
      streakWeeks++;
      cursor = cursor.subtract(1, 'week');
    }

    const latest = myBds[0];  // date descending
    return {
      name,
      postsThisYear,
      qsThisYear,
      streakWeeks,
      lastSeen: latest ? this.utilService.getRelativeDate(latest.date) : 'Never',
      lastAo: latest ? this.utilService.normalizeName(latest.ao) : '',
      lastAoRoute: latest ? latest.ao.trim().toLowerCase() : '',
    };
  }

  private filterTomorrowMine() {
    if (this.myAos.length === 0) {
      this.tomorrowMine = [];
      return;
    }
    const mine = new Set(this.myAos.map(ao => ao.name));
    this.tomorrowMine = this.tomorrow.filter(
        bd => mine.has(this.utilService.normalizeName(bd.ao).toLowerCase()));
  }

  private findRecentAtMyAos(allBds: Backblast[]): MyBackblast[] {
    const mine = new Set(this.myAos.map(ao => ao.name));
    const recent: MyBackblast[] = [];
    for (const bd of allBds) {  // date descending
      if (!mine.has(bd.ao.toLowerCase())) continue;
      recent.push({
        id: bd.id,
        ao: this.utilService.normalizeName(bd.ao),
        aoRoute: bd.ao.trim().toLowerCase(),
        dateLabel: this.utilService.getRelativeDate(bd.date),
        qs: bd.qs ?? [],
        paxCount: bd.pax.length,
        title: bd.title,
      });
      if (recent.length >= PERSONAL_LIST_SIZE) break;
    }
    return recent;
  }

  private async loadOpenSlots() {
    const mine = new Set(this.myAos.map(ao => ao.name));
    if (mine.size === 0) {
      this.openSlots = [];
      return;
    }
    const start = moment().format('YYYY-MM-DD');
    const end = moment().add(OPEN_SLOT_DAYS, 'days').format('YYYY-MM-DD');
    const lineup = await this.qService.getQLineUp(start, end);

    this.openSlots =
        lineup
            .filter(slot => !slot.closed && (slot.qs?.length ?? 0) === 0)
            .filter(slot => mine.has(slot.ao.toLowerCase()))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, PERSONAL_LIST_SIZE)
            .map(slot => ({
                   ao: slot.ao,
                   route: slot.ao.toLowerCase(),
                   date: slot.date,
                   dateLabel: moment(slot.date).format('ddd, MMM D'),
                 }));
  }

  /** Where this PAX stands in every challenge that is running right now. */
  private async loadStandings(name: string, allBds: Backblast[]) {
    const today = moment().startOf('day');
    const challenges = await firstValueFrom(this.challengesService.getChallenges());
    const current = challenges.filter(challenge => {
      return !challenge.isPrivate &&
          moment(challenge.startDate).startOf('day').isSameOrBefore(today) &&
          moment(challenge.endDate).startOf('day').isSameOrAfter(today);
    });

    const standings: ChallengeStanding[] = [];
    for (const challenge of current) {
      const standing = await this.calculateStanding(name, challenge, allBds);
      if (standing) standings.push(standing);
    }
    this.standings = standings;
  }

  private async calculateStanding(
      name: string, challenge: Challenge,
      allBds: Backblast[]): Promise<ChallengeStanding|undefined> {
    if (!challenge.id) return undefined;
    const lower = name.toLowerCase();
    const start = moment(challenge.startDate).startOf('day');
    const end = moment(challenge.endDate).endOf('day');
    const inRange = (date: string) => {
      const m = moment(date);
      return m.isSameOrAfter(start, 'day') && m.isSameOrBefore(end, 'day');
    };

    const tallies = new Map<string, MetricTally>();
    const tally = (pax: string) => {
      const key = pax.toLowerCase();
      const entry = tallies.get(key) ??
          {bds: 0, aos: new Set<string>(), qs: 0, doubleDowns: 0};
      tallies.set(key, entry);
      return entry;
    };

    for (const bd of allBds) {
      if (!inRange(bd.date)) continue;
      for (const pax of bd.pax) {
        const entry = tally(pax);
        entry.bds++;
        entry.aos.add(bd.ao.toLowerCase());
      }
      for (const q of bd.qs ?? []) tally(q).qs++;
    }
    if (challenge.metrics.doubleDowns) {
      const dds = await this.backblastService.getAllData(BBType.DOUBLEDOWN);
      for (const dd of dds) {
        if (!inRange(dd.date)) continue;
        for (const pax of dd.pax) tally(pax).doubleDowns++;
      }
    }

    // when joining is required, only participants count (and rank)
    let joined = true;
    let eligible: Set<string>|undefined;
    if (challenge.requireJoining !== false) {
      const participants =
          await firstValueFrom(this.challengesService.getParticipants(challenge.id));
      eligible = new Set(
          participants.map(p => (p.paxName ?? '').toLowerCase()).filter(n => !!n));
      joined = eligible.has(lower);
    }

    const metric = challenge.sortBy ?? ChallengeMetric.BDS;
    const valueOf = (entry: MetricTally): number => {
      switch (metric) {
        case ChallengeMetric.UNIQUE_AOS:
          return entry.aos.size;
        case ChallengeMetric.QS:
          return entry.qs;
        case ChallengeMetric.DOUBLE_DOWNS:
          return entry.doubleDowns;
        default:
          return entry.bds;
      }
    };

    const ranked = Array.from(tallies.entries())
                       .filter(([key]) => !eligible || eligible.has(key))
                       .map(([key, entry]) => ({key, value: valueOf(entry)}))
                       .filter(entry => entry.value > 0)
                       .sort((a, b) => b.value - a.value);
    const mine = tallies.get(lower);
    const value = mine ? valueOf(mine) : 0;
    const rank = ranked.findIndex(entry => entry.key === lower) + 1;
    const goalKey = String(metric) as keyof NonNullable<Challenge['goals']>;
    const goal = challenge.goals ? challenge.goals[goalKey] : undefined;

    return {
      id: challenge.id,
      name: challenge.name,
      metricLabel: this.metricLabel(metric),
      value,
      goal,
      pct: goal ? Math.min(100, value / goal * 100) : 0,
      rank,
      total: ranked.length,
      joined,
    };
  }

  private metricLabel(metric: ChallengeMetric): string {
    switch (metric) {
      case ChallengeMetric.UNIQUE_AOS:
        return 'unique AOs';
      case ChallengeMetric.QS:
        return 'Qs';
      case ChallengeMetric.DOUBLE_DOWNS:
        return 'double downs';
      default:
        return 'posts';
    }
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
              const key = this.workoutService.aoKey(workout);
              return {
                ao: this.utilService.normalizeName(key),
                route: key,
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

  /**
   * A PAX one BD away who has HC'd for tomorrow's preblast gets a note saying
   * where the milestone should land.
   */
  private async markMilestonesDueTomorrow() {
    const oneAway = this.milestoneWatch.filter(m => m.needed === 1);
    if (oneAway.length === 0) return;

    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    const hcs = await this.preblastHcService.getHcs(tomorrow);
    if (hcs.size === 0) return;

    for (const item of oneAway) {
      const lower = item.name.toLowerCase();
      for (const [ao, pax] of hcs) {
        if (pax.has(lower)) {
          item.tomorrowAo = this.utilService.normalizeName(ao);
          break;
        }
      }
    }
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
