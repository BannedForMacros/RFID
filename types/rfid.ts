export interface Tag {
  contador: number;
  tagid: string;
  fecini: string;
  fecfin: string;
  ipreader: string;
  antena: number;
}

export type ReaderStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reading"
  | "error"
  | "testing";

export interface LogEntry {
  msg: string;
  type: "info" | "success" | "error" | "default";
  time: string;
}

export interface AntennaConfig {
  numero: number;
  nombre: string;
  potencia: number;
}

export interface ReaderConfig {
  id: string;
  name: string;
  ip: string;
  antenas: AntennaConfig[];
}

export type AntennaStatus = "disconnected" | "connecting" | "connected" | "reading";

export interface AntennaRuntimeState {
  status: AntennaStatus;
}

export interface ReaderRuntimeState {
  status: ReaderStatus;
  tags: Tag[];
  newTagIds: string[];
  scanCount: number;
  lastUpdate: string | null;
  antenasState: Record<number, AntennaRuntimeState>;
}

export interface GlobalConfig {
  baseUrl: string;
  dias: number;
  mockMode: boolean;
}
