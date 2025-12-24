export interface WrappedData {
  userId: string;
  year: number;
  totalPosts: number;
  paxPhotoUrl: string|null;
  paxName: string;
  isFirstYear: boolean;

  monthlyBreakdown: MonthlyData[];
  workoutTypeBreakdown: WorkoutType[];
  dayOfWeekBreakdown: DayOfWeek[];

  topAO: {
    name: string,
    posts: number,
    percentage: number,
    address: string|null,
    map_location_url: string|null,
    consistencyRate: number,
    possibleSlots: number,
  };

  topAOs: Array<{
    name: string,
    posts: number,
    percentage: number,
  }>;

  estimatedBurpees: number;
  totalMinutesInGloom: number;

  paxNetwork: {
    totalPaxEncountered: number,
    topWorkoutBuddies: WorkoutBuddy[],
  };

  percentileRank: number;

  qStats: {
    timesAsQ: number; totalPaxLed: number; averagePaxPerQ: number; qCountMaps: {
      overall: Map<string, number>; regions: Map<string, Map<string, number>>;
      aos: Map<string, Map<string, number>>;
    };
    topQBadges: {overall?: boolean; regions?: string[]; aos?: string[];};
  };

  streaks: {
    longestStreak: number; longestStreakStart: string; longestStreakEnd: string;
    yearActiveWeeks: number;
    yearTotalWeeks: number;
    yearActivePercentage: number;
    weeklyData: Array<{weekStart: string; weekEnd: string; isActive: boolean;}>;
  };
}

export interface MonthlyData {
  month: string;
  posts: number;
}

export interface WorkoutType {
  type: string;
  percentage: number;
  color: string;
  count: number;
}

export interface DayOfWeek {
  day: string;
  posts: number;
  percentage: number;
}

export interface WeatherStat {
  condition: string;
  icon: string;
  count: number;
  description: string;
}

export interface WorkoutBuddy {
  name: string;
  posts: number;
  description: string;
  photoUrl?: string|null;
}

export interface F3Phase {
  period: string;
  title: string;
  description: string;
  icon: string;
}