export interface IBackblast {
  ao: string;
  qs: string[];
  pax: string[];
  date: string;
  bb_type: BBType;
  event_times: null;
}

export enum BBType {
  BACKBLAST = 'BackBlast'
}