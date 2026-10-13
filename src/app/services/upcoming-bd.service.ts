import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {QLineUp, Workout} from 'types';

import {canonicalAoName} from '../../../constants';

import {PreblastHcService} from './preblast-hc.service';
import {QService} from './q.service';
import {UtilService} from './util.service';
import {WorkoutService} from './workout.service';

export type BdDay = 'today'|'tomorrow';

const DATE_FORMAT = 'YYYY-MM-DD';
/** A workout with a start but no end on the calendar is assumed this long. */
const DEFAULT_DURATION_MINUTES = 60;

/** A beatdown on the calendar for today or tomorrow. */
export interface UpcomingBd {
  day: BdDay;
  /** YYYY-MM-DD */
  date: string;
  /** Display name, e.g. "Bleach". */
  ao: string;
  /** Backblast AO name (lowercase), the AO page route. */
  route: string;
  q: string|null;
  /** "5:15 AM", or '' when the calendar has no time. */
  time: string;
  /** Start time as "HH:mm:ss" for ordering, or '' when there is none. */
  start: string;
  address: string|null;
  icon: string;
  /**
   * PAX who have HC'd for it (lowercase), plus any co-Qs. Empty until
   * `fillHcs` has run.
   */
  hcs: string[];
}

/** One day's beatdowns, in start-time order. */
export interface UpcomingDay {
  day: BdDay;
  /** YYYY-MM-DD */
  date: string;
  /** "Today · Tue, Oct 13" */
  label: string;
  bds: UpcomingBd[];
}

/**
 * What's next on the calendar: the rest of today's beatdowns, then
 * tomorrow's.
 *
 * Tomorrow comes straight from the scraper's workout list, which names
 * tomorrow's Q and whether the AO is closed. Today's beatdowns are kept
 * until each one ends, with the Q and closures read from the Q line up for
 * the day, so a PAX on the way to a 5:15 AM beatdown still sees who HC'd for
 * it rather than tomorrow's lineup.
 */
@Injectable({providedIn: 'root'})
export class UpcomingBdService {
  constructor(
      private readonly workoutService: WorkoutService,
      private readonly qService: QService,
      private readonly preblastHcService: PreblastHcService,
      private readonly utilService: UtilService,
  ) {}

  /**
   * Today's beatdowns that haven't ended yet, then tomorrow's. A day with
   * nothing on it is left out, so the result is empty only when neither day
   * has a beatdown.
   */
  async getUpcoming(): Promise<UpcomingDay[]> {
    const [today, tomorrow] =
        await Promise.all([this.getTodayRemaining(), this.getTomorrow()]);
    return [today, tomorrow].filter(day => day.bds.length > 0);
  }

  /** Tomorrow's beatdowns, as the scraper lists them. */
  async getTomorrow(): Promise<UpcomingDay> {
    const workouts = await this.workoutService.getAllData();
    const date = moment().add(1, 'day');

    const bds =
        workouts.filter(workout => workout.is_tomorrow && !workout.closed)
            .map(workout => this.toBd(workout, 'tomorrow', date, workout.tomorrows_q, []));
    return this.toDay('tomorrow', date, bds);
  }

  /**
   * Today's beatdowns that are still to come or in progress, with the Q
   * from today's line up. A beatdown drops off once its scheduled end time
   * has passed.
   */
  async getTodayRemaining(now = moment()): Promise<UpcomingDay> {
    const date = now.clone();
    const dateString = date.format(DATE_FORMAT);
    const dayKey = date.format('ddd');

    const workouts = await this.workoutService.getAllData();
    const scheduled =
        workouts.filter(workout => this.timesOn(workout, dayKey) !== undefined)
            .filter(workout => this.endsAfter(workout, dayKey, now));
    if (scheduled.length === 0) return this.toDay('today', date, []);

    const lineup = await this.lineupByAo(dateString);
    const bds: UpcomingBd[] = [];
    for (const workout of scheduled) {
      const slot = lineup.get(this.workoutService.aoKey(workout));
      if (slot?.closed) continue;
      const qs = slot?.qs ?? [];
      const coQs = qs.slice(1).map(name => name.toLowerCase());
      bds.push(this.toBd(workout, 'today', date, qs[0] ?? null, coQs));
    }
    return this.toDay('today', date, bds);
  }

  /**
   * Fills in who has HC'd on each beatdown's preblast. One request per day
   * present, cached by the HC service, so this is cheap to call again.
   */
  async fillHcs(bds: UpcomingBd[]): Promise<void> {
    const dates = Array.from(new Set(bds.map(bd => bd.date)));
    const hcsByDate = new Map<string, Map<string, Set<string>>>();
    await Promise.all(dates.map(
        async date =>
            hcsByDate.set(date, await this.preblastHcService.getHcs(date))));

    for (const bd of bds) {
      const hcs = hcsByDate.get(bd.date)?.get(bd.route) ?? new Set<string>();
      // keep any co-Qs that were seeded before the fetch
      bd.hcs = Array.from(new Set([...bd.hcs, ...hcs])).sort();
    }
  }

  /** Today's line up keyed by backblast AO name. */
  private async lineupByAo(date: string): Promise<Map<string, QLineUp>> {
    const byAo = new Map<string, QLineUp>();
    try {
      const lineup = await this.qService.getQLineUp(date, date);
      for (const slot of lineup) {
        if (slot.date !== date) continue;
        byAo.set(canonicalAoName(slot.ao), slot);
      }
    } catch (e) {
      // without the line up today's beatdowns still list, just with no Q
    }
    return byAo;
  }

  private timesOn(workout: Workout, dayKey: string): string[]|undefined {
    return (workout.workout_dates as Record<string, string[]|undefined>)[dayKey];
  }

  /**
   * Whether the workout is still going at `now`. Without an end time the
   * start plus an hour is used; with no times at all the whole day counts.
   */
  private endsAfter(workout: Workout, dayKey: string, now: moment.Moment):
      boolean {
    const [start, end] = this.timesOn(workout, dayKey) ?? [];
    const date = now.format(DATE_FORMAT);
    let endsAt: moment.Moment;
    if (end) {
      endsAt = moment(`${date}T${end}`);
    } else if (start) {
      endsAt = moment(`${date}T${start}`).add(DEFAULT_DURATION_MINUTES, 'minutes');
    } else {
      endsAt = now.clone().endOf('day');
    }
    return !endsAt.isValid() || endsAt.isAfter(now);
  }

  private toBd(
      workout: Workout, day: BdDay, date: moment.Moment, q: string|null,
      hcs: string[]): UpcomingBd {
    const [start] = this.timesOn(workout, date.format('ddd')) ?? [];
    const key = this.workoutService.aoKey(workout);
    return {
      day,
      date: date.format(DATE_FORMAT),
      ao: this.utilService.normalizeName(key),
      route: key,
      q,
      time: start ? this.formatTime(start) : '',
      start: start ?? '',
      address: workout.address,
      icon: workout.icon,
      hcs,
    };
  }

  private toDay(day: BdDay, date: moment.Moment, bds: UpcomingBd[]):
      UpcomingDay {
    const prefix = day === 'today' ? 'Today' : 'Tomorrow';
    return {
      day,
      date: date.format(DATE_FORMAT),
      label: `${prefix} · ${date.format('ddd, MMM D')}`,
      bds: bds.sort((a, b) => (a.start || 'z').localeCompare(b.start || 'z')),
    };
  }

  private formatTime(time: string): string {
    return new Date(`1970-01-01T${time}Z`).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric',
    });
  }
}
