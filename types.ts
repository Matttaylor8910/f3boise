export enum BBType {
  BACKBLAST = 'BackBlast'
}

export interface Backblast {
  ao: string;
  qs: string[];
  pax: string[];
  date: string;
  bb_type: BBType;
  event_times: null;
}

export interface PAX {
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