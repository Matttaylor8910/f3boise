export enum BBType {
  BACKBLAST = 'BackBlast',
  DOUBLEDOWN = 'DoubleDown'
}

export interface Backblast {
  ao: string;
  qs: string[];
  pax: string[];
  date: string;
  bb_type: BBType;
  event_times: null;
}

export interface Pax {
  id: string;
  name: string;
  email: string;
  img_url: string;
}
export interface AoPaxStats {
  name: string;
  bds: number;
  qs: number;
  qRate: number;
  bdsPerWeek: number;
  firstBdDate: string;
  lastBdDate: string;
  firstQDate?: string;
  lastQDate?: string;
}

export interface QLineUp {
  ao: string;
  date: string;
  closed: boolean;
  text: string|null;
  qs: string[]|null;
}

export interface Workout {
  id: string;
  name: string;
  tomorrows_q: null|string;
  is_tomorrow: boolean;
  address: null|string;
  map_location_url: null|string;
  avg_pax_count: number;
  workout_type: string;
  workout_dates: WorkoutDates;

  // client only field
  schedule: string[];
  icon: string;
}

export interface WorkoutDates {
  Sun?: string[];
  Mon?: string[];
  Tue?: string[];
  Wed?: string[];
  Thu?: string[];
  Fri?: string[];
  Sat?: string[];
}
