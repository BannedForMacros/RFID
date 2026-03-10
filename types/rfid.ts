export interface Tag {
  id: string | number;
  tagid?: string;
  epc?: string;
  fecha?: string;
  timestamp?: string;
}

export type ReaderStatus = 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

export interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error' | 'default';
  time: string;
}