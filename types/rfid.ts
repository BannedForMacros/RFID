export interface Tag {
  contador: number;
  tagid: string;
  fecini: string;
  fecfin: string;
  ipreader: string;
}

export type ReaderStatus = 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

export interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error' | 'default';
  time: string;
}