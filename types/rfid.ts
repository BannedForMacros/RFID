// ── Tags de lectura en vivo ──
export interface Tag {
  contador: number;
  tagid: string;
  fecini: string;
  fecfin: string;
  ipreader: string;
  antena: number;
}

// ── Registro de Tags (ManteRegistroTag) ──
export interface TagRegistro {
  idTag: string;
  codProducto: string;
  codBarra: string;
  codManual: string;
  descripcion: string;
  estado: string;
}

export interface TagRegistroRequest {
  idope: 1 | 2 | 3 | 4 | 5;
  idTag: string;
  codProducto: string;
  codBarra: string;
  codManual: string;
  descripcion: string;
  estado: string;
}

export interface TagRegistroResponse {
  codigo: number;
  mensaje: string;
  registros: TagRegistro[];
}

// ── Validación de Recepción ──
export interface ValidacionLectura {
  tagid: string;
  codarticulo: string;
  codbarra: string;
  codmanual: string;
  descripcion: string;
  estado: string;
  encontrado: string;
}

export interface ValidacionRequest {
  idope: 4;
  ipreader: string;
}

export interface ValidacionResponse {
  codigo: number;
  mensaje: string;
  cantidadrecep?: string;
  lecturas?: ValidacionLectura[];
  faltantes?: ValidacionLectura[];
}

// ── Reader & Antenna ──
export type ReaderStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reading"
  | "error"
  | "testing";

export type AntennaStatus = "disconnected" | "connecting" | "connected" | "reading";

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

// ── Config global ──
export interface GlobalConfig {
  baseUrl: string;
  dias: number;
  mockMode: boolean;
}

// ── Logs ──
export interface LogEntry {
  msg: string;
  type: "info" | "success" | "error" | "default";
  time: string;
}
