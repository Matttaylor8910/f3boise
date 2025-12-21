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
  lastBdRelativeDate?: string;
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

export enum ChallengeMetric {
  BDS = 'bds',
  UNIQUE_AOS = 'uniqueAos',
  QS = 'qs',
  DOUBLE_DOWNS = 'doubleDowns'
}

export interface Challenge {
  id?: string;
  name: string;
  description: string;
  startDate: string;  // YYYY-MM-DD format
  endDate: string;    // YYYY-MM-DD format
  metrics: {bds: boolean; uniqueAos: boolean; qs: boolean; doubleDowns: boolean;};
  sortBy: ChallengeMetric;
  createdBy: string;   // User email or UID
  createdAt: any;      // Firestore timestamp
  isPrivate: boolean;  // Whether the challenge is private (default: false)
  requireJoining: boolean;  // Whether participants must join (default: true). If false, automatically include all PAX with at least one metric > 0
}

export interface ChallengeParticipant {
  id?: string;
  challengeId: string;
  userId: string;    // User email or UID
  paxName?: string;  // PAX name if available
  joinedAt: any;     // Firestore timestamp
}

export interface ChallengeLeaderboardEntry {
  userId: string;
  paxName?: string;
  bds: number;
  uniqueAos: number;
  qs: number;
  doubleDowns: number;
}