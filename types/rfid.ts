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

// ── Mantenedores (CRUD) ──
// Operación: 1=insertar, 2=actualizar, 3=listar, 4=eliminar
export type ManteOpe = 1 | 2 | 3 | 4;

// ── Mantenedor de Readers (MantenedorReader) ──
export interface ReaderManteRequest {
  id: number; // autonumérico, solo relevante en update (op 2); en el resto "0"
  ip: string;
  descripcion: string;
  estado: string; // "0" inactivo / "1" activo
  id_ope: ManteOpe;
}

// Item devuelto por la operación 3 (listar)
export interface ReaderMante {
  id: number;
  ip: string;
  descripcion: string;
  estado: string;
  fechacrea: string;
}

export interface ReaderManteResponse {
  codigo: number; // 1 éxito / 0 fallo
  mensaje: string;
  listareader?: ReaderMante[]; // solo presente en op 3
}

// ── Mantenedor de Antenas (MantenedorAntenas) ──
// OJO: el backend NO normaliza nombres entre request y response:
//   request num_antena  -> response antena_number
//   request id_antena   -> response id
//   request ip_reader   -> response id_reader (devuelve id numérico, no la IP)
export interface AntenaManteRequest {
  ip_reader: string;
  num_antena: number;
  descripcion: string;
  potencia: number; // porcentaje 0–100
  estado: string; // "0" inactivo / "1" activo
  id_ope: ManteOpe;
  id_antena: number; // autonumérico, requerido en update (2) y delete (4)
}

// Item devuelto por la operación 3 (listar) — nombres distintos al request
export interface AntenaMante {
  id: number; // == id_antena del request
  id_reader: number;
  antena_number: number; // == num_antena del request
  descripcion: string;
  potencia: number;
  estado: string;
}

export interface AntenaManteResponse {
  codigo: number; // 1 éxito / 0 fallo
  mensaje: string;
  antenas?: AntenaMante[]; // solo presente en op 3
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
