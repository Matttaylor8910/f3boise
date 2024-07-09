export enum BBType {
  BACKBLAST = 'BackBlast',
  DOUBLEDOWN = 'DoubleDown'
}

export interface Backblast {
  ao: string;
  bb_type: BBType;
  date: string;
  event_times: null;
  fngs: string[];
  id: string;
  moleskine: null|string;
  pax: string[];
  qs: string[];
  title: null|string;
}

export interface Pax {
  id: string;
  name: string;
  parent: null|Parent;
  email?: string;
  img_url?: string;
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
  parent?: Parent|null;
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
  closed: boolean;
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

export type Parent = PaxParent|AtBdParent|DrEhParent|MovedParent|OnlineParent;

interface PaxParent {
  type: PaxOrigin.PAX;
  name: string;
  slackId: string;
}
interface AtBdParent {
  type: PaxOrigin.AT_BD;
}
interface DrEhParent {
  type: PaxOrigin.DR_EH;
}
interface MovedParent {
  type: PaxOrigin.MOVED;
}
interface OnlineParent {
  type: PaxOrigin.ONLINE;
}

export enum PaxOrigin {
  AT_BD = 'atBd',
  DR_EH = 'drEh',
  MOVED = 'moved',
  ONLINE = 'online',
  PAX = 'pax'
}

// Object stored at /users/{userId}
export interface User {
  email: string;
  name?: string;
  // only folks who authenticate with Google have these field
  photoURL?: string;
  phoneNumber?: string;
}