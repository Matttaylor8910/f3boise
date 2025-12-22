import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {from, Observable} from 'rxjs';
import {take} from 'rxjs/operators';
import {Backblast, BBType} from 'types';

import {DayOfWeek, MonthlyData, WorkoutBuddy, WrappedData} from '../interfaces/wrapped-data.interface';

import {AuthService} from './auth.service';
import {BackblastService} from './backblast.service';
import {PaxService} from './pax.service';

@Injectable({providedIn: 'root'})
export class WrappedService {
  constructor(
      private readonly backblastService: BackblastService,
      private readonly paxService: PaxService,
      private readonly authService: AuthService,
  ) {}

  getWrappedData(userId: string, year: number): Observable<WrappedData> {
    return from(this.generateWrappedData(userId, year));
  }

  private async generateWrappedData(userId: string, year: number):
      Promise<WrappedData> {
    // userId can be either an email or a Firebase UID
    let email = userId;

    // If userId looks like a UID (not an email), get the email from the current
    // user
    if (!userId.includes('@')) {
      const user = await this.authService.user$.pipe(take(1)).toPromise();
      if (user?.email) {
        email = user.email;
      } else {
        throw new Error(`No email found for user ${
            userId}. Please ensure your account has an email address.`);
      }
    }

    // Get pax by email
    const pax = await this.paxService.getPaxByEmail(email);
    if (!pax) {
      throw new Error(`No PAX found for email ${
          email}. Please ensure your account email matches your F3 PAX email.`);
    }

    const paxName = pax.name;

    // Get all backblasts for this pax
    const allBackblasts = await this.backblastService.getBackblastsForPax(
        paxName, BBType.BACKBLAST);

    // Filter to the specified year
    const yearStart = moment(`${year}-01-01`);
    const yearEnd = moment(`${year}-12-31`).endOf('day');
    const userBackblasts = allBackblasts.filter(bb => {
      const bbDate = moment(bb.date);
      return bbDate.isSameOrAfter(yearStart, 'day') &&
          bbDate.isSameOrBefore(yearEnd, 'day');
    });

    // Calculate all stats
    const totalPosts = userBackblasts.length;
    const monthlyBreakdown =
        this.calculateMonthlyBreakdown(userBackblasts, year);
    const dayOfWeekBreakdown = this.calculateDayOfWeekBreakdown(userBackblasts);
    const topAO = this.calculateTopAO(userBackblasts);
    const estimatedBurpees = this.calculateEstimatedBurpees(totalPosts);
    const paxNetwork = this.calculatePaxNetwork(userBackblasts, paxName);
    const qStats = this.calculateQStats(userBackblasts, paxName);

    // For now, return mock data for fields that require additional
    // data/calculations
    // TODO: Implement these when we have the data sources
    const workoutTypeBreakdown = this.getMockWorkoutTypeBreakdown();
    const weatherStats = this.getMockWeatherStats();
    const percentileRank = this.getMockPercentileRank();
    const f3Evolution = this.getMockF3Evolution();

    return {
      userId,
      year,
      totalPosts,
      monthlyBreakdown,
      workoutTypeBreakdown,
      dayOfWeekBreakdown,
      weatherStats,
      topAO,
      estimatedBurpees,
      paxNetwork,
      percentileRank,
      f3Evolution,
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

  private calculateTopAO(backblasts: Backblast[]):
      {name: string; posts: number; percentage: number} {
    const aoCounts = new Map<string, number>();

    backblasts.forEach(bb => {
      aoCounts.set(bb.ao, (aoCounts.get(bb.ao) || 0) + 1);
    });

    if (aoCounts.size === 0) {
      return {name: 'N/A', posts: 0, percentage: 0};
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

    return {
      name: topAO,
      posts: maxPosts,
      percentage,
    };
  }

  private calculateEstimatedBurpees(totalPosts: number): number {
    // Estimate ~20 burpees per beatdown on average
    return totalPosts * 20;
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

  private getMockWorkoutTypeBreakdown() {
    return [
      {type: 'Bootcamp', percentage: 35, color: '#FF6B6B'},
      {type: 'Running', percentage: 28, color: '#4ECDC4'},
      {type: 'Rucking', percentage: 22, color: '#FFE66D'},
      {type: 'Other', percentage: 15, color: '#95E1D3'},
    ];
  }

  private getMockWeatherStats() {
    return [
      {
        condition: 'Below Freezing',
        icon: '❄️',
        count: 23,
        description: 'Below Freezing Days',
      },
      {
        condition: 'Rainy',
        icon: '🌧️',
        count: 17,
        description: 'Rainy Mornings',
      },
      {condition: 'Hot', icon: '🔥', count: 31, description: 'Over 80°F Days'},
    ];
  }

  private getMockPercentileRank(): number {
    return 85;
  }

  private getMockF3Evolution() {
    return [
      {
        period: 'January - March',
        title: 'The Runner',
        description: 'Mostly running workouts, building that cardio base',
        icon: '🏃',
      },
      {
        period: 'April - August',
        title: 'The Lifter',
        description: 'Shifted to strength training and bootcamp',
        icon: '💪',
      },
      {
        period: 'September - December',
        title: 'The Rucker',
        description: 'Embraced the ruck and long steady distance',
        icon: '🎒',
      },
    ];
  }
}