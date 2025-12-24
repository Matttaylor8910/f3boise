import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {from, Observable} from 'rxjs';
import {take} from 'rxjs/operators';
import {Backblast, BBType} from 'types';

import {CANYON_AOS, CITY_OF_TREES_AOS, HIGH_DESERT_AOS, REGION, SETTLERS_AOS} from '../../../constants';
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
    const paxNetwork = await this.calculatePaxNetwork(userBackblasts, paxName);
    const qStats = await this.calculateQStats(userBackblasts, paxName, year);
    const workoutTypeBreakdown =
        await this.calculateWorkoutTypeBreakdown(userBackblasts);
    const streaks = await this.calculateStreaks(allBackblasts, year);

    // Calculate regional growth stats for the user's region
    const regionalGrowthStats = await this.calculateRegionalGrowthStats(
        paxName, year);

    // Calculate year-over-year comparison stats
    const comparisonStats = await this.calculateComparisonStats(
        paxName, year, totalPosts, totalMinutesInGloom, qStats.timesAsQ,
        paxNetwork.totalPaxEncountered);

    // Calculate actual percentile rank based on BD count for the year
    const percentileRank =
        await this.calculatePercentileRank(paxName, totalPosts, year);

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
      streaks,
      regionalGrowthStats,
      comparisonStats,
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

    // Get top 50 workout buddies (sorted by posts descending)
    const sortedBuddies = Array.from(paxCounts.entries())
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 50);

    const topWorkoutBuddies: WorkoutBuddy[] =
        sortedBuddies.map(([name, count]) => {
          return {name, posts: count, description: ''};
        });

    return {
      totalPaxEncountered: allPax.size,
      topWorkoutBuddies,
    };
  }

  private async calculateQStats(
      backblasts: Backblast[],
      paxName: string,
      year: number,
      ): Promise<{
    timesAsQ: number; totalPaxLed: number; averagePaxPerQ: number; qCountMaps: {
      overall: Map<string, number>; regions: Map<string, Map<string, number>>;
      aos: Map<string, Map<string, number>>;
    };
    topQBadges: {overall?: boolean; regions?: string[]; aos?: string[];};
    favoriteAOToLead?: string;
  }> {
    let timesAsQ = 0;
    let totalPaxLed = 0;
    const userQBackblasts: Backblast[] = [];
    const normalizedPaxName = paxName.toLowerCase();

    // Calculate user's Q stats
    backblasts.forEach(bb => {
      const isQ = bb.qs.some(q => q.toLowerCase() === normalizedPaxName);
      if (isQ) {
        timesAsQ++;
        // Total pax minus Qs (don't count Qs in the pax count)
        totalPaxLed += bb.pax.length - bb.qs.length;
        userQBackblasts.push(bb);
      }
    });

    const averagePaxPerQ =
        timesAsQ > 0 ? Math.round(totalPaxLed / timesAsQ) : 0;

    // Get all backblasts from the year for comparison
    const allBackblasts =
        await this.backblastService.getAllData(BBType.BACKBLAST);
    const yearStart = moment(`${year}-01-01`);
    const yearEnd = moment(`${year}-12-31`).endOf('day');
    const yearBackblasts = allBackblasts.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(yearStart, 'day') &&
          bbDate.isSameOrBefore(yearEnd, 'day');
    });

    // Helper to normalize AO name
    const normalizeAO = (ao: string): string => {
      return this.utilService.normalizeName(ao).toLowerCase();
    };

    // Maps to store Q counts
    const overallQCounts = new Map<string, number>();
    const regionQCounts = new Map<string, Map<string, number>>();
    const aoQCounts = new Map<string, Map<string, number>>();

    // Calculate Q counts for all PAX
    yearBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);

      // Process each Q in this backblast
      bb.qs.forEach(qName => {
        const normalizedQ = qName.toLowerCase();

        // Overall Q count
        overallQCounts.set(
            normalizedQ, (overallQCounts.get(normalizedQ) || 0) + 1);

        // Region-specific Q count
        let region: string|null = null;
        if (CITY_OF_TREES_AOS.has(normalizedAO)) {
          region = REGION.CITY_OF_TREES;
        } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
          region = REGION.HIGH_DESERT;
        } else if (SETTLERS_AOS.has(normalizedAO)) {
          region = REGION.SETTLERS;
        } else if (CANYON_AOS.has(normalizedAO)) {
          region = REGION.CANYON;
        }

        if (region) {
          if (!regionQCounts.has(region)) {
            regionQCounts.set(region, new Map());
          }
          const regionMap = regionQCounts.get(region)!;
          regionMap.set(normalizedQ, (regionMap.get(normalizedQ) || 0) + 1);
        }

        // AO-specific Q count
        if (!aoQCounts.has(normalizedAO)) {
          aoQCounts.set(normalizedAO, new Map());
        }
        const aoMap = aoQCounts.get(normalizedAO)!;
        aoMap.set(normalizedQ, (aoMap.get(normalizedQ) || 0) + 1);
      });
    });

    // Console log the Q maps for debugging
    const regionsObj: {[key: string]: Array<[string, number]>} = {};
    regionQCounts.forEach((map, region) => {
      regionsObj[region] =
          Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    });

    const aosObj: {[key: string]: Array<[string, number]>} = {};
    aoQCounts.forEach((map, ao) => {
      aosObj[ao] = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    });

    // Determine top Q badges - top 10 overall, top 3 for regions/AOs
    const topQBadges: {overall?: boolean; regions?: string[];
                       aos?: string[];} = {};

    // Check overall - top 10
    const overallSorted = Array.from(overallQCounts.entries())
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 10);
    const overallTop10 = new Set(overallSorted.map(([name]) => name));
    if (overallTop10.has(normalizedPaxName)) {
      topQBadges.overall = true;
    }

    // Check regions - top 3
    const topRegions: string[] = [];
    regionQCounts.forEach((countMap, region) => {
      const regionSorted = Array.from(countMap.entries())
                               .sort((a, b) => b[1] - a[1])
                               .slice(0, 3);
      const regionTop3 = new Set(regionSorted.map(([name]) => name));
      if (regionTop3.has(normalizedPaxName)) {
        topRegions.push(region);
      }
    });
    if (topRegions.length > 0) {
      topQBadges.regions = topRegions;
    }

    // Check AOs - top 3
    const topAOs: string[] = [];
    aoQCounts.forEach((countMap, aoName) => {
      const aoSorted = Array.from(countMap.entries())
                           .sort((a, b) => b[1] - a[1])
                           .slice(0, 3);
      const aoTop3 = new Set(aoSorted.map(([name]) => name));
      if (aoTop3.has(normalizedPaxName)) {
        topAOs.push(aoName);
      }
    });
    if (topAOs.length > 0) {
      topQBadges.aos = topAOs;
    }

    // Calculate favorite AO to lead at (AO where they Q'd the most)
    let favoriteAOToLead: string|undefined = undefined;
    if (userQBackblasts.length > 0) {
      const aoQCountsForUser = new Map<string, number>();
      userQBackblasts.forEach(bb => {
        const ao = bb.ao;
        aoQCountsForUser.set(ao, (aoQCountsForUser.get(ao) || 0) + 1);
      });

      let maxCount = 0;
      aoQCountsForUser.forEach((count, ao) => {
        if (count > maxCount) {
          maxCount = count;
          favoriteAOToLead = ao;
        }
      });
    }

    return {
      timesAsQ,
      totalPaxLed,
      averagePaxPerQ,
      qCountMaps: {
        overall: overallQCounts,
        regions: regionQCounts,
        aos: aoQCounts,
      },
      topQBadges,
      favoriteAOToLead,
    };
  }

  // Helper function to convert percentile to "Top X%" format
  // Percentile calculation: (total - rank + 1) / total * 100
  // To get "Top X%": X = (rank / total) * 100, rounded up
  //
  // Examples:
  // - Rank 5 of 73: percentile = 94.52, Top X% = (5/73)*100 = 6.85% ≈ Top 7%
  // - Rank 1 of 100: percentile = 100, Top X% = (1/100)*100 = 1% = Top 1%
  // - Rank 5 of 100: percentile = 96, Top X% = (5/100)*100 = 5% = Top 5%
  //
  // Converting from percentile to rank:
  // percentile = (total - rank + 1) / total * 100
  // rank = total - (percentile/100 * total) + 1 = total * (1 - percentile/100)
  // + 1 Top X% = (rank / total) * 100 = (total * (1 - percentile/100) + 1) /
  // total * 100
  //        = (1 - percentile/100) * 100 + 100/total
  //        ≈ 100 - percentile + (100/total)
  //
  // For large totals, 100/total is negligible, so: Top X% ≈ 100 - percentile
  // But we need to account for the +1 in the percentile calculation:
  // Top X% = 100 - percentile + 1
  //
  // However, this gives: rank 5 of 73 → percentile 95 → Top 6% (should be 7%)
  // The issue is rounding. Better approach: calculate directly from rank and
  // total But we only have percentile, so we need to reverse it: rank =
  // Math.ceil(total * (1 - percentile/100) + 1) Actually simpler: if percentile
  // = (total - rank + 1) / total * 100 Then: rank = total - (percentile/100 *
  // total) + 1 Top X% = Math.ceil((rank / total) * 100)
  private convertPercentileToTopPercent(percentile: number, total?: number):
      number {
    if (total) {
      // If we have total, calculate directly from rank
      // rank = total - (percentile/100 * total) + 1
      const rank = total - (percentile / 100 * total) + 1;
      return Math.max(1, Math.ceil((rank / total) * 100));
    }
    // Fallback: approximate conversion (less accurate)
    return Math.max(1, 100 - percentile + 1);
  }

  // Calculate Q metrics for the specified year
  // Note: allBackblasts parameter is already filtered to the specified year
  // All metrics calculated here are year-specific
  private async calculateQMetrics(
      allBackblasts: Backblast[], paxName: string, userQCount: number,
      totalPaxLed: number, averagePaxPerQ: number, userQBackblasts: Backblast[],
      userBackblasts: Backblast[], userTotalPosts: number): Promise<Array<{
    type: 'ao' | 'region' | 'overall' | 'diversity' | 'attendance' |
        'bd_overall' | 'bd_region' | 'q_overall';
    label: string;
    rank?: number;
    total?: number;
    percentile?: number;
    value?: number; priority: number;
  }>> {
    const normalizedPaxName = paxName.toLowerCase();
    const metrics: Array<{
      type: 'ao' | 'region' | 'overall' | 'diversity' | 'attendance' |
          'bd_overall' | 'bd_region' | 'q_overall';
      label: string;
      rank?: number;
      total?: number;
      percentile?: number;
      value?: number; priority: number;
    }> = [];

    // Maps to store Q counts: Map<key, Map<paxName, count>>
    const aoQCounts = new Map<string, Map<string, number>>();
    const regionQCounts = new Map<string, Map<string, number>>();
    const overallQCounts = new Map<string, number>();
    const paxLedCounts = new Map<string, number>();
    const aoDiversityCounts = new Map<string, Set<string>>();
    const attendanceCounts = new Map < string, {
      total: number;
      count: number
    }
    > ();

    // Helper to normalize AO name for region matching
    const normalizeAO = (ao: string): string => {
      return this.utilService.normalizeName(ao).toLowerCase();
    };

    // Iterate through all backblasts once to build all counts
    allBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      const paxCount = bb.pax.length - bb.qs.length;  // PAX minus Qs

      // Process each Q in this backblast
      bb.qs.forEach(qName => {
        const normalizedQ = qName.toLowerCase();

        // Overall Q count
        overallQCounts.set(
            normalizedQ, (overallQCounts.get(normalizedQ) || 0) + 1);

        // Total PAX led
        paxLedCounts.set(
            normalizedQ, (paxLedCounts.get(normalizedQ) || 0) + paxCount);

        // AO diversity (unique AOs Q'd at)
        if (!aoDiversityCounts.has(normalizedQ)) {
          aoDiversityCounts.set(normalizedQ, new Set());
        }
        aoDiversityCounts.get(normalizedQ)!.add(normalizedAO);

        // Average attendance when Q'ing
        if (!attendanceCounts.has(normalizedQ)) {
          attendanceCounts.set(normalizedQ, {total: 0, count: 0});
        }
        const attendance = attendanceCounts.get(normalizedQ)!;
        attendance.total += paxCount;
        attendance.count += 1;

        // AO-specific Q count
        if (!aoQCounts.has(normalizedAO)) {
          aoQCounts.set(normalizedAO, new Map());
        }
        const aoMap = aoQCounts.get(normalizedAO)!;
        aoMap.set(normalizedQ, (aoMap.get(normalizedQ) || 0) + 1);

        // Region-specific Q count
        let region: string|null = null;
        if (CITY_OF_TREES_AOS.has(normalizedAO)) {
          region = REGION.CITY_OF_TREES;
        } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
          region = REGION.HIGH_DESERT;
        } else if (SETTLERS_AOS.has(normalizedAO)) {
          region = REGION.SETTLERS;
        } else if (CANYON_AOS.has(normalizedAO)) {
          region = REGION.CANYON;
        }

        if (region) {
          if (!regionQCounts.has(region)) {
            regionQCounts.set(region, new Map());
          }
          const regionMap = regionQCounts.get(region)!;
          regionMap.set(normalizedQ, (regionMap.get(normalizedQ) || 0) + 1);
        }
      });
    });

    // Find user's Q count at each AO they Q'd
    const userAOQCounts = new Map<string, number>();
    allBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      const isQ = bb.qs.some(q => q.toLowerCase() === normalizedPaxName);
      if (isQ) {
        userAOQCounts.set(
            normalizedAO, (userAOQCounts.get(normalizedAO) || 0) + 1);
      }
    });

    // METRIC 1-3: AO Rankings (#1, Top 3, Top 5)
    userAOQCounts.forEach((userCount, ao) => {
      const aoMap = aoQCounts.get(ao);
      if (!aoMap) return;

      const sorted = Array.from(aoMap.entries()).sort(([, a], [, b]) => b - a);
      const rank = sorted.findIndex(([name]) => name === normalizedPaxName) + 1;
      const total = sorted.length;

      if (rank > 0 && rank <= 5) {
        const percentile = Math.round(((total - rank + 1) / total) * 100);
        const aoDisplayName =
            ao.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

        let priority = 0;
        let label = '';
        if (rank === 1) {
          priority = 100;
          label = `#1 Q at ${aoDisplayName}`;
        } else if (rank === 2) {
          priority = 95;
          label = `#2 Q at ${aoDisplayName}`;
        } else if (rank === 3) {
          priority = 90;
          label = `#3 Q at ${aoDisplayName}`;
        } else if (rank <= 5) {
          priority = 85;
          label = `Top ${rank} PAX at ${aoDisplayName}`;
        }

        if (priority > 0) {
          metrics.push({
            type: 'ao',
            label,
            rank,
            total,
            percentile,
            priority,
          });
        }
      }
    });

    // METRIC 4-5: Region Rankings (Top 5%, Top 10%)
    const userRegionQCounts = new Map<string, number>();
    allBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      const isQ = bb.qs.some(q => q.toLowerCase() === normalizedPaxName);
      if (isQ) {
        let region: string|null = null;
        if (CITY_OF_TREES_AOS.has(normalizedAO)) {
          region = REGION.CITY_OF_TREES;
        } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
          region = REGION.HIGH_DESERT;
        } else if (SETTLERS_AOS.has(normalizedAO)) {
          region = REGION.SETTLERS;
        } else if (CANYON_AOS.has(normalizedAO)) {
          region = REGION.CANYON;
        }
        if (region) {
          userRegionQCounts.set(
              region, (userRegionQCounts.get(region) || 0) + 1);
        }
      }
    });

    userRegionQCounts.forEach((userCount, region) => {
      const regionMap = regionQCounts.get(region);
      if (!regionMap) return;

      const sorted =
          Array.from(regionMap.entries()).sort(([, a], [, b]) => b - a);
      const rank = sorted.findIndex(([name]) => name === normalizedPaxName) + 1;
      const total = sorted.length;

      if (rank > 0) {
        const percentile = Math.round(((total - rank + 1) / total) * 100);
        const regionDisplayName =
            region.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

        if (percentile >= 90) {
          const topPercent =
              this.convertPercentileToTopPercent(percentile, total);
          metrics.push({
            type: 'region',
            label: percentile >= 95 ?
                `Top ${topPercent}% Q in ${regionDisplayName}` :
                `Top ${topPercent}% Q in ${regionDisplayName}`,
            rank,
            total,
            percentile: topPercent,
            priority: percentile >= 95 ? 75 : 70,
          });
        }
      }
    });

    // METRIC 6-7: Overall Rankings (Top 5%, Top 10%)
    const sortedOverall =
        Array.from(overallQCounts.entries()).sort(([, a], [, b]) => b - a);
    const overallRank =
        sortedOverall.findIndex(([name]) => name === normalizedPaxName) + 1;
    const overallTotal = sortedOverall.length;

    if (overallRank > 0) {
      const overallPercentile =
          Math.round(((overallTotal - overallRank + 1) / overallTotal) * 100);

      if (overallPercentile >= 90) {
        const topPercent =
            this.convertPercentileToTopPercent(overallPercentile, overallTotal);
        metrics.push({
          type: 'overall',
          label: overallPercentile >= 95 ? `Top ${topPercent}% Q in F3 Boise` :
                                           `Top ${topPercent}% Q in F3 Boise`,
          rank: overallRank,
          total: overallTotal,
          percentile: topPercent,
          priority: overallPercentile >= 95 ? 65 : 60,
        });
      }
    }

    // METRIC 8: Diversity (Q'd at most different AOs)
    const userAODiversity = aoDiversityCounts.get(normalizedPaxName)?.size || 0;
    if (userAODiversity > 0) {
      const sortedDiversity = Array.from(aoDiversityCounts.entries())
                                  .sort(([, a], [, b]) => b.size - a.size);
      const diversityRank =
          sortedDiversity.findIndex(([name]) => name === normalizedPaxName) + 1;
      const diversityTotal = sortedDiversity.length;

      if (diversityRank > 0 && diversityRank <= 10) {
        const diversityPercentile = Math.round(
            ((diversityTotal - diversityRank + 1) / diversityTotal) * 100);
        const diversityTopPercent = this.convertPercentileToTopPercent(
            diversityPercentile, diversityTotal);
        metrics.push({
          type: 'diversity',
          label: diversityRank === 1 ?
              `Q'd at ${userAODiversity} Different AOs (Most Diverse)` :
              diversityRank <= 3 ?
              `Q'd at ${userAODiversity} Different AOs (Top ${diversityRank})` :
              `Q'd at ${userAODiversity} Different AOs (Top ${
                  diversityTopPercent}%)`,
          rank: diversityRank,
          total: diversityTotal,
          percentile: diversityTopPercent,
          value: userAODiversity,
          priority: diversityRank === 1 ? 80 :
              diversityRank <= 3        ? 70 :
                                          55,
        });
      }
    }

    // METRIC 9: Average Attendance (Highest average PAX when Q'ing)
    const userAttendance = attendanceCounts.get(normalizedPaxName);
    if (userAttendance && userAttendance.count > 0) {
      const userAvgAttendance =
          Math.round(userAttendance.total / userAttendance.count);
      const sortedAttendance =
          Array.from(attendanceCounts.entries())
              .filter(
                  ([, data]) => data.count >= 3)  // Only count PAX with 3+ Qs
              .map(([name, data]) => ({
                     name,
                     avg: Math.round(data.total / data.count),
                   }))
              .sort((a, b) => b.avg - a.avg);
      const attendanceRank = sortedAttendance.findIndex(
                                 (item) => item.name === normalizedPaxName) +
          1;

      if (attendanceRank > 0 && attendanceRank <= 10) {
        const attendanceTotal = sortedAttendance.length;
        const attendancePercentile = Math.round(
            ((attendanceTotal - attendanceRank + 1) / attendanceTotal) * 100);
        const attendanceTopPercent = this.convertPercentileToTopPercent(
            attendancePercentile, attendanceTotal);
        metrics.push({
          type: 'attendance',
          label: attendanceRank === 1 ?
              `Highest Average Attendance (${userAvgAttendance} PAX)` :
              attendanceRank <= 3 ?
              `Top ${attendanceRank} Average Attendance (${
                  userAvgAttendance} PAX)` :
              `Top ${attendanceTopPercent}% Average Attendance (${
                  userAvgAttendance} PAX)`,
          rank: attendanceRank,
          total: attendanceTotal,
          percentile: attendanceTopPercent,
          value: userAvgAttendance,
          priority: attendanceRank === 1 ? 75 :
              attendanceRank <= 3        ? 65 :
                                           50,
        });
      }
    }

    // METRIC 10: Total PAX Led Ranking
    const userTotalPaxLed = paxLedCounts.get(normalizedPaxName) || 0;
    if (userTotalPaxLed > 0) {
      const sortedPaxLed =
          Array.from(paxLedCounts.entries()).sort(([, a], [, b]) => b - a);
      const paxLedRank =
          sortedPaxLed.findIndex(([name]) => name === normalizedPaxName) + 1;
      const paxLedTotal = sortedPaxLed.length;

      if (paxLedRank > 0 && paxLedRank <= 10) {
        const paxLedPercentile =
            Math.round(((paxLedTotal - paxLedRank + 1) / paxLedTotal) * 100);
        const paxLedTopPercent =
            this.convertPercentileToTopPercent(paxLedPercentile, paxLedTotal);
        metrics.push({
          type: 'overall',
          label: paxLedRank === 1 ?
              `Led ${userTotalPaxLed} Total PAX (Most Impact)` :
              paxLedRank <= 3 ?
              `Led ${userTotalPaxLed} Total PAX (Top ${paxLedRank})` :
              `Led ${userTotalPaxLed} Total PAX (Top ${paxLedTopPercent}%)`,
          rank: paxLedRank,
          total: paxLedTotal,
          percentile: paxLedTopPercent,
          value: userTotalPaxLed,
          priority: paxLedRank === 1 ? 70 :
              paxLedRank <= 3        ? 60 :
                                       45,
        });
      }
    }

    // METRIC 11: Overall BD Count Ranking (Most BDs in F3 Boise for the year)
    // Note: allBackblasts is already filtered to the specified year
    const bdCounts = new Map<string, number>();
    allBackblasts.forEach(bb => {
      bb.pax.forEach(pax => {
        const normalizedPax = pax.toLowerCase();
        bdCounts.set(normalizedPax, (bdCounts.get(normalizedPax) || 0) + 1);
      });
    });

    const userBDCount = userTotalPosts;
    if (userBDCount > 0) {
      const sortedBDs =
          Array.from(bdCounts.entries()).sort(([, a], [, b]) => b - a);
      const bdRank =
          sortedBDs.findIndex(([name]) => name === normalizedPaxName) + 1;
      const bdTotal = sortedBDs.length;

      if (bdRank > 0 && bdRank <= 10) {
        const bdPercentile =
            Math.round(((bdTotal - bdRank + 1) / bdTotal) * 100);
        metrics.push({
          type: 'bd_overall',
          label: bdRank === 1 ?
              `${userBDCount} BDs (Most in F3 Boise)` :
              bdRank <= 3 ?
              `${userBDCount} BDs (Top ${bdRank} in F3 Boise)` :
              `${userBDCount} BDs (Top ${bdPercentile}% in F3 Boise)`,
          rank: bdRank,
          total: bdTotal,
          percentile: bdPercentile,
          value: userBDCount,
          priority: bdRank === 1 ? 95 :
              bdRank <= 3        ? 85 :
                                   70,
        });
      }
    }

    // METRIC 12: Regional BD Count Ranking (for the year)
    // Determine user's primary region based on their BDs in the specified year
    // Note: userBackblasts is already filtered to the specified year
    const userRegionBDCounts = new Map<string, number>();

    userBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      let region: string|null = null;
      if (CITY_OF_TREES_AOS.has(normalizedAO)) {
        region = REGION.CITY_OF_TREES;
      } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
        region = REGION.HIGH_DESERT;
      } else if (SETTLERS_AOS.has(normalizedAO)) {
        region = REGION.SETTLERS;
      } else if (CANYON_AOS.has(normalizedAO)) {
        region = REGION.CANYON;
      }
      if (region) {
        userRegionBDCounts.set(
            region, (userRegionBDCounts.get(region) || 0) + 1);
      }
    });

    // Find user's primary region (most BDs)
    let primaryRegion: string|null = null;
    let maxRegionBDs = 0;
    userRegionBDCounts.forEach((count, region) => {
      if (count > maxRegionBDs) {
        maxRegionBDs = count;
        primaryRegion = region;
      }
    });

    if (primaryRegion && maxRegionBDs > 0) {
      // Calculate BD counts per PAX in this region (for the specified year)
      // Note: allBackblasts is already filtered to the specified year
      const regionBDCounts = new Map<string, number>();
      allBackblasts.forEach(bb => {
        const normalizedAO = normalizeAO(bb.ao);
        let region: string|null = null;
        if (CITY_OF_TREES_AOS.has(normalizedAO)) {
          region = REGION.CITY_OF_TREES;
        } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
          region = REGION.HIGH_DESERT;
        } else if (SETTLERS_AOS.has(normalizedAO)) {
          region = REGION.SETTLERS;
        } else if (CANYON_AOS.has(normalizedAO)) {
          region = REGION.CANYON;
        }

        if (region === primaryRegion) {
          bb.pax.forEach(pax => {
            const normalizedPax = pax.toLowerCase();
            regionBDCounts.set(
                normalizedPax, (regionBDCounts.get(normalizedPax) || 0) + 1);
          });
        }
      });

      const sortedRegionBDs =
          Array.from(regionBDCounts.entries()).sort(([, a], [, b]) => b - a);
      const regionBDRank =
          sortedRegionBDs.findIndex(([name]) => name === normalizedPaxName) + 1;
      const regionBDTotal = sortedRegionBDs.length;

      if (regionBDRank > 0 && regionBDRank <= 10) {
        const regionBDPercentile = Math.round(
            ((regionBDTotal - regionBDRank + 1) / regionBDTotal) * 100);
        const regionBDTopPercent = this.convertPercentileToTopPercent(
            regionBDPercentile, regionBDTotal);
        const regionDisplayName =
            (primaryRegion as string)
                .split('-')
                .map(
                    (word: string) =>
                        word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        metrics.push({
          type: 'bd_region',
          label: regionBDRank === 1 ?
              `${maxRegionBDs} BDs (Most in ${regionDisplayName})` :
              regionBDRank <= 3 ?
              `${maxRegionBDs} BDs (Top ${regionBDRank} in ${
                  regionDisplayName})` :
              `${maxRegionBDs} BDs (Top ${regionBDTopPercent}% in ${
                  regionDisplayName})`,
          rank: regionBDRank,
          total: regionBDTotal,
          percentile: regionBDTopPercent,
          value: maxRegionBDs,
          priority: regionBDRank === 1 ? 90 :
              regionBDRank <= 3        ? 80 :
                                         65,
        });
      }
    }

    // METRIC 13: Overall Q Count Ranking (Most Qs in F3 Boise for the year)
    // Note: overallQCounts is built from allBackblasts which is year-filtered
    if (userQCount > 0) {
      const sortedQOverall =
          Array.from(overallQCounts.entries()).sort(([, a], [, b]) => b - a);
      const qOverallRank =
          sortedQOverall.findIndex(([name]) => name === normalizedPaxName) + 1;
      const qOverallTotal = sortedQOverall.length;

      if (qOverallRank > 0 && qOverallRank <= 10) {
        const qOverallPercentile = Math.round(
            ((qOverallTotal - qOverallRank + 1) / qOverallTotal) * 100);
        const qOverallTopPercent = this.convertPercentileToTopPercent(
            qOverallPercentile, qOverallTotal);
        metrics.push({
          type: 'q_overall',
          label: qOverallRank === 1 ?
              `${userQCount} Qs (Most in F3 Boise)` :
              qOverallRank <= 3 ?
              `${userQCount} Qs (Top ${qOverallRank} in F3 Boise)` :
              `${userQCount} Qs (Top ${qOverallTopPercent}% in F3 Boise)`,
          rank: qOverallRank,
          total: qOverallTotal,
          percentile: qOverallTopPercent,
          value: userQCount,
          priority: qOverallRank === 1 ? 88 :
              qOverallRank <= 3        ? 78 :
                                         63,
        });
      }
    }

    // Sort by priority and return all metrics (sorted by priority)
    metrics.sort((a, b) => b.priority - a.priority);
    return metrics;
  }

  // Calculate participation/consistency metrics for PAX with 0 Qs
  // Showing up consistently IS a form of leadership
  private async calculateParticipationMetrics(
      allBackblasts: Backblast[], paxName: string, userTotalPosts: number,
      userBackblasts: Backblast[]): Promise<Array<{
    type: 'bd_overall' | 'bd_region' | 'participation' | 'consistency';
    label: string;
    rank?: number;
    total?: number;
    percentile?: number;
    value?: number; priority: number;
  }>> {
    const normalizedPaxName = paxName.toLowerCase();
    const metrics: Array<{
      type: 'bd_overall' | 'bd_region' | 'participation' | 'consistency';
      label: string;
      rank?: number;
      total?: number;
      percentile?: number;
      value?: number; priority: number;
    }> = [];

    const normalizeAO = (ao: string): string => {
      return this.utilService.normalizeName(ao).toLowerCase();
    };

    // METRIC 1: Overall BD Count Ranking
    const bdCounts = new Map<string, number>();
    allBackblasts.forEach(bb => {
      bb.pax.forEach(pax => {
        const normalizedPax = pax.toLowerCase();
        bdCounts.set(normalizedPax, (bdCounts.get(normalizedPax) || 0) + 1);
      });
    });

    if (userTotalPosts > 0) {
      const sortedBDs =
          Array.from(bdCounts.entries()).sort(([, a], [, b]) => b - a);
      const bdRank =
          sortedBDs.findIndex(([name]) => name === normalizedPaxName) + 1;
      const bdTotal = sortedBDs.length;

      if (bdRank > 0 && bdRank <= 20) {
        const bdPercentile =
            Math.round(((bdTotal - bdRank + 1) / bdTotal) * 100);
        const topPercent = Math.max(1, 100 - bdPercentile + 1);
        metrics.push({
          type: 'bd_overall',
          label: bdRank === 1 ?
              `${userTotalPosts} BDs (Most in F3 Boise)` :
              bdRank <= 5 ?
              `${userTotalPosts} BDs (Top ${bdRank} in F3 Boise)` :
              `${userTotalPosts} BDs (Top ${topPercent}% in F3 Boise)`,
          rank: bdRank,
          total: bdTotal,
          percentile: topPercent,
          value: userTotalPosts,
          priority: bdRank === 1 ? 95 :
              bdRank <= 5        ? 85 :
                                   70,
        });
      }
    }

    // METRIC 2: Regional BD Count Ranking
    const userRegionBDCounts = new Map<string, number>();
    userBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      let region: string|null = null;
      if (CITY_OF_TREES_AOS.has(normalizedAO)) {
        region = REGION.CITY_OF_TREES;
      } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
        region = REGION.HIGH_DESERT;
      } else if (SETTLERS_AOS.has(normalizedAO)) {
        region = REGION.SETTLERS;
      } else if (CANYON_AOS.has(normalizedAO)) {
        region = REGION.CANYON;
      }
      if (region) {
        userRegionBDCounts.set(
            region, (userRegionBDCounts.get(region) || 0) + 1);
      }
    });

    let primaryRegion: string|null = null;
    let maxRegionBDs = 0;
    userRegionBDCounts.forEach((count, region) => {
      if (count > maxRegionBDs) {
        maxRegionBDs = count;
        primaryRegion = region;
      }
    });

    if (primaryRegion && maxRegionBDs > 0) {
      const regionBDCounts = new Map<string, number>();
      allBackblasts.forEach(bb => {
        const normalizedAO = normalizeAO(bb.ao);
        let region: string|null = null;
        if (CITY_OF_TREES_AOS.has(normalizedAO)) {
          region = REGION.CITY_OF_TREES;
        } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
          region = REGION.HIGH_DESERT;
        } else if (SETTLERS_AOS.has(normalizedAO)) {
          region = REGION.SETTLERS;
        } else if (CANYON_AOS.has(normalizedAO)) {
          region = REGION.CANYON;
        }

        if (region === primaryRegion) {
          bb.pax.forEach(pax => {
            const normalizedPax = pax.toLowerCase();
            regionBDCounts.set(
                normalizedPax, (regionBDCounts.get(normalizedPax) || 0) + 1);
          });
        }
      });

      const sortedRegionBDs =
          Array.from(regionBDCounts.entries()).sort(([, a], [, b]) => b - a);
      const regionBDRank =
          sortedRegionBDs.findIndex(([name]) => name === normalizedPaxName) + 1;
      const regionBDTotal = sortedRegionBDs.length;

      if (regionBDRank > 0 && regionBDRank <= 20) {
        const regionBDPercentile = Math.round(
            ((regionBDTotal - regionBDRank + 1) / regionBDTotal) * 100);
        const topPercent = this.convertPercentileToTopPercent(
            regionBDPercentile, regionBDTotal);
        const regionDisplayName =
            (primaryRegion as string)
                .split('-')
                .map(
                    (word: string) =>
                        word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        metrics.push({
          type: 'bd_region',
          label: regionBDRank === 1 ?
              `${maxRegionBDs} BDs (Most in ${regionDisplayName})` :
              regionBDRank <= 5 ? `${maxRegionBDs} BDs (Top ${
                                      regionBDRank} in ${regionDisplayName})` :
                                  `${maxRegionBDs} BDs (Top ${topPercent}% in ${
                                      regionDisplayName})`,
          rank: regionBDRank,
          total: regionBDTotal,
          percentile: topPercent,
          value: maxRegionBDs,
          priority: regionBDRank === 1 ? 90 :
              regionBDRank <= 5        ? 80 :
                                         65,
        });
      }
    }

    // METRIC 3: Encouragement message
    if (userTotalPosts > 0) {
      metrics.push({
        type: 'participation',
        label: 'Showing Up Is Leadership. Ready to Q?',
        priority: 50,
      });
    }

    // Sort by priority
    metrics.sort((a, b) => b.priority - a.priority);
    return metrics;
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

  private async calculatePercentileRank(
      paxName: string, userTotalPosts: number, year: number): Promise<number> {
    // Get all backblasts from the year for comparison
    const allBackblasts =
        await this.backblastService.getAllData(BBType.BACKBLAST);
    const yearStart = moment(`${year}-01-01`);
    const yearEnd = moment(`${year}-12-31`).endOf('day');
    const yearBackblasts = allBackblasts.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(yearStart, 'day') &&
          bbDate.isSameOrBefore(yearEnd, 'day');
    });

    // Calculate BD counts for all PAX in the year
    const bdCounts = new Map<string, number>();
    yearBackblasts.forEach(bb => {
      bb.pax.forEach(pax => {
        const normalizedPax = pax.toLowerCase();
        bdCounts.set(normalizedPax, (bdCounts.get(normalizedPax) || 0) + 1);
      });
    });

    if (bdCounts.size === 0) {
      return 0;
    }

    // Sort PAX by BD count descending
    const sortedBDs =
        Array.from(bdCounts.entries()).sort(([, a], [, b]) => b - a);

    // Find user's rank
    const normalizedPaxName = paxName.toLowerCase();
    const rank =
        sortedBDs.findIndex(([name]) => name === normalizedPaxName) + 1;
    const total = sortedBDs.length;

    if (rank === 0) {
      return 0;
    }

    // Calculate "Top X%" - the percentage of people you're better than
    // If you're #1 out of 100, you're better than 99% = Top 1%
    // If you're #5 out of 100, you're better than 95% = Top 5%
    // Formula: percentile = (total - rank + 1) / total * 100
    // To convert to "Top X%" where X is small for top performers:
    // - 100th percentile = Top 1% (better than 99% of people)
    // - 96th percentile = Top 5% (better than 95% of people)
    // - 91st percentile = Top 10% (better than 90% of people)
    // Conversion: Top X% = 100 - percentile + 1
    const percentile = Math.round(((total - rank + 1) / total) * 100);
    // Convert percentile to "Top X%" format
    // percentile 100 → Top 1% (100 - 100 + 1 = 1)
    // percentile 96 → Top 5% (100 - 96 + 1 = 5)
    // percentile 91 → Top 10% (100 - 91 + 1 = 10)
    const topPercent = Math.max(1, 100 - percentile + 1);
    return topPercent;
  }

  private async calculateStreaks(
      allBackblasts: Backblast[], year: number): Promise<{
    longestStreak: number; longestStreakStart: string; longestStreakEnd: string;
    yearActiveWeeks: number;
    yearTotalWeeks: number;
    yearActivePercentage: number;
    weeklyData: Array<{weekStart: string; weekEnd: string; isActive: boolean}>;
  }> {
    // Get all backblasts sorted by date
    const sortedBackblasts =
        [...allBackblasts].sort((a, b) => moment(a.date).diff(moment(b.date)));

    // Calculate year boundaries
    const yearStart =
        moment(`${year}-01-01`).startOf('week');  // Start of first week
    const yearEnd = moment(`${year}-12-31`).endOf('week');  // End of last week
    const now = moment();
    // Only count weeks up to the current week (don't include future weeks)
    const actualYearEnd = now.isBefore(yearEnd) ? now.endOf('week') : yearEnd;
    const yearTotalWeeks = actualYearEnd.diff(yearStart, 'weeks') + 1;

    if (sortedBackblasts.length === 0) {
      return {
        longestStreak: 0,
        longestStreakStart: '',
        longestStreakEnd: '',
        yearActiveWeeks: 0,
        yearTotalWeeks,
        yearActivePercentage: 0,
        weeklyData: [],
      };
    }

    // Create a set of all weeks (by week start date) that have at least one BD
    const activeWeeks = new Set<string>();
    sortedBackblasts.forEach(bb => {
      const bbDate = moment(bb.date);
      const weekStart = bbDate.clone().startOf('week');
      activeWeeks.add(weekStart.format('YYYY-MM-DD'));
    });

    // Calculate longest streak that includes at least one week of the provided
    // year
    let longestStreak = 0;
    let currentStreak = 0;
    let longestStreakStart = '';
    let longestStreakEnd = '';
    let currentStreakStart = '';
    let currentStreakIncludesYear = false;

    // Get all unique week starts from backblasts, sorted
    const allWeekStarts =
        Array.from(activeWeeks).map(w => moment(w)).sort((a, b) => a.diff(b));

    allWeekStarts.forEach((weekStart, index) => {
      const weekEnd = weekStart.clone().endOf('week');
      const isInYear =
          weekStart.isSameOrBefore(yearEnd) && weekEnd.isSameOrAfter(yearStart);

      if (index === 0) {
        // First week starts a new streak
        currentStreak = 1;
        currentStreakStart = weekStart.format('YYYY-MM-DD');
        currentStreakIncludesYear = isInYear;
      } else {
        const prevWeekStart = allWeekStarts[index - 1];
        const weeksDiff = weekStart.diff(prevWeekStart, 'weeks');
        if (weeksDiff === 1) {
          // Consecutive week - continue streak
          currentStreak++;
          if (isInYear) {
            currentStreakIncludesYear = true;
          }
        } else {
          // Gap - end current streak, start new one
          if (currentStreakIncludesYear && currentStreak > longestStreak) {
            longestStreak = currentStreak;
            longestStreakStart = currentStreakStart;
            // End date is the end of the last week in the streak
            longestStreakEnd =
                prevWeekStart.clone().endOf('week').format('YYYY-MM-DD');
          }
          currentStreak = 1;
          currentStreakStart = weekStart.format('YYYY-MM-DD');
          currentStreakIncludesYear = isInYear;
        }
      }
    });

    // Check if final streak is the longest (and includes the year)
    if (currentStreakIncludesYear && currentStreak > longestStreak) {
      longestStreak = currentStreak;
      longestStreakStart = currentStreakStart;
      const lastWeekStart = allWeekStarts[allWeekStarts.length - 1];
      longestStreakEnd =
          lastWeekStart.clone().endOf('week').format('YYYY-MM-DD');
    } else if (longestStreak > 0) {
      // Fix the end date for the longest streak (should be end of week, not
      // start)
      const longestStreakStartMoment = moment(longestStreakStart);
      longestStreakEnd = longestStreakStartMoment.clone()
                             .add(longestStreak - 1, 'weeks')
                             .endOf('week')
                             .format('YYYY-MM-DD');
    }

    // Calculate weekly data for the year (only up to current week)
    const weeklyData:
        Array<{weekStart: string; weekEnd: string; isActive: boolean}> = [];
    let currentWeek = yearStart.clone();
    while (currentWeek.isSameOrBefore(actualYearEnd)) {
      const weekStartStr = currentWeek.format('YYYY-MM-DD');
      const weekEnd = currentWeek.clone().endOf('week');
      const isActive = activeWeeks.has(weekStartStr);
      weeklyData.push({
        weekStart: weekStartStr,
        weekEnd: weekEnd.format('YYYY-MM-DD'),
        isActive,
      });
      currentWeek.add(1, 'week');
    }

    // Count active weeks in the year
    const yearActiveWeeks = weeklyData.filter(w => w.isActive).length;
    const yearActivePercentage = yearTotalWeeks > 0 ?
        Math.round((yearActiveWeeks / yearTotalWeeks) * 100) :
        0;

    return {
      longestStreak,
      longestStreakStart,
      longestStreakEnd,
      yearActiveWeeks,
      yearTotalWeeks,
      yearActivePercentage,
      weeklyData,
    };
  }

  /**
   * Calculates regional growth stats for the user's home region
   * Returns stats about total BDs, new AOs, and FNGs in that region
   */
  private async calculateRegionalGrowthStats(
      paxName: string, year: number): Promise<{
    region: string;
    totalBDs: number;
    totalPax: number;
    totalAOs: number;
    newAOs: string[];
    totalFNGs: number;
  }|undefined> {
    // Get the user's PAX to determine their home region
    const pax = await this.paxService.getPax(paxName);
    if (!pax) return undefined;

    // Get user's backblasts to determine their home AO (most frequent AO)
    const userBackblasts = await this.backblastService.getBackblastsForPax(
        paxName, BBType.BACKBLAST);

    if (userBackblasts.length === 0) return undefined;

    // Find user's home AO (most frequent AO overall)
    const aoCounts = new Map<string, number>();
    userBackblasts.forEach(bb => {
      aoCounts.set(bb.ao, (aoCounts.get(bb.ao) || 0) + 1);
    });

    let homeAO = '';
    let maxCount = 0;
    aoCounts.forEach((count, ao) => {
      if (count > maxCount) {
        maxCount = count;
        homeAO = ao;
      }
    });

    // Determine user's region from their home AO
    const normalizedAO = this.utilService.normalizeName(homeAO).toLowerCase();
    let region: string|null = null;
    if (CITY_OF_TREES_AOS.has(normalizedAO)) {
      region = REGION.CITY_OF_TREES;
    } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
      region = REGION.HIGH_DESERT;
    } else if (SETTLERS_AOS.has(normalizedAO)) {
      region = REGION.SETTLERS;
    } else if (CANYON_AOS.has(normalizedAO)) {
      region = REGION.CANYON;
    }

    if (!region) return undefined;

    // Get ALL backblasts ever (to determine first BD dates for FNGs and AOs)
    // Only call getAllData once and reuse it
    const allBackblastsEver = await this.backblastService.getAllData(BBType.BACKBLAST);
    const yearStart = moment(`${year}-01-01`);
    const yearEnd = moment(`${year}-12-31`).endOf('day');
    const yearBackblasts = allBackblastsEver.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(yearStart, 'day') &&
          bbDate.isSameOrBefore(yearEnd, 'day');
    });

    // Helper to normalize AO names
    const normalizeAO = (ao: string) => this.utilService.normalizeName(ao).toLowerCase();

    // Track first BD date per AO (for new AOs)
    const aoFirstBDDates = new Map<string, moment.Moment>();
    allBackblastsEver.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      const bbDate = moment(bb.date);
      const existingDate = aoFirstBDDates.get(normalizedAO);
      if (!existingDate || bbDate.isBefore(existingDate)) {
        aoFirstBDDates.set(normalizedAO, bbDate);
      }
    });

    // Track first BD date per PAX (for FNGs)
    const paxFirstBDDates = new Map<string, moment.Moment>();
    allBackblastsEver.forEach(bb => {
      bb.pax.forEach(paxName => {
        const normalizedPax = paxName.toLowerCase();
        const existingDate = paxFirstBDDates.get(normalizedPax);
        const bbDate = moment(bb.date);
        if (!existingDate || bbDate.isBefore(existingDate)) {
          paxFirstBDDates.set(normalizedPax, bbDate);
        }
      });
    });

    // Pre-calculate home AOs for all PAX in the current year (for FNG determination)
    const paxYearAOCounts = new Map<string, Map<string, number>>(); // PAX -> AO -> count
    yearBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      bb.pax.forEach(paxName => {
        const normalizedPax = paxName.toLowerCase();
        if (!paxYearAOCounts.has(normalizedPax)) {
          paxYearAOCounts.set(normalizedPax, new Map());
        }
        const aoMap = paxYearAOCounts.get(normalizedPax)!;
        aoMap.set(normalizedAO, (aoMap.get(normalizedAO) || 0) + 1);
      });
    });

    // Pre-calculate home AOs for all FNGs
    // Map normalized PAX name to original PAX name and their home AO
    const normalizedToOriginalPax = new Map<string, string>();
    const fngHomeAOs = new Map<string, string>(); // normalized PAX name -> normalized home AO

    // First pass: build mapping of normalized to original PAX names
    yearBackblasts.forEach(bb => {
      bb.pax.forEach(paxName => {
        const normalizedPax = paxName.toLowerCase();
        if (!normalizedToOriginalPax.has(normalizedPax)) {
          normalizedToOriginalPax.set(normalizedPax, paxName);
        }
      });
    });

    // Second pass: calculate home AOs for FNGs
    paxYearAOCounts.forEach((aoCounts, normalizedPax) => {
      const firstBDDate = paxFirstBDDates.get(normalizedPax);
      // Only process FNGs (first BD was this year)
      if (firstBDDate && firstBDDate.isSameOrAfter(yearStart, 'day') &&
          firstBDDate.isSameOrBefore(yearEnd, 'day')) {
        let homeAO = '';
        let maxCount = 0;
        aoCounts.forEach((count, ao) => {
          if (count > maxCount) {
            maxCount = count;
            homeAO = ao;
          }
        });
        if (homeAO) {
          fngHomeAOs.set(normalizedPax, homeAO);
        }
      }
    });

    // Calculate stats for the user's region
    let totalBDs = 0;
    const newAOs = new Set<string>();
    const allAOs = new Set<string>(); // Track all unique AOs in the region
    const fngs = new Set<string>();
    const uniquePax = new Set<string>(); // Track unique PAX in the region

    yearBackblasts.forEach(bb => {
      const normalizedAO = normalizeAO(bb.ao);
      let bbRegion: string|null = null;
      if (CITY_OF_TREES_AOS.has(normalizedAO)) {
        bbRegion = REGION.CITY_OF_TREES;
      } else if (HIGH_DESERT_AOS.has(normalizedAO)) {
        bbRegion = REGION.HIGH_DESERT;
      } else if (SETTLERS_AOS.has(normalizedAO)) {
        bbRegion = REGION.SETTLERS;
      } else if (CANYON_AOS.has(normalizedAO)) {
        bbRegion = REGION.CANYON;
      }

      // Count BDs in this region
      if (bbRegion === region) {
        totalBDs++;

        // Track unique AOs in this region
        allAOs.add(bb.ao); // Use original AO name, not normalized

        // Track unique PAX in this region
        bb.pax.forEach(paxName => {
          uniquePax.add(paxName.toLowerCase());
        });

        // Check if this AO is new (first BD was this year)
        const firstBDDate = aoFirstBDDates.get(normalizedAO);
        if (firstBDDate && firstBDDate.isSameOrAfter(yearStart, 'day') &&
            firstBDDate.isSameOrBefore(yearEnd, 'day')) {
          newAOs.add(bb.ao); // Use original AO name, not normalized
        }

        // Check each PAX in this BD for FNG status
        bb.pax.forEach(paxName => {
          const normalizedPax = paxName.toLowerCase();
          const firstBDDate = paxFirstBDDates.get(normalizedPax);

          // FNG: first BD ever was this year
          if (firstBDDate && firstBDDate.isSameOrAfter(yearStart, 'day') &&
              firstBDDate.isSameOrBefore(yearEnd, 'day')) {
            // Get their pre-calculated home AO (using normalized name)
            const homeAOForFNG = fngHomeAOs.get(normalizedPax);

            if (homeAOForFNG) {
              // Check if their home AO is in this region
              let fngRegion: string|null = null;
              if (CITY_OF_TREES_AOS.has(homeAOForFNG)) {
                fngRegion = REGION.CITY_OF_TREES;
              } else if (HIGH_DESERT_AOS.has(homeAOForFNG)) {
                fngRegion = REGION.HIGH_DESERT;
              } else if (SETTLERS_AOS.has(homeAOForFNG)) {
                fngRegion = REGION.SETTLERS;
              } else if (CANYON_AOS.has(homeAOForFNG)) {
                fngRegion = REGION.CANYON;
              }

              if (fngRegion === region) {
                fngs.add(paxName);
              }
            }
          }
        });
      }
    });

    return {
      region,
      totalBDs,
      totalPax: uniquePax.size,
      totalAOs: allAOs.size,
      newAOs: Array.from(newAOs).sort(),
      totalFNGs: fngs.size,
    };
  }

  /**
   * Calculates year-over-year comparison stats
   * Compares current year to previous year
   * NOTE: This calculates only the minimal stats needed, not full wrapped data,
   * to avoid infinite recursion
   */
  private async calculateComparisonStats(
      paxName: string, currentYear: number, currentTotalPosts: number,
      currentTotalMinutes: number, currentTimesAsQ: number,
      currentTotalPaxEncountered: number): Promise<{
    previousYear: number;
    totalPosts: {current: number; previous: number; change: number; changePercent: number};
    totalMinutes: {current: number; previous: number; change: number; changePercent: number};
    timesAsQ: {current: number; previous: number; change: number; changePercent: number};
    totalPaxEncountered: {current: number; previous: number; change: number; changePercent: number};
  }|undefined> {
    const previousYear = currentYear - 1;

    // Get all backblasts for this pax (we already have this, but need it for previous year)
    const allBackblasts = await this.backblastService.getBackblastsForPax(
        paxName, BBType.BACKBLAST);

    // Filter to previous year only
    const previousYearStart = moment(`${previousYear}-01-01`);
    const previousYearEnd = moment(`${previousYear}-12-31`).endOf('day');
    const previousYearBackblasts = allBackblasts.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(previousYearStart, 'day') &&
          bbDate.isSameOrBefore(previousYearEnd, 'day');
    });

    // If no previous year data, return undefined
    if (previousYearBackblasts.length === 0) {
      return undefined;
    }

    // Calculate minimal stats for previous year (only what we need for comparison)
    const previousTotalPosts = previousYearBackblasts.length;

    // Calculate total minutes for previous year
    const previousTotalMinutes = await this.calculateTotalMinutesInGloom(previousYearBackblasts);

    // Calculate Q stats for previous year
    const normalizedPaxName = paxName.toLowerCase();
    let previousTimesAsQ = 0;
    previousYearBackblasts.forEach(bb => {
      const isQ = bb.qs.some(q => q.toLowerCase() === normalizedPaxName);
      if (isQ) {
        previousTimesAsQ++;
      }
    });

    // Calculate total PAX encountered for previous year
    const previousPaxSet = new Set<string>();
    previousYearBackblasts.forEach(bb => {
      bb.pax.forEach(pax => {
        previousPaxSet.add(pax.toLowerCase());
      });
    });
    const previousTotalPaxEncountered = previousPaxSet.size;

    // Helper to calculate change and percentage
    const calculateChange = (current: number, previous: number) => {
      const change = current - previous;
      const changePercent = previous > 0 ? Math.round((change / previous) * 100) : (current > 0 ? 100 : 0);
      return {change, changePercent};
    };

    const postsChange = calculateChange(currentTotalPosts, previousTotalPosts);
    const minutesChange = calculateChange(currentTotalMinutes, previousTotalMinutes);
    const qChange = calculateChange(currentTimesAsQ, previousTimesAsQ);
    const paxChange = calculateChange(currentTotalPaxEncountered, previousTotalPaxEncountered);

    return {
      previousYear,
      totalPosts: {
        current: currentTotalPosts,
        previous: previousTotalPosts,
        change: postsChange.change,
        changePercent: postsChange.changePercent,
      },
      totalMinutes: {
        current: currentTotalMinutes,
        previous: previousTotalMinutes,
        change: minutesChange.change,
        changePercent: minutesChange.changePercent,
      },
      timesAsQ: {
        current: currentTimesAsQ,
        previous: previousTimesAsQ,
        change: qChange.change,
        changePercent: qChange.changePercent,
      },
      totalPaxEncountered: {
        current: currentTotalPaxEncountered,
        previous: previousTotalPaxEncountered,
        change: paxChange.change,
        changePercent: paxChange.changePercent,
      },
    };
  }
}