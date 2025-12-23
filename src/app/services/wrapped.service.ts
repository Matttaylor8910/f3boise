import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {from, Observable} from 'rxjs';
import {take} from 'rxjs/operators';
import {Backblast, BBType} from 'types';

import {DayOfWeek, MonthlyData, WorkoutBuddy, WorkoutType, WrappedData} from '../interfaces/wrapped-data.interface';

import {AuthService} from './auth.service';
import {BackblastService} from './backblast.service';
import {PaxService} from './pax.service';
import {UtilService} from './util.service';
import {WorkoutService} from './workout.service';

@Injectable({providedIn: 'root'})
export class WrappedService {
  constructor(
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly authService: AuthService,
      private readonly workoutService: WorkoutService,
      private readonly utilService: UtilService,
  ) {}

  getWrappedData(userId: string, year: number): Observable<WrappedData> {
    return from(this.generateWrappedData(userId, year));
  }

  private async generateWrappedData(userId: string, year: number):
      Promise<WrappedData> {
    // userId can be either an email, a Firebase UID, or a pax name (for
    // testing)
    let email = userId;
    let paxName: string|undefined;

    // If userId looks like a UID (not an email), get the email from the current
    // user
    if (!userId.includes('@')) {
      // Try to get pax by name first (for testing with ?pax=Name query param)
      const paxByName = await this.paxService.getPax(userId);
      if (paxByName) {
        paxName = paxByName.name;
        // Use email if available, otherwise use name as identifier
        email = paxByName.email || paxByName.name;
      } else {
        // Not a pax name, try to get email from current user
        const user = await this.authService.user$.pipe(take(1)).toPromise();
        if (user?.email) {
          email = user.email;
        } else {
          throw new Error(`No email found for user ${
              userId}. Please ensure your account has an email address.`);
        }
      }
    }

    // Get pax by email (or use the one we already found)
    let pax = paxName ? await this.paxService.getPax(paxName) :
                        await this.paxService.getPaxByEmail(email);

    if (!pax) {
      throw new Error(`No PAX found for ${
          email}. Please ensure your account email matches your F3 PAX email.`);
    }

    // Ensure paxName is set
    if (!paxName) {
      paxName = pax.name;
    }

    // Get all backblasts for this pax
    const allBackblasts = await this.backblastService.getBackblastsForPax(
        paxName, BBType.BACKBLAST);

    // Check if this is their first year (find their very first BD ever)
    let isFirstYear = false;
    if (allBackblasts.length > 0) {
      const sortedAllByDate = [...allBackblasts].sort(
          (a, b) => moment(a.date).diff(moment(b.date)));
      const veryFirstBDDate = moment(sortedAllByDate[0].date);
      const yearStart = moment(`${year}-01-01`);
      const yearEnd = moment(`${year}-12-31`).endOf('day');
      // Check if their first BD ever is within this year
      isFirstYear = veryFirstBDDate.isSameOrAfter(yearStart, 'day') &&
          veryFirstBDDate.isSameOrBefore(yearEnd, 'day');
    }

    // Filter to the specified year
    const yearStart = moment(`${year}-01-01`);
    const yearEnd = moment(`${year}-12-31`).endOf('day');
    const userBackblasts = allBackblasts.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(yearStart, 'day') &&
          bbDate.isSameOrBefore(yearEnd, 'day');
    });

    // Find the first backblast date in this year (if any)
    let firstBDDate: moment.Moment|null = null;
    if (userBackblasts.length > 0) {
      const sortedByDate = [...userBackblasts].sort(
          (a, b) => moment(a.date).diff(moment(b.date)));
      firstBDDate = moment(sortedByDate[0].date);
    }

    // Calculate all stats
    const totalPosts = userBackblasts.length;
    const monthlyBreakdown =
        this.calculateMonthlyBreakdown(userBackblasts, year);
    const dayOfWeekBreakdown = this.calculateDayOfWeekBreakdown(userBackblasts);
    const topAOs = this.calculateTopAOs(userBackblasts);
    const topAO = await this.calculateTopAO(userBackblasts, year, firstBDDate);
    const estimatedBurpees = this.calculateEstimatedBurpees(totalPosts);
    const totalMinutesInGloom =
        await this.calculateTotalMinutesInGloom(userBackblasts);
    const paxNetwork = this.calculatePaxNetwork(userBackblasts, paxName);
    const qStats = this.calculateQStats(userBackblasts, paxName);
    const workoutTypeBreakdown =
        await this.calculateWorkoutTypeBreakdown(userBackblasts);
    const percentileRank = this.getMockPercentileRank();

    // Get pax photo URL
    const paxPhotoUrl = pax.img_url || null;

    return {
      userId,
      year,
      totalPosts,
      paxPhotoUrl,
      paxName,
      isFirstYear,
      monthlyBreakdown,
      workoutTypeBreakdown,
      dayOfWeekBreakdown,
      topAO,
      topAOs,
      estimatedBurpees,
      totalMinutesInGloom,
      paxNetwork,
      percentileRank,
      qStats,
    };
  }

  private calculateMonthlyBreakdown(backblasts: Backblast[], year: number):
      MonthlyData[] {
    const monthCounts = new Map<string, number>();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct',
      'Nov', 'Dec'
    ];

    // Initialize all months to 0
    monthNames.forEach(month => monthCounts.set(month, 0));

    // Count posts per month
    backblasts.forEach(bb => {
      const bbDate = moment(bb.date);
      const monthName = monthNames[bbDate.month()];
      monthCounts.set(monthName, (monthCounts.get(monthName) || 0) + 1);
    });

    return monthNames.map(month => ({
                            month,
                            posts: monthCounts.get(month) || 0,
                          }));
  }

  private calculateTopAOs(backblasts: Backblast[]):
      Array<{name: string; posts: number; percentage: number;}> {
    const aoCounts = new Map<string, number>();

    backblasts.forEach(bb => {
      aoCounts.set(bb.ao, (aoCounts.get(bb.ao) || 0) + 1);
    });

    if (aoCounts.size === 0) {
      return [];
    }

    const totalPosts = backblasts.length;
    const maxCount = Math.max(...Array.from(aoCounts.values()));

    // Sort AOs by count and take top 5
    const topAOs =
        Array.from(aoCounts.entries())
            .map(([name, count]) => ({
                   name,
                   posts: count,
                   percentage:
                       maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
                 }))
            .sort((a, b) => b.posts - a.posts)
            .slice(0, 5);

    return topAOs;
  }

  private calculateDayOfWeekBreakdown(backblasts: Backblast[]): DayOfWeek[] {
    const dayCounts = new Map<string, number>();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize all days to 0
    dayNames.forEach(day => dayCounts.set(day, 0));

    // Count posts per day of week
    backblasts.forEach(bb => {
      const bbDate = moment(bb.date);
      const dayName = dayNames[bbDate.day()];
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
    });

    const total = backblasts.length;
    const maxCount = Math.max(...Array.from(dayCounts.values()));

    return dayNames.map(day => {
      const count = dayCounts.get(day) || 0;
      return {
        day,
        posts: count,
        percentage: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
      };
    });
  }

  private async calculateTopAO(
      backblasts: Backblast[], year: number,
      firstBDDate: moment.Moment|null): Promise<{
    name: string; posts: number; percentage: number; address: string | null;
    map_location_url: string | null;
    consistencyRate: number;
    possibleSlots: number;
  }> {
    const aoCounts = new Map<string, number>();

    backblasts.forEach(bb => {
      aoCounts.set(bb.ao, (aoCounts.get(bb.ao) || 0) + 1);
    });

    if (aoCounts.size === 0) {
      return {
        name: 'N/A',
        posts: 0,
        percentage: 0,
        address: null,
        map_location_url: null,
        consistencyRate: 0,
        possibleSlots: 0
      };
    }

    let topAO = '';
    let maxPosts = 0;

    aoCounts.forEach((count, ao) => {
      if (count > maxPosts) {
        maxPosts = count;
        topAO = ao;
      }
    });

    const totalPosts = backblasts.length;
    const percentage =
        totalPosts > 0 ? Math.round((maxPosts / totalPosts) * 100) : 0;

    // Get workout data to find address, map_location_url, and calculate
    // consistency rate
    let address: string|null = null;
    let map_location_url: string|null = null;
    let consistencyRate = 0;
    let possibleSlots = 0;

    try {
      const workouts = await this.workoutService.getAllData();
      const normalizedTopAO =
          this.utilService.normalizeName(topAO).toLowerCase();

      const matchingWorkout = workouts.find(workout => {
        const normalizedWorkoutName =
            this.utilService.normalizeName(workout.name).toLowerCase();
        return normalizedWorkoutName === normalizedTopAO;
      });

      if (matchingWorkout) {
        address = matchingWorkout.address;
        map_location_url = matchingWorkout.map_location_url;

        // Calculate consistency rate based on workout schedule
        const workoutDates = matchingWorkout.workout_dates;
        const daysPerWeek = Object.keys(workoutDates).length;

        if (daysPerWeek > 0) {
          const yearStart = moment(`${year}-01-01`);
          const yearEnd = moment(`${year}-12-31`);

          // If pax had their first BD in this year, calculate from that date
          // onward
          let startDate = yearStart;
          if (firstBDDate && firstBDDate.isSameOrAfter(yearStart, 'day')) {
            startDate = firstBDDate;
          }

          // Calculate number of weeks from start date to end of year
          const weeksFromStart = yearEnd.diff(startDate, 'weeks') + 1;

          // Calculate total possible slots from start date onward
          possibleSlots = daysPerWeek * weeksFromStart;

          // Calculate consistency rate
          if (possibleSlots > 0) {
            consistencyRate = Math.round((maxPosts / possibleSlots) * 100);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workout data for top AO:', error);
      // Continue without address data
    }

    return {
      name: topAO,
      posts: maxPosts,
      percentage,
      address,
      map_location_url,
      consistencyRate,
      possibleSlots,
    };
  }

  private calculateEstimatedBurpees(totalPosts: number): number {
    // Estimate ~20 burpees per beatdown on average
    return totalPosts * 20;
  }

  private async calculateTotalMinutesInGloom(backblasts: Backblast[]):
      Promise<number> {
    if (backblasts.length === 0) {
      return 0;
    }

    // Load workouts to get workout_dates for each AO
    const workouts = await this.workoutService.getAllData();

    // Helper to convert name to workout ID format
    // Lowercase, spaces replaced by hyphens, non-alphanumeric chars removed
    const nameToWorkoutId = (name: string): string => {
      return name.toLowerCase()
          .replace(/\s+/g, '-')  // Replace spaces with hyphens
          .replace(
              /[^a-z0-9-]/g, '');  // Remove any non-alphanumeric/hyphen chars
    };

    // Create a map of workout ID to workout
    // Workout IDs are standardized: lowercase with hyphens (e.g.,
    // "camels-back")
    const aoToWorkout = new Map<string, any>();
    workouts.forEach(workout => {
      if (workout.id) {
        aoToWorkout.set(workout.id, workout);
      }
    });

    // Day of week mapping (moment uses 0=Sunday, 6=Saturday)
    const dayMap: {[key: number]: string} = {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
    };

    let totalMinutes = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedAOs = new Set<string>();
    const matchedDetails: Array<{ao: string, day: string, duration: number}> =
        [];

    backblasts.forEach(bb => {
      // Convert backblast AO name to workout ID format
      const workoutId = nameToWorkoutId(bb.ao);
      const workout = aoToWorkout.get(workoutId);

      if (workout) {
        // Get day of week from backblast date
        const bbDate = moment(bb.date);
        const dayOfWeek = bbDate.day();  // 0-6 (Sunday-Saturday)
        const dayKey = dayMap[dayOfWeek];

        // Check if workout_dates exists and has entries
        const hasWorkoutDates = workout.workout_dates &&
            Object.keys(workout.workout_dates).length > 0;

        if (hasWorkoutDates && dayKey && workout.workout_dates[dayKey]) {
          const times = workout.workout_dates[dayKey];
          if (times && times.length >= 2) {
            const [startTime, endTime] = times;
            // Parse times (format: "HH:mm:ss")
            const startParts = startTime.split(':').map(Number);
            const endParts = endTime.split(':').map(Number);

            const startMinutes =
                startParts[0] * 60 + startParts[1] + startParts[2] / 60;
            const endMinutes =
                endParts[0] * 60 + endParts[1] + endParts[2] / 60;

            const duration = endMinutes - startMinutes;
            totalMinutes += duration;
            matchedCount++;
            matchedDetails.push({ao: bb.ao, day: dayKey, duration});
          } else {
            // Times array exists but doesn't have 2 elements, default to 60 min
            totalMinutes += 60;
            matchedCount++;
            matchedDetails.push(
                {ao: bb.ao, day: dayKey || 'unknown', duration: 60});
          }
        } else if (!hasWorkoutDates) {
          // Workout exists but has no workout_dates, default to 60 minutes
          totalMinutes += 60;
          matchedCount++;
          matchedDetails.push(
              {ao: bb.ao, day: dayKey || 'unknown', duration: 60});
        } else if (dayKey && !workout.workout_dates[dayKey]) {
          // Workout exists but doesn't have this day, default to 60 minutes
          totalMinutes += 60;
          matchedCount++;
          matchedDetails.push({ao: bb.ao, day: dayKey, duration: 60});
        } else {
          unmatchedCount++;
          unmatchedAOs.add(`${bb.ao} (workoutId: ${workoutId}, dayKey: ${
              dayKey || 'invalid'})`);
        }
      } else {
        unmatchedCount++;
        unmatchedAOs.add(
            `${bb.ao} (workoutId: ${workoutId} - workout not found)`);
      }
    });

    if (unmatchedAOs.size > 0) {
      console.log('Unmatched AOs:', Array.from(unmatchedAOs));
    }

    return Math.round(totalMinutes);
  }

  private calculatePaxNetwork(backblasts: Backblast[], paxName: string):
      {totalPaxEncountered: number; topWorkoutBuddies: WorkoutBuddy[];} {
    const paxCounts = new Map<string, number>();
    const allPax = new Set<string>();

    backblasts.forEach(bb => {
      bb.pax.forEach(pax => {
        const normalizedPax = pax.toLowerCase();
        if (normalizedPax !== paxName.toLowerCase()) {
          allPax.add(pax);
          paxCounts.set(pax, (paxCounts.get(pax) || 0) + 1);
        }
      });
    });

    // Get top 3 workout buddies
    const sortedBuddies = Array.from(paxCounts.entries())
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3);

    const topWorkoutBuddies: WorkoutBuddy[] =
        sortedBuddies.map(([name, count], index) => {
          let description = '';
          if (index === 0) {
            description = 'Your #1 Workout Buddy';
          } else if (index === 1) {
            description = 'The Closer';
          } else {
            description = 'Early Bird Partner';
          }
          return {name, posts: count, description};
        });

    return {
      totalPaxEncountered: allPax.size,
      topWorkoutBuddies,
    };
  }

  private calculateQStats(backblasts: Backblast[], paxName: string):
      {timesAsQ: number; totalPaxLed: number; averagePaxPerQ: number;} {
    let timesAsQ = 0;
    let totalPaxLed = 0;

    backblasts.forEach(bb => {
      const isQ = bb.qs.some(q => q.toLowerCase() === paxName.toLowerCase());
      if (isQ) {
        timesAsQ++;
        // Total pax minus Qs (don't count Qs in the pax count)
        totalPaxLed += bb.pax.length - bb.qs.length;
      }
    });

    const averagePaxPerQ =
        timesAsQ > 0 ? Math.round(totalPaxLed / timesAsQ) : 0;

    return {
      timesAsQ,
      totalPaxLed,
      averagePaxPerQ,
    };
  }

  private async calculateWorkoutTypeBreakdown(backblasts: Backblast[]):
      Promise<WorkoutType[]> {
    if (backblasts.length === 0) {
      return [];
    }

    // Load workouts to get workout_type for each AO
    const workouts = await this.workoutService.getAllData();

    // Helper to convert name to workout ID format (same as minutes calculation)
    const nameToWorkoutId = (name: string): string => {
      return name.toLowerCase()
          .replace(/\s+/g, '-')  // Replace spaces with hyphens
          .replace(
              /[^a-z0-9-]/g, '');  // Remove any non-alphanumeric/hyphen chars
    };

    // Create a map of workout ID to workout type
    const aoToWorkoutType = new Map<string, string>();
    workouts.forEach(workout => {
      if (workout.id) {
        aoToWorkoutType.set(workout.id, workout.workout_type);
      }
    });

    // Count workout types from backblasts
    const typeCounts = new Map<string, number>();
    let totalMatched = 0;

    backblasts.forEach(bb => {
      // Convert backblast AO name to workout ID format
      const workoutId = nameToWorkoutId(bb.ao);
      let workoutType = aoToWorkoutType.get(workoutId);

      // Special handling: if AO is "Black Ops", use "Black Ops" as the type
      if (workoutId === 'black-ops') {
        workoutType = 'Black Ops';
      }

      if (workoutType) {
        typeCounts.set(workoutType, (typeCounts.get(workoutType) || 0) + 1);
        totalMatched++;
      } else {
        console.log(
            `  No match found for AO: ${bb.ao} (workoutId: ${workoutId})`);
      }
    });

    if (typeCounts.size === 0) {
      return [];
    }

    // Convert to array and calculate percentages
    const workoutTypes: WorkoutType[] =
        Array.from(typeCounts.entries())
            .map(([type, count]) => ({
                   type,
                   count,
                   percentage: totalMatched > 0 ?
                       Math.round((count / totalMatched) * 100) :
                       0,
                   color: this.getColorForWorkoutType(type),
                 }))
            .sort(
                (a, b) => b.percentage -
                    a.percentage);  // Sort by percentage descending

    return workoutTypes;
  }

  private getColorForWorkoutType(workoutType: string): string {
    // Assign colors based on workout type
    const colorMap: {[key: string]: string} = {
      'High Intensity': '#FF6B6B',
      'Running': '#4ECDC4',
      'Ruck/Sandbag': '#d51d14',
      'Ruck/Hike': '#FFE66D',  // Legacy support
      'Bootcamp': '#ffd456',
      'Black Ops': '#000',  // Black color for Black Ops
      'Other': '#A8E6CF',
    };

    return colorMap[workoutType] || '#CCCCCC';
  }

  private getMockPercentileRank(): number {
    return 85;
  }
}