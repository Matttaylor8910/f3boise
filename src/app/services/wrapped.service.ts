import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {WrappedData} from '../interfaces/wrapped-data.interface';

@Injectable({providedIn: 'root'})
export class WrappedService {
  constructor() {}

  getWrappedData(userId: string, year: number): Observable<WrappedData> {
    // TODO: Replace with actual API call when backend is ready
    return of(this.getMockData(userId, year));
  }

  private getMockData(userId: string, year: number): WrappedData {
    return {
      userId,
      year,
      totalPosts: 147,

      monthlyBreakdown: [
        { month: 'Jan', posts: 8 },
        { month: 'Feb', posts: 11 },
        { month: 'Mar', posts: 14 },
        { month: 'Apr', posts: 18 },
        { month: 'May', posts: 15 },
        { month: 'Jun', posts: 13 },
        { month: 'Jul', posts: 10 },
        { month: 'Aug', posts: 12 },
        { month: 'Sep', posts: 14 },
        { month: 'Oct', posts: 11 },
        { month: 'Nov', posts: 10 },
        { month: 'Dec', posts: 11 }
      ],

      workoutTypeBreakdown: [
        { type: 'Bootcamp', percentage: 35, color: '#FF6B6B' },
        { type: 'Running', percentage: 28, color: '#4ECDC4' },
        { type: 'Rucking', percentage: 22, color: '#FFE66D' },
        { type: 'Other', percentage: 15, color: '#95E1D3' }
      ],

      dayOfWeekBreakdown: [
        { day: 'Mon', posts: 18, percentage: 70 },
        { day: 'Tue', posts: 26, percentage: 100 },
        { day: 'Wed', posts: 22, percentage: 85 },
        { day: 'Thu', posts: 19, percentage: 75 },
        { day: 'Fri', posts: 21, percentage: 80 },
        { day: 'Sat', posts: 25, percentage: 95 },
        { day: 'Sun', posts: 16, percentage: 60 }
      ],

      weatherStats: [
        {
          condition: 'Below Freezing',
          icon: '❄️',
          count: 23,
          description: 'Below Freezing Days'
        },
        {
          condition: 'Rainy',
          icon: '🌧️',
          count: 17,
          description: 'Rainy Mornings'
        },
        {
          condition: 'Hot',
          icon: '🔥',
          count: 31,
          description: 'Over 80°F Days'
        }
      ],

      topAO: {
        name: 'Bleach',
        posts: 52,
        percentage: 35
      },

      estimatedBurpees: 2847,

      paxNetwork: {
        totalPaxEncountered: 73,
        topWorkoutBuddies: [
          { name: 'Gandalf', posts: 34, description: 'Your #1 Workout Buddy' },
          { name: 'Maverick', posts: 22, description: 'The Closer' },
          { name: 'Timber', posts: 19, description: 'Early Bird Partner' }
        ]
      },

      percentileRank: 85,

      f3Evolution: [
        {
          period: 'January - March',
          title: 'The Runner',
          description: 'Mostly running workouts, building that cardio base',
          icon: '🏃'
        },
        {
          period: 'April - August',
          title: 'The Lifter',
          description: 'Shifted to strength training and bootcamp',
          icon: '💪'
        },
        {
          period: 'September - December',
          title: 'The Rucker',
          description: 'Embraced the ruck and long steady distance',
          icon: '🎒'
        }
      ],

      qStats: {
        timesAsQ: 11,
        totalPaxLed: 187,
        averagePaxPerQ: 17
      },

      challenge2025: {
        targetPosts: 200,
        postsPerWeek: 4
      }
    };
  }
}