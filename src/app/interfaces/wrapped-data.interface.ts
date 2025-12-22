export interface WrappedData {
  userId: string;
  year: number;
  totalPosts: number;
  paxPhotoUrl: string|null;
  paxName: string;

  monthlyBreakdown: MonthlyData[];
  workoutTypeBreakdown: WorkoutType[];
  dayOfWeekBreakdown: DayOfWeek[];
  weatherStats: WeatherStat[];

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

  paxNetwork: {
    totalPaxEncountered: number,
    topWorkoutBuddies: WorkoutBuddy[],
  };

  percentileRank: number;

  qStats: {timesAsQ: number; totalPaxLed: number; averagePaxPerQ: number;};
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
}

export interface F3Phase {
  period: string;
  title: string;
  description: string;
  icon: string;
}